"""Decodificación de códigos QR en imágenes (anti-quishing).

El 'quishing' es un fraude creciente: el atacante esconde una URL de phishing
dentro de un código QR para evadir los filtros que solo leen texto. Aquí
extraemos el contenido del QR para poder analizar la URL con el flujo normal.

Requiere pyzbar (libzbar0 del sistema) + Pillow. Si faltan, falla suave y
devuelve lista vacía: el análisis de imagen por visión sigue funcionando igual.
"""
from __future__ import annotations

import base64
import io
import re

_URL_RE = re.compile(r"^(https?://|www\.)", re.IGNORECASE)
_BARE_DOMAIN_RE = re.compile(r"^[a-z0-9-]+(\.[a-z0-9-]+)+(/.*)?$", re.IGNORECASE)


def decode_qr(image_base64: str) -> list[str]:
    """Devuelve los payloads de texto de todos los QR en la imagen.

    Lista vacía si no hay QR, si la imagen es inválida, o si falta la
    dependencia (pyzbar/Pillow).
    """
    try:
        from PIL import Image
        from pyzbar.pyzbar import decode
    except Exception:
        return []
    try:
        raw = base64.b64decode(image_base64)
        img = Image.open(io.BytesIO(raw))
        return [r.data.decode("utf-8", "ignore") for r in decode(img) if r.data]
    except Exception:
        return []


def pick_urls(payloads: list[str]) -> list[str]:
    """De los payloads, devuelve los que parecen URLs (http(s), www o dominio)."""
    urls: list[str] = []
    for p in payloads:
        s = (p or "").strip()
        if not s:
            continue
        if _URL_RE.match(s) or _BARE_DOMAIN_RE.match(s):
            urls.append(s)
    return urls
