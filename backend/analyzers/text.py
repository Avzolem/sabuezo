"""Analizador de texto — detecta phishing/estafas en mensajes para PyMEs mexicanas."""
import os
import json
import re
from anthropic import AsyncAnthropic

client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

MODEL = "claude-haiku-4-5-20251001"

SYSTEM_PROMPT = """Eres Sabuezo, un experto en detección de fraude digital dirigido a PyMEs mexicanas.

Analiza el mensaje y determina si es estafa, phishing, intento de fraude empresarial, o legítimo.

Patrones comunes en México que debes detectar:
- Suplantación del SAT, CFDI, Buzón Tributario, requerimientos fiscales
- Suplantación de bancos: BBVA, Banamex/Citibanamex, Santander, Banorte, HSBC, Banco Azteca, Inbursa
- Cambio repentino de cuenta bancaria de un "proveedor" (fraude del proveedor / BEC)
- Falso CEO pidiendo transferencia urgente (CEO fraud)
- Falsas ofertas de trabajo / falsos clientes B2B pidiendo datos
- Suplantación de Mercado Libre, Mercado Pago, Amazon, FedEx, DHL, Estafeta
- Falsos cobros de CFE, Telmex, Megacable, Izzi, Totalplay
- Secuestro virtual / extorsión telefónica empresarial
- URLs fraudulentas con typosquatting (bbva-segur1dad, banamex-mx, sat-gob, etc.)
- Mensajes con urgencia artificial ("URGENTE", "tu cuenta será bloqueada en 24h", "última oportunidad")
- Mensajes pidiendo códigos OTP/SMS de verificación
- Falsos premios, sorteos, "felicidades has ganado"
- Ofertas de inversión con retornos garantizados, cripto pump
- Romance scam openers ("hola guapo/a", "podemos ser amigos", número desconocido extranjero)

Considera el contexto mexicano: regionalismos, modismos, nombres de bancos y servicios locales.

Responde EXCLUSIVAMENTE con un objeto JSON válido, sin markdown, sin explicación extra, con esta forma exacta:
{
  "risk": "rojo" | "amarillo" | "verde",
  "confidence": <entero 0-100>,
  "category": "<frase corta, máx 6 palabras>",
  "red_flags": ["<bullet en español plano>", ...],
  "explanation": "<1-2 frases en español plano, sin jerga>",
  "recommended_action": "<qué hacer, 1 frase>"
}

Criterios:
- "rojo": estafa clara o muy probable. Confidence > 75.
- "amarillo": sospechoso, varias señales, no concluyente. Confidence 40-75.
- "verde": parece legítimo o no hay señales de fraude. Confidence > 75 hacia legítimo.

Sé directo. La gente NO debe segundo-guesar el resultado.
"""


def _heuristic_flags(text: str) -> list[str]:
    """Pre-flags ligeros — agregan señales que Claude puede usar."""
    flags = []
    t = text.lower()
    urgency = ["urgente", "inmediato", "última oportunidad", "tu cuenta será", "bloqueada", "suspendida", "24 horas", "en este momento", "no responder"]
    if any(u in t for u in urgency):
        flags.append("urgencia_artificial")
    sat = ["sat", "cfdi", "buzón tributario", "rfc", "factura cancelada", "requerimiento fiscal"]
    if any(s in t for s in sat):
        flags.append("mencion_sat_cfdi")
    bancos = ["bbva", "banamex", "citibanamex", "santander", "banorte", "hsbc", "banco azteca", "inbursa"]
    if any(b in t for b in bancos):
        flags.append("mencion_banco")
    otp = ["código de verificación", "código sms", "no compartas", "compártenos el código", "otp"]
    if any(o in t for o in otp):
        flags.append("solicitud_otp")
    money = re.search(r"\$\s?\d{2,}[\.,]?\d*\s?(mxn|pesos)?", t)
    if money:
        flags.append("monto_explicito")
    bitly = re.search(r"(bit\.ly|tinyurl|cutt\.ly|t\.co|goo\.gl|is\.gd|short)", t)
    if bitly:
        flags.append("link_acortado")
    return flags


async def analyze(text: str) -> dict:
    if not text or not text.strip():
        return {
            "risk": "verde",
            "confidence": 100,
            "category": "Mensaje vacío",
            "red_flags": [],
            "explanation": "No hay contenido que analizar.",
            "recommended_action": "Reenvía el mensaje sospechoso completo.",
        }

    hints = _heuristic_flags(text)
    hints_section = (
        f"\n\nSeñales pre-detectadas por reglas: {', '.join(hints)}." if hints else ""
    )

    user_prompt = (
        f"Mensaje a analizar (entre <<<>>>):\n\n<<<\n{text.strip()}\n>>>"
        f"{hints_section}\n\n"
        f"Responde solo con el JSON."
    )

    resp = await client.messages.create(
        model=MODEL,
        max_tokens=600,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    content = resp.content[0].text.strip()
    # Quita posibles fences de markdown
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)

    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        return {
            "risk": "amarillo",
            "confidence": 50,
            "category": "Análisis no concluyente",
            "red_flags": hints,
            "explanation": "No pude analizar el mensaje con certeza. Revisa con cuidado antes de responder.",
            "recommended_action": "Si tienes duda, NO respondas ni hagas clic en links.",
        }

    # Merge heurísticas que Claude pudo haber omitido
    existing = set(result.get("red_flags", []))
    for h in hints:
        readable = {
            "urgencia_artificial": "Lenguaje de urgencia ('urgente', 'bloqueada', '24h')",
            "mencion_sat_cfdi": "Menciona SAT/CFDI/Buzón Tributario",
            "mencion_banco": "Menciona un banco mexicano",
            "solicitud_otp": "Pide código de verificación / OTP",
            "monto_explicito": "Menciona cantidad de dinero específica",
            "link_acortado": "Contiene un link acortado (bit.ly, etc.)",
        }.get(h)
        if readable and readable not in existing:
            result.setdefault("red_flags", []).append(readable)

    return result
