"""Scanner de seguridad para sitios de PyMEs.

Hace checks pasivos (no ofensivos) en paralelo:
- SSL/TLS (validez + expiración)
- Security headers (HSTS, CSP, X-Frame, etc.)
- SPF / DKIM / DMARC (email auth)
- CMS fingerprint
- Paths sensibles expuestos
- Edad del dominio (WHOIS)

Devuelve score 0-100 + lista de findings con severidad y cómo arreglar.
"""
import asyncio
import ssl
import socket
import re
from datetime import datetime, timezone
from urllib.parse import urlparse, urljoin
from typing import Optional

import httpx
import dns.resolver
import dns.exception
import tldextract
import whois as whois_lib

DNS_TIMEOUT = 4.0
HTTP_TIMEOUT = 8.0

# Selectores DKIM comunes que probamos
COMMON_DKIM_SELECTORS = ["default", "google", "k1", "selector1", "selector2", "mail", "smtp", "dkim"]

SENSITIVE_PATHS = [
    "/.env",
    "/.git/HEAD",
    "/.git/config",
    "/wp-admin/",
    "/wp-config.php.bak",
    "/admin/",
    "/phpmyadmin/",
    "/phpinfo.php",
    "/backup.zip",
    "/backup.sql",
    "/database.sql",
    "/config.php",
    "/.htaccess",
    "/.DS_Store",
    "/server-status",
]


def _normalize_url(u: str) -> tuple[str, str]:
    """Devuelve (url_completa_https, dominio_limpio)."""
    u = u.strip()
    if not u.startswith(("http://", "https://")):
        u = "https://" + u
    parsed = urlparse(u)
    ext = tldextract.extract(parsed.hostname or "")
    domain = f"{ext.domain}.{ext.suffix}" if ext.suffix else (parsed.hostname or "")
    return u, domain


async def check_ssl(hostname: str, port: int = 443) -> dict:
    """Conexión SSL: validez del cert y días hasta expirar."""
    loop = asyncio.get_running_loop()

    def _sync():
        ctx = ssl.create_default_context()
        with socket.create_connection((hostname, port), timeout=6) as sock:
            with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                return cert

    try:
        cert = await loop.run_in_executor(None, _sync)
        not_after = cert.get("notAfter")
        if not not_after:
            return {"ok": True, "warning": "Sin fecha de expiración legible"}
        expiry = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        days_left = (expiry - datetime.now(timezone.utc)).days
        issuer = dict(x[0] for x in cert.get("issuer", []))
        return {
            "ok": True,
            "days_to_expiry": days_left,
            "expiry": expiry.isoformat(),
            "issuer": issuer.get("organizationName", "desconocido"),
        }
    except ssl.SSLCertVerificationError as e:
        return {"ok": False, "error": f"Certificado inválido: {e}"}
    except (socket.gaierror, socket.timeout, ConnectionRefusedError, OSError) as e:
        return {"ok": False, "error": f"No se pudo conectar por HTTPS: {e}"}


_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
_BROWSER_HEADERS = {
    "User-Agent": _BROWSER_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
}


def _detect_challenge(status: int, headers: dict, body: str) -> Optional[str]:
    """Detecta si la respuesta es una página de anti-DDoS / bot challenge.

    Devuelve el nombre del proveedor si la detecta, o None.
    """
    if "x-vercel-challenge-token" in headers or "challenge" in (headers.get("x-vercel-mitigated") or ""):
        return "Vercel Attack Challenge"
    if "challenge" in (headers.get("cf-mitigated") or "") or "cf-chl-bypass" in headers:
        return "Cloudflare Challenge"
    if status == 403:
        body_l = (body or "").lower()
        if "just a moment" in body_l or "checking your browser" in body_l:
            return "Cloudflare Challenge"
        if "vercel security" in body_l:
            return "Vercel Attack Challenge"
    return None


