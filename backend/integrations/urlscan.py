"""Integración con URLScan.io — inteligencia colectiva sobre URLs.

Sin API key (gratis): usa la Search API pública para ver si el dominio ya fue
escaneado por la comunidad y marcado como malicioso. Es una señal de phishing
crowdsourced que complementa nuestras heurísticas locales.

Con URLSCAN_API_KEY (opcional): además somete un scan nuevo, que devuelve
veredicto + screenshot del sitio. Útil para links que nadie ha visto antes.

Toda función falla "suave": devuelve {"ok": False, ...} en vez de romper el
análisis principal.
"""
from __future__ import annotations

import os
import httpx

TIMEOUT = 12.0


def _api_key() -> str | None:
    return os.getenv("URLSCAN_API_KEY") or None


async def lookup_domain(domain: str) -> dict:
    """Busca scans previos del dominio (Search API pública, sin key).

    Devuelve:
      { ok, found, malicious, total, last_url, screenshot }
      - malicious: nº de scans previos con veredicto malicioso de la comunidad
      - screenshot: URL de captura del scan más reciente (si existe)
    """
    if not domain:
        return {"ok": False, "error": "no_domain"}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.get(
                "https://urlscan.io/api/v1/search/",
                params={"q": f'page.domain:"{domain}"', "size": 10},
                headers={"User-Agent": "Sabuezo/1.0"},
            )
    except httpx.RequestError as e:
        return {"ok": False, "error": f"network: {e.__class__.__name__}"}

    if r.status_code != 200:
        return {"ok": False, "error": f"http_{r.status_code}"}

    try:
        data = r.json()
    except Exception:
        return {"ok": False, "error": "invalid_response"}

    results = data.get("results") or []
    malicious = 0
    screenshot = None
    last_url = None
    for res in results:
        verdict = (res.get("verdicts") or {}).get("overall") or {}
        if verdict.get("malicious"):
            malicious += 1
        if screenshot is None and res.get("screenshot"):
            screenshot = res.get("screenshot")
        if last_url is None:
            last_url = (res.get("page") or {}).get("url")

    return {
        "ok": True,
        "found": len(results) > 0,
        "malicious": malicious,
        "total": len(results),
        "last_url": last_url,
        "screenshot": screenshot,
    }


async def submit_scan(url: str) -> dict:
    """Somete un scan nuevo a URLScan.io (requiere URLSCAN_API_KEY).

    No espera el resultado completo (tarda ~10-30s); devuelve el id y la URL
    del reporte, que el sitio puede consultar después. Devuelve
    {"ok": False, "error": "no_api_key"} si no hay key configurada.
    """
    key = _api_key()
    if not key:
        return {"ok": False, "error": "no_api_key"}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(
                "https://urlscan.io/api/v1/scan/",
                headers={"API-Key": key, "Content-Type": "application/json",
                         "User-Agent": "Sabuezo/1.0"},
                json={"url": url, "visibility": "unlisted"},
            )
    except httpx.RequestError as e:
        return {"ok": False, "error": f"network: {e.__class__.__name__}"}

    if r.status_code not in (200, 201):
        return {"ok": False, "error": f"http_{r.status_code}"}

    try:
        data = r.json()
    except Exception:
        return {"ok": False, "error": "invalid_response"}

    return {
        "ok": True,
        "scan_id": data.get("uuid"),
        "report_url": data.get("result"),
        "screenshot": data.get("screenshot"),
    }
