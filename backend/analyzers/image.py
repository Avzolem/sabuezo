"""Analizador de imagen — usa Claude Sonnet vision para detectar screenshots de phishing."""
import os
import json
import re
from anthropic import AsyncAnthropic

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
        return json.loads(content)
    except json.JSONDecodeError:
        return {
            "risk": "amarillo",
            "confidence": 50,
            "category": "Imagen no concluyente",
            "red_flags": [],
            "explanation": "No pude analizar la imagen con certeza. Si tienes duda, no actúes sobre ella.",
            "recommended_action": "Verifica directamente con la fuente oficial antes de hacer nada.",
        }