async def check_headers(url: str) -> dict:
    """Verifica headers de seguridad HTTP."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=HTTP_TIMEOUT, verify=False) as client:
            r = await client.get(url, headers=_BROWSER_HEADERS)
            h = {k.lower(): v for k, v in r.headers.items()}
            body = r.text if "text/html" in h.get("content-type", "") else ""
            challenge = _detect_challenge(r.status_code, h, body)
            return {
                "final_url": str(r.url),
                "status": r.status_code,
                "challenge_protected": challenge,
                "hsts": h.get("strict-transport-security"),
                "csp": h.get("content-security-policy"),
                "x_frame_options": h.get("x-frame-options"),
                "x_content_type_options": h.get("x-content-type-options"),
                "referrer_policy": h.get("referrer-policy"),
                "permissions_policy": h.get("permissions-policy"),
                "server": h.get("server"),
                "x_powered_by": h.get("x-powered-by"),
                "html_snippet": body[:6000],
            }
    except Exception as e:
        return {"error": str(e)}


async def _resolve_txt(name: str) -> list[str]:
    loop = asyncio.get_running_loop()

    def _sync():
        resolver = dns.resolver.Resolver()
        resolver.timeout = DNS_TIMEOUT
        resolver.lifetime = DNS_TIMEOUT
        try:
            answers = resolver.resolve(name, "TXT")
            out = []
            for r in answers:
                txt = "".join(s.decode() if isinstance(s, bytes) else s for s in r.strings)
                out.append(txt)
            return out
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.exception.Timeout, dns.resolver.NoNameservers):
            return []

    return await loop.run_in_executor(None, _sync)


async def check_email_auth(domain: str) -> dict:
    """SPF + DMARC + DKIM básico."""
    txts, dmarc_txts = await asyncio.gather(
        _resolve_txt(domain),
        _resolve_txt(f"_dmarc.{domain}"),
    )

    spf = next((t for t in txts if t.lower().startswith("v=spf1")), None)
    dmarc = next((t for t in dmarc_txts if t.lower().startswith("v=dmarc1")), None)

    # DMARC policy
    dmarc_policy = None
    if dmarc:
        m = re.search(r"\bp\s*=\s*(none|quarantine|reject)", dmarc, re.I)
        dmarc_policy = m.group(1).lower() if m else None

    # DKIM — probar selectores comunes (más estricto para evitar falsos positivos)
    dkim_found = []
    for sel in COMMON_DKIM_SELECTORS[:5]:
        try:
            recs = await _resolve_txt(f"{sel}._domainkey.{domain}")
            for r in recs:
                r_low = r.lower().replace(" ", "")
                if "v=dkim1" in r_low and ("p=" in r_low or "k=rsa" in r_low):
                    dkim_found.append(sel)
                    break
        except Exception:
            pass

    return {
        "spf": spf,
        "spf_present": spf is not None,
        "dmarc": dmarc,
        "dmarc_present": dmarc is not None,
        "dmarc_policy": dmarc_policy,
        "dkim_selectors_found": dkim_found,
    }


def _fingerprint_cms(headers: dict, html: str) -> dict:
    html_l = html.lower()
    server = (headers.get("server") or "").lower()
    powered = (headers.get("x_powered_by") or "").lower()

    if "wp-content" in html_l or "wp-includes" in html_l or "wp-json" in html_l:
        # Intenta extraer versión de wordpress
        m = re.search(r'<meta name="generator" content="wordpress\s*([\d.]+)?', html_l)
        version = m.group(1) if m else None
        return {"cms": "WordPress", "version": version}
    if "wix.com" in html_l or "x-wix-request-id" in str(headers).lower():
        return {"cms": "Wix", "version": None}
    if "cdn.shopify.com" in html_l or "shopify" in powered:
        return {"cms": "Shopify", "version": None}
    if "drupal" in html_l or "drupal" in powered:
        return {"cms": "Drupal", "version": None}
    if "joomla" in html_l:
        return {"cms": "Joomla", "version": None}
    if "<!-- This is Squarespace" in html or "squarespace" in html_l:
        return {"cms": "Squarespace", "version": None}
    if "next.js" in powered or '"buildId":' in html:
        return {"cms": "Next.js", "version": None}
    if "express" in powered:
        return {"cms": "Express/Node", "version": None}
    return {"cms": "Desconocido", "version": None}


async def check_exposed_paths(base_url: str) -> dict:
    """Probe paths sensibles con HEAD."""
    parsed = urlparse(base_url)
    root = f"{parsed.scheme}://{parsed.hostname}"

    async def _probe(client, path):
        try:
            r = await client.get(urljoin(root, path), follow_redirects=False, timeout=4)
            return path, r.status_code, len(r.content)
        except Exception:
            return path, None, 0

    async with httpx.AsyncClient(verify=False, headers={"User-Agent": "Sabuezo/0.1"}) as client:
        results = await asyncio.gather(*(_probe(client, p) for p in SENSITIVE_PATHS))

    exposed = []
    for path, status, size in results:
        if status == 200 and size > 0:
            exposed.append({"path": path, "status": status, "size": size, "severity": "high"})
        elif status == 403:
            # Existe pero protegido — todavía revela info
            exposed.append({"path": path, "status": status, "size": size, "severity": "low"})
    return {"exposed": exposed, "probed": len(SENSITIVE_PATHS)}


async def check_domain_age(domain: str) -> dict:
    loop = asyncio.get_running_loop()

    def _sync():
        try:
            w = whois_lib.whois(domain)
            created = w.creation_date
            if isinstance(created, list):
                created = created[0]
            if isinstance(created, datetime):
                now = datetime.now(timezone.utc) if created.tzinfo else datetime.now()
                days = (now - created).days
                return {"created": created.isoformat(), "age_days": days}
        except Exception:
            pass
        return {"created": None, "age_days": None}

    return await loop.run_in_executor(None, _sync)


def _build_findings(url: str, domain: str, ssl_r: dict, hdr: dict, mail: dict, cms: dict, exposed: dict, age: dict) -> list[dict]:
    findings = []

    # --- HTTPS / SSL ---
    if not ssl_r.get("ok"):
        findings.append({
            "id": "ssl_unavailable",
            "severity": "critical",
            "title": "Tu sitio no tiene HTTPS funcional",
            "description": f"No pudimos establecer conexión cifrada con tu dominio. {ssl_r.get('error','')}",
            "fix": "Instala un certificado SSL gratuito con Let's Encrypt o pide a tu hosting que lo active.",
            "fix_time_min": 30,
        })
    else:
        days = ssl_r.get("days_to_expiry")
        if days is not None and days < 14:
            findings.append({
                "id": "ssl_expiring",
                "severity": "high",
                "title": f"Tu certificado SSL expira en {days} días",
                "description": "Cuando expire, los visitantes verán una advertencia roja y huirán.",
                "fix": "Renueva el certificado con tu hosting. Si usas Let's Encrypt, configura renovación automática.",
                "fix_time_min": 20,
            })

    # --- Anti-DDoS challenge: no podemos auditar los headers reales ---
    challenge = hdr.get("challenge_protected")
    if challenge:
        findings.append({
            "id": "challenge_protected",
            "severity": "info",
            "title": f"Sitio protegido por anti-DDoS ({challenge})",
            "description": "El sitio bloquea bots con un reto previo, así que no pudimos leer los headers de seguridad reales. Tus visitantes en navegador sí los reciben.",
            "fix": "Si quieres una auditoría completa, desactiva temporalmente el modo challenge o consulta los headers desde tu navegador con DevTools → Network → Headers.",
            "fix_time_min": 5,
        })
    else:
        # --- HSTS ---
        if not hdr.get("hsts"):
            findings.append({
                "id": "no_hsts",
                "severity": "medium",
                "title": "Sin HSTS — vulnerables a downgrade a HTTP",
                "description": "Un atacante en la misma red WiFi puede forzar a tus visitantes a usar HTTP y leer su tráfico.",
                "fix": "Agrega el header `Strict-Transport-Security: max-age=31536000; includeSubDomains` en tu servidor.",
                "fix_time_min": 10,
            })

        # --- X-Frame-Options ---
        if not hdr.get("x_frame_options") and not hdr.get("csp"):
            findings.append({
                "id": "no_xframe",
                "severity": "medium",
                "title": "Sitio vulnerable a clickjacking",
                "description": "Un atacante puede embeber tu sitio en un iframe invisible y engañar a tus clientes para que hagan clics que no quieren.",
                "fix": "Agrega `X-Frame-Options: SAMEORIGIN` o una política CSP `frame-ancestors`.",
                "fix_time_min": 5,
            })

        # --- CSP ---
        if not hdr.get("csp"):
            findings.append({
                "id": "no_csp",
                "severity": "low",
                "title": "Sin Content-Security-Policy",
                "description": "No tienes protección contra inyección de scripts maliciosos en tu sitio.",
                "fix": "Define una política CSP. Empieza con `default-src 'self'`.",
                "fix_time_min": 30,
            })

    # --- EMAIL AUTH — la pieza mágica ---
    if not mail.get("spf_present"):
        findings.append({
            "id": "no_spf",
            "severity": "critical",
            "title": "Cualquiera puede enviar correos pretendiendo ser tu empresa",
            "description": (
                f"Tu dominio {domain} no tiene registro SPF. Eso significa que un atacante puede mandar "
                "correos que parecen venir de tus direcciones oficiales — perfecto para estafar a tus "
                "clientes, proveedores y empleados."
            ),
            "fix": (
                f"Agrega este registro TXT a tu DNS:\n"
                f"`{domain}.  TXT  \"v=spf1 include:_spf.google.com -all\"`\n"
                f"(ajusta `include:` según tu proveedor de correo)"
            ),
            "fix_time_min": 15,
        })

    if not mail.get("dmarc_present"):
        findings.append({
            "id": "no_dmarc",
            "severity": "high",
            "title": "Sin DMARC — sin protección contra suplantación de correo",
            "description": (
                "DMARC le dice al mundo qué hacer con correos que finjan venir de tu dominio. Sin DMARC, "
                "los correos falsos llegan sin filtro a tus clientes."
            ),
            "fix": (
                f"Agrega este registro TXT a tu DNS:\n"
                f"`_dmarc.{domain}.  TXT  \"v=DMARC1; p=quarantine; rua=mailto:dmarc@{domain}\"`"
            ),
            "fix_time_min": 15,
        })
    elif mail.get("dmarc_policy") == "none":
        findings.append({
            "id": "dmarc_p_none",
            "severity": "medium",
            "title": "DMARC en modo monitor — no bloquea suplantaciones",
            "description": (
                "Tienes DMARC pero con política `p=none`, que solo observa. Los correos falsos pretendiendo "
                "ser de tu dominio siguen pasando."
            ),
            "fix": "Cuando estés seguro de que el SPF/DKIM están bien, sube la política a `p=quarantine` y luego `p=reject`.",
            "fix_time_min": 5,
        })

    if not mail.get("dkim_selectors_found"):
        findings.append({
            "id": "no_dkim",
            "severity": "medium",
            "title": "No detectamos DKIM en selectores comunes",
            "description": (
                "DKIM firma criptográficamente tus correos para que el receptor verifique que son tuyos. "
                "Sin DKIM, el SPF y DMARC son más débiles."
            ),
            "fix": "Configura DKIM en tu proveedor de correo (Google Workspace, Microsoft 365, etc.). Suele ser un wizard de 5 minutos.",
            "fix_time_min": 15,
        })

    # --- CMS ---
    if cms.get("cms") == "WordPress":
        findings.append({
            "id": "wordpress",
            "severity": "info",
            "title": f"Tu sitio usa WordPress{(' ' + cms['version']) if cms.get('version') else ''}",
            "description": "WordPress es el CMS más atacado del mundo. Mantén core, temas y plugins actualizados.",
            "fix": "Activa actualizaciones automáticas. Borra plugins/temas que no uses. Usa autenticación de 2 factores en wp-admin.",
            "fix_time_min": 30,
        })

    # --- Paths expuestos ---
    for e in exposed.get("exposed", []):
        if e["severity"] == "high":
            findings.append({
                "id": f"exposed_{e['path'].strip('/').replace('/','_').replace('.','_')}",
                "severity": "critical",
                "title": f"Archivo sensible expuesto: {e['path']}",
                "description": f"El archivo `{e['path']}` es accesible públicamente. Puede contener credenciales, configuración o backup de tu base de datos.",
                "fix": f"Bloquea el acceso a `{e['path']}` en tu servidor (nginx/.htaccess) o bórralo si no lo necesitas.",
                "fix_time_min": 10,
            })

    # --- Edad de dominio (informativo) ---
    age_days = age.get("age_days")
    if age_days is not None:
        age_days = max(0, age_days)  # clamp por race UTC
        if age_days < 90:
            findings.append({
                "id": "domain_new",
                "severity": "info",
                "title": f"Tu dominio tiene solo {age_days} días de antigüedad" if age_days > 0 else "Tu dominio fue registrado hoy",
                "description": "Los dominios muy nuevos a veces se filtran como spam. Si recibes quejas, conserva el dominio actual a largo plazo para construir reputación.",
                "fix": "Configura SPF/DKIM/DMARC correctamente y envía correos consistentes desde el mismo dominio.",
                "fix_time_min": 0,
            })

    return findings


def _compute_score(findings: list[dict]) -> int:
    score = 100
    weights = {"critical": -25, "high": -15, "medium": -8, "low": -4, "info": 0}
    for f in findings:
        score += weights.get(f["severity"], 0)
    return max(0, min(100, score))


def _exec_summary(score: int, findings: list[dict], domain: str) -> str:
    crit = [f for f in findings if f["severity"] == "critical"]
    high = [f for f in findings if f["severity"] == "high"]

    if score >= 85:
        verdict = "Tu sitio está bien protegido. Sigue así."
    elif score >= 65:
        verdict = "Hay mejoras importantes que puedes hacer hoy."
    elif score >= 40:
        verdict = "Tu sitio tiene varias puertas abiertas a atacantes. Prioriza arreglarlas."
    else:
        verdict = "Tu sitio está expuesto. Necesitas atención urgente."

    parts = [verdict]
    if crit:
        parts.append(f"{len(crit)} hallazgos críticos.")
    if high:
        parts.append(f"{len(high)} hallazgos importantes.")
    return " ".join(parts)


async def scan(url: str, owner_email: Optional[str] = None) -> dict:
    """Ejecuta todos los checks en paralelo."""
    full_url, domain = _normalize_url(url)
    parsed = urlparse(full_url)
    hostname = parsed.hostname or domain

    ssl_r, hdr, mail, exposed, age = await asyncio.gather(
        check_ssl(hostname),
        check_headers(full_url),
        check_email_auth(domain),
        check_exposed_paths(full_url),
        check_domain_age(domain),
    )

    html = hdr.get("html_snippet", "") if isinstance(hdr, dict) else ""
    cms = _fingerprint_cms(hdr if isinstance(hdr, dict) else {}, html) if hdr and "error" not in hdr else {"cms": "Desconocido", "version": None}

    findings = _build_findings(full_url, domain, ssl_r, hdr, mail, cms, exposed, age)
    score = _compute_score(findings)
    summary = _exec_summary(score, findings, domain)

    # Ordena: critical → high → medium → low → info
    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    findings.sort(key=lambda f: sev_order.get(f["severity"], 99))

    return {
        "url": full_url,
        "domain": domain,
        "score": score,
        "summary": summary,
        "findings": findings,
        "raw": {
            "ssl": ssl_r,
            "headers_present": {
                k: bool(hdr.get(k)) if isinstance(hdr, dict) else None
                for k in ["hsts", "csp", "x_frame_options", "x_content_type_options", "referrer_policy"]
            },
            "email_auth": mail,
            "cms": cms,
            "exposed_paths": exposed.get("exposed", []) if isinstance(exposed, dict) else [],
            "domain_age_days": age.get("age_days") if isinstance(age, dict) else None,
        },
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    }
