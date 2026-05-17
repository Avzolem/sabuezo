"""Genera un screenshot sintético de phishing, lo manda al /analyze/image, y valida.

Crea una imagen que simula una notificación falsa de BBVA por SMS/WhatsApp,
la base64-encodea, POST a /analyze/image con token interno, e imprime el resultado.
"""
import base64
import io
import json
import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import asyncpg
import asyncio
import httpx


def make_fake_screenshot() -> bytes:
    """Crea una imagen 600x500 simulando alerta SMS falsa de BBVA."""
    W, H = 600, 500
    img = Image.new("RGB", (W, H), (245, 245, 247))  # iOS message bg
    d = ImageDraw.Draw(img)

    # Header BBVA falso
    d.rectangle([0, 0, W, 80], fill=(0, 70, 140))  # azul BBVA-ish
    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30)
        body_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
        small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    except Exception:
        title_font = body_font = small_font = ImageFont.load_default()

    d.text((25, 25), "BBVA Mexico", fill=(255, 255, 255), font=title_font)
    d.text((W - 110, 35), "Hoy 09:15", fill=(200, 220, 240), font=small_font)

    # Cuerpo SMS
    d.rounded_rectangle(
        [25, 110, W - 25, 320],
        radius=18,
        fill=(255, 255, 255),
        outline=(220, 220, 230),
        width=1,
    )
    body_lines = [
        "BBVA: ALERTA DE SEGURIDAD",
        "",
        "Detectamos un acceso sospechoso a su",
        "cuenta desde Bogota. Si no fue usted,",
        "verifique de inmediato su identidad o",
        "su cuenta sera BLOQUEADA en 24h.",
        "",
        "Verifique aqui:",
    ]
    y = 130
    for line in body_lines:
        d.text((45, y), line, fill=(30, 30, 30), font=body_font)
        y += 28

    # URL fake en azul
    d.text((45, y + 8), "http://bbva-segurid4d.com/verifica", fill=(0, 110, 220), font=body_font)

    # Footer "urgente"
    d.rounded_rectangle(
        [25, 360, W - 25, 440],
        radius=14,
        fill=(255, 235, 235),
        outline=(220, 60, 60),
        width=2,
    )
    d.text((45, 378), "⚠ URGENTE - RESPONDA EN 24h", fill=(180, 30, 30), font=body_font)
    d.text((45, 408), "Su acceso sera revocado automaticamente.", fill=(120, 30, 30), font=small_font)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


async def main():
    api_base = os.environ.get("API_BASE", "http://localhost:8787")
    token = os.environ.get("INTERNAL_API_TOKEN")
    if not token:
        # Try reading from .env
        env = Path("/home/avsolem/sabuezo/.env").read_text() if Path("/home/avsolem/sabuezo/.env").exists() else ""
        for line in env.splitlines():
            if line.startswith("INTERNAL_API_TOKEN="):
                token = line.split("=", 1)[1].strip()
                break
    if not token:
        print("ERROR: no INTERNAL_API_TOKEN", file=sys.stderr)
        sys.exit(1)

    # 1. Genera la imagen
    img_bytes = make_fake_screenshot()
    Path("/tmp/sabuezo-test-phish.jpg").write_bytes(img_bytes)
    print(f"✓ Imagen generada ({len(img_bytes)} bytes) → /tmp/sabuezo-test-phish.jpg")

    # 2. Base64 + POST
    b64 = base64.b64encode(img_bytes).decode()
    print(f"\n→ POST {api_base}/analyze/image ...")
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{api_base}/analyze/image",
            headers={"Content-Type": "application/json", "x-internal-token": token},
            json={
                "user_id": "image-test-user@lid",
                "image_base64": b64,
                "caption": "Test sintético de pipeline visión",
                "pushname": "ImageTester",
            },
        )
    print(f"← HTTP {r.status_code}")
    result = r.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))

    # 3. Verifica persistencia en DB
    pwd = os.environ.get("SUPABASE_DB_PASSWORD")
    if pwd:
        print("\n→ verificando persistencia en Supabase...")
        c = await asyncpg.connect(
            host="db.yxchclzczusogzfpqyir.supabase.co",
            user="postgres",
            password=pwd,
            database="postgres",
            ssl="require",
        )
        row = await c.fetchrow(
            "select id, kind, risk, category, pushname from phishing_detections where user_jid = 'image-test-user@lid' order by created_at desc limit 1"
        )
        if row:
            print(f"✓ Persistido: kind={row['kind']}  risk={row['risk']}  category={row['category']}")
        else:
            print("✗ No se encontró registro en DB")
        await c.close()


asyncio.run(main())
