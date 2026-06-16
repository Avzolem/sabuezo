"""Analizador de imagen — usa Claude Sonnet vision para detectar screenshots de phishing."""
import os
import json
import re
from anthropic import AsyncAnthropic

from integrations import qr

_RISK_ORDER = {"verde": 0, "amarillo": 1, "rojo": 2}

client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

MODEL = "claude-sonnet-4-6"

SYSTEM_PROMPT = """Eres Sabuezo, experto en detectar capturas de pantalla de fraude digital contra PyMEs mexicanas.

Analiza la imagen (screenshot de WhatsApp, SMS, email, página web, etc.) y detecta indicios de estafa.

Busca específicamente:
- Suplantación visual de bancos mexicanos (BBVA, Banamex/Citibanamex, Santander, Banorte, HSBC, Banco Azteca, Inbursa)
- Páginas falsas que imitan login del SAT, Buzón Tributario, banca en línea
- URLs en la imagen con typosquatting (dominios falsos similares a marcas reales)
- Logos pixelados, mal alineados, colores ligeramente distintos a la marca real
- Faltas de ortografía en mensajes "oficiales"
- Capturas de WhatsApp con números desconocidos pidiendo dinero o información
- Falsas facturas, CFDIs apócrifos, requerimientos fiscales fraudulentos
- Falsos correos de paquetería (FedEx, DHL, Estafeta, Mercado Libre)
- Pantallas de pago falsas, falsos comprobantes de transferencia

Responde EXCLUSIVAMENTE con JSON, sin markdown, exactamente esta forma:
{
  "risk": "rojo" | "amarillo" | "verde",
  "confidence": <0-100>,
  "category": "<frase corta>",
  "red_flags": ["<bullet>", ...],
  "explanation": "<1-2 frases en español plano>",
  "recommended_action": "<qué hacer, 1 frase>"
}
"""


async def analyze(image_base64: str, caption: str = "") -> dict:
    user_text = "Analiza esta imagen en busca de estafa o phishing dirigido a PyMEs mexicanas."
    if caption:
        user_text += f"\n\nEl usuario la envió con este texto: '{caption}'."
    user_text += "\n\nResponde solo con el JSON."

    resp = await client.messages.create(
        model=MODEL,
        max_tokens=800,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": image_base64,
                        },
                    },
                    {"type": "text", "text": user_text},
                ],
            }
        ],
    )

    content = resp.content[0].text.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)

    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        result = {
            "risk": "amarillo",
            "confidence": 50,
            "category": "Imagen no concluyente",
            "red_flags": [],
            "explanation": "No pude analizar la imagen con certeza. Si tienes duda, no actúes sobre ella.",
            "recommended_action": "Verifica directamente con la fuente oficial antes de hacer nada.",
        }

    # Anti-quishing: si la imagen contiene un QR con URL, analízala de verdad
    # y fusiona el veredicto (elevando el riesgo al mayor de los dos).
    return await _augment_with_qr(image_base64, result)


async def _augment_with_qr(image_base64: str, result: dict) -> dict:
    try:
        urls = qr.pick_urls(qr.decode_qr(image_base64))
        if not urls:
            return result
        qr_url = urls[0]
        from analyzers import url as url_analyzer
        ua = await url_analyzer.analyze(qr_url)

        result.setdefault("red_flags", [])
        result["red_flags"].insert(0, f"📸➡️🔗 La imagen contiene un código QR que apunta a: {qr_url}")
        for f in ua.get("red_flags", []):
            result["red_flags"].append(f"(del QR) {f}")

        if _RISK_ORDER.get(ua.get("risk"), 0) >= _RISK_ORDER.get(result.get("risk"), 0):
            result["risk"] = ua.get("risk", result.get("risk"))
            result["recommended_action"] = ua.get("recommended_action", result.get("recommended_action"))
            result["confidence"] = max(result.get("confidence", 0), ua.get("confidence", 0))

        cat = result.get("category") or "Imagen con QR"
        if "QR" not in cat:
            result["category"] = f"{cat} · contiene QR (quishing)"
        result.setdefault("metadata", {})["qr_url"] = qr_url
    except Exception:
        pass
    return result
