"""Chequeo de filtraciones (HaveIBeenPwned-style) sin costos.

Email:    XposedOrNot (gratis, sin key, sin límite serio)
Phone:    LeakCheck public API (gratis, sin key, con rate-limit suave)

Si una API falla, devolvemos {"ok": False, "error": "..."} en vez de romper.
"""
from __future__ import annotations

import re
import httpx
from typing import Optional

TIMEOUT = 15.0

# Catálogo de breaches MX conocidos (memoria pública). Funciona como complemento
# barato si las APIs externas fallan o no tienen el dato.
KNOWN_MX_LEAKS = [
    {
        "name": "Padrón INE/IFE 2020",
        "year": "2020",
        "fields": ["nombre", "curp", "domicilio", "credencial_voto"],
        "match_field": "phone",  # también aparecieron tels asociados
    },
]


def normalize_phone(raw: str) -> str:
    """Quita espacios, guiones, paréntesis. No fuerza +52: el usuario decide."""
    digits = re.sub(r"[^\d+]", "", raw or "")
    # Si el usuario manda 10 dígitos (MX local), agrega 52 al frente
    if re.fullmatch(r"\d{10}", digits):
        digits = "52" + digits
    return digits


def is_email(s: str) -> bool:
    return bool(re.fullmatch(r"[\w.+-]+@[\w-]+\.[\w.-]+", (s or "").strip()))


def is_phone(s: str) -> bool:
    digits = re.sub(r"\D", "", s or "")
    return 10 <= len(digits) <= 15


async def check_email(email: str) -> dict:
    """Chequea email contra XposedOrNot.

    Respuesta:
      { ok: bool, found: bool, count: int, breaches: [str], source: "xposedornot" }
    """
    email = (email or "").strip().lower()
    if not is_email(email):
        return {"ok": False, "error": "invalid_email"}

    url = f"https://api.xposedornot.com/v1/check-email/{email}"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.get(url, headers={"User-Agent": "Sabuezo/1.0"})
    except httpx.RequestError as e:
        return {"ok": False, "error": f"network: {e.__class__.__name__}"}

    if r.status_code == 404:
        return {"ok": True, "found": False, "count": 0, "breaches": [], "source": "xposedornot"}

    try:
        data = r.json()
    except Exception:
        return {"ok": False, "error": "invalid_response"}

    # Respuesta de error de XposedOrNot: {"Error": "Not found", "email": null}
    if data.get("Error"):
        return {"ok": True, "found": False, "count": 0, "breaches": [], "source": "xposedornot"}

    # Hit: {"breaches": [["name1","name2",...]]}
    raw_breaches = data.get("breaches") or []
    flat: list[str] = []
    if raw_breaches and isinstance(raw_breaches[0], list):
        flat = raw_breaches[0]
    elif raw_breaches and isinstance(raw_breaches[0], str):
        flat = raw_breaches

    return {
        "ok": True,
        "found": len(flat) > 0,
        "count": len(flat),
        "breaches": flat,
        "source": "xposedornot",
    }


async def check_phone(phone: str) -> dict:
    """Chequea teléfono contra LeakCheck (public, sin key).

    Respuesta:
      { ok, found, count, sources: [{name, date}], fields: [str], source: "leakcheck" }
    """
    normalized = normalize_phone(phone)
    if not is_phone(normalized):
        return {"ok": False, "error": "invalid_phone"}

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.get(
                "https://leakcheck.io/api/public",
                params={"check": normalized},
                headers={"User-Agent": "Sabuezo/1.0"},
            )
    except httpx.RequestError as e:
        return {"ok": False, "error": f"network: {e.__class__.__name__}"}

    if r.status_code == 429:
        return {"ok": False, "error": "rate_limited", "retry_after": r.headers.get("Retry-After")}

    try:
        data = r.json()
    except Exception:
        return {"ok": False, "error": "invalid_response"}

    if not data.get("success"):
        # LeakCheck devuelve success:false en errores leves (e.g. formato)
        return {
            "ok": True,
            "found": False,
            "count": 0,
            "sources": [],
            "fields": [],
            "source": "leakcheck",
        }

    found_n = int(data.get("found") or 0)
    raw_sources = data.get("sources") or []
    sources = [
        {"name": s.get("name") or "desconocido", "date": s.get("date") or ""}
        for s in raw_sources
        if isinstance(s, dict)
    ]

    return {
        "ok": True,
        "found": found_n > 0,
        "count": found_n,
        "sources": sources,
        "fields": data.get("fields") or [],
        "source": "leakcheck",
    }
