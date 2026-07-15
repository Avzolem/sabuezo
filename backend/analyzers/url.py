"""Analizador de URLs — verifica si un link es phishing usando heurísticas + WHOIS."""
import asyncio
import re
import socket
from datetime import datetime, timezone
from urllib.parse import urlparse

import tldextract
import whois

from integrations import urlscan

# Dominios oficiales mexicanos comunes que se suplantan
LEGIT_BRANDS = {
    "bbva": ["bbva.mx", "bbva.com"],
    "banamex": ["banamex.com", "citibanamex.com"],
    "citibanamex": ["citibanamex.com"],
    "santander": ["santander.com.mx", "santander.mx"],
    "banorte": ["banorte.com"],
    "hsbc": ["hsbc.com.mx"],
    "azteca": ["bancoazteca.com.mx"],
    "inbursa": ["inbursa.com"],
    "sat": ["sat.gob.mx"],
    "mercadolibre": ["mercadolibre.com.mx", "mercadolibre.com"],
    "mercadopago": ["mercadopago.com.mx", "mercadopago.com"],
    "amazon": ["amazon.com.mx", "amazon.com"],
    "fedex": ["fedex.com"],
    "dhl": ["dhl.com"],
    "estafeta": ["estafeta.com"],
    "cfe": ["cfe.mx"],
    "telmex": ["telmex.com"],
}

SUSPICIOUS_TLDS = {".xyz", ".top", ".click", ".link", ".tk", ".ml", ".ga", ".cf", ".gq", ".buzz"}


def _levenshtein(a: str, b: str) -> int:
    if len(a) < len(b):
        return _levenshtein(b, a)
    if len(b) == 0:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        cur = [i + 1]
        for j, cb in enumerate(b):
            cur.append(min(prev[j + 1] + 1, cur[j] + 1, prev[j] + (ca != cb)))
        prev = cur
    return prev[-1]


def _check_typosquatting(domain: str) -> tuple[str | None, int | None]:
    """Si parece imitar una marca conocida, devuelve (marca, distancia)."""
    domain_lower = domain.lower()
    for brand, legit_list in LEGIT_BRANDS.items():
        if domain_lower in legit_list:
            return None, None  # es la URL real
        # contiene el nombre de la marca
        if brand in domain_lower and not any(domain_lower == legit for legit in legit_list):
            for legit in legit_list:
                base = legit.split(".")[0]
                dist = _levenshtein(domain_lower.split(".")[0], base)
                if 0 < dist <= 3:
                    return brand, dist
            return brand, 99
    return None, None


def _normalize_url(u: str) -> str:
    u = u.strip()
    if not u.startswith(("http://", "https://")):
        u = "http://" + u
    return u


async def analyze(raw_url: str) -> dict:
    url = _normalize_url(raw_url)
    parsed = urlparse(url)
    host = parsed.hostname or ""
    ext = tldextract.extract(host)
    full_domain = f"{ext.domain}.{ext.suffix}" if ext.suffix else ext.domain

    flags: list[str] = []
    risk = "verde"
    confidence = 60
    category = "URL analizada"

    # 1. TLD sospechoso
    tld = "." + ext.suffix if ext.suffix else ""
    if tld in SUSPICIOUS_TLDS:
        flags.append(f"TLD sospechoso ({tld}) usado frecuentemente en phishing")
        risk = "amarillo"

    # 2. HTTP en lugar de HTTPS
    if parsed.scheme == "http":
        flags.append("No usa HTTPS (sin cifrado)")
        if risk == "verde":
            risk = "amarillo"

    # 3. IP en lugar de dominio
    if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", host):
        flags.append("La URL usa una IP en vez de un nombre de dominio (señal de phishing)")
        risk = "rojo"
        confidence = 90

    # 4. Subdominios sospechosos largos
    if host.count(".") >= 4:
        flags.append("Muchos subdominios anidados (técnica para esconder dominio real)")
        if risk == "verde":
            risk = "amarillo"

    # 5. Caracteres engañosos
    if re.search(r"[0-9]", ext.domain) and any(c in ext.domain for c in "lo"):
        # mezcla de letras 'l/o' con números '1/0' (clásico)
        if re.search(r"[10]", ext.domain):
            flags.append("El dominio mezcla letras y números similares (técnica de suplantación)")
            risk = "rojo"

    if "-" in ext.domain and ext.domain.count("-") >= 2:
        flags.append("Dominio con múltiples guiones (señal común en phishing)")
        if risk == "verde":
            risk = "amarillo"

    # 6. Typosquatting de marcas conocidas
    brand, dist = _check_typosquatting(full_domain)
    if brand and dist:
        flags.append(f"Parece imitar a {brand.upper()} pero NO es su dominio oficial")
        category = f"Posible suplantación de {brand.upper()}"
        risk = "rojo"
        confidence = max(confidence, 92)

    # 7. WHOIS — edad del dominio.
    # La llamada de python-whois es SÍNCRONA y bloqueante (I/O de red), y esta
    # función corre en el event loop de uvicorn. Se ejecuta en un executor y con
    # timeout para no congelar TODAS las requests. Si expira o falla, degrada a
    # domain_age_days=None sin romper el resto del análisis.
    domain_age_days = None
    try:
        if ext.suffix:
            loop = asyncio.get_event_loop()
            w = await asyncio.wait_for(
                loop.run_in_executor(None, whois.whois, full_domain),
                timeout=6,
            )
            created = w.creation_date
            if isinstance(created, list):
                created = created[0]
            if isinstance(created, datetime):
                now = datetime.now(timezone.utc) if created.tzinfo else datetime.now()
                domain_age_days = (now - created).days
                if domain_age_days < 60:
                    flags.append(f"Dominio recién creado ({domain_age_days} días)")
                    if risk == "verde":
                        risk = "amarillo"
                    elif risk == "amarillo":
                        risk = "rojo"
    except (asyncio.TimeoutError, Exception):
        domain_age_days = None

    # 8. URLScan.io — inteligencia colectiva (falla suave, no bloquea el resto)
    urlscan_screenshot = None
    try:
        us = await urlscan.lookup_domain(full_domain)
        if us.get("ok") and us.get("malicious", 0) > 0:
            flags.append(
                f"La comunidad de URLScan.io ya marcó este dominio como malicioso "
                f"({us['malicious']} de {us['total']} análisis recientes)"
            )
            risk = "rojo"
            confidence = max(confidence, 95)
            category = category if category != "URL analizada" else "Dominio reportado como malicioso"
            urlscan_screenshot = us.get("screenshot")
    except Exception:
        pass

    # Construye explicación
    if risk == "rojo":
        explanation = "Este link tiene señales fuertes de ser una estafa. NO hagas clic."
        action = "No abras el link. Si lo recibiste de un contacto, verifica con esa persona por otro medio."
    elif risk == "amarillo":
        explanation = "Este link tiene señales sospechosas. Procede con mucho cuidado."
        action = "No introduzcas datos personales ni credenciales en esta página."
    else:
        explanation = "No detecté señales claras de fraude en este link, pero siempre verifica antes de poner credenciales."
        action = "Si llegas a una página de login, verifica que la URL sea la oficial."

    return {
        "risk": risk,
        "confidence": confidence,
        "category": category,
        "red_flags": flags,
        "explanation": explanation,
        "recommended_action": action,
        "metadata": {
            "domain": full_domain,
            "domain_age_days": domain_age_days,
            "uses_https": parsed.scheme == "https",
            "urlscan_screenshot": urlscan_screenshot,
        },
    }
