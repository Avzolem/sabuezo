"""Genera OG image usando v2a (sabueso detective con hat).

Extrae solo el perrito (no el wordmark "SABUEZO" que ya tiene v2a),
y lo compone con texto a la izquierda al estilo del branding.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
V2A = Path("/tmp/sabuezo-logos/v2a.png")
APP = ROOT / "frontend/app"
AMBER = (245, 158, 11)


def load_font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    for c in candidates:
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def extract_dog_only(src_path: Path) -> Image.Image:
    """De v2a, devuelve solo el perro (sin el wordmark SABUEZO) con bg transparente.

    Estrategia: detectar el gap horizontal grande entre el perro y el texto.
    Si no hay gap claro, corte fijo a 60% de la altura total.
    """
    img = Image.open(src_path).convert("RGB")
    arr = np.array(img)
    H, W, _ = arr.shape

    mask = (arr[:, :, 0] > 130) & (arr[:, :, 1] > 80) & (arr[:, :, 2] < 90)
    row_counts = mask.sum(axis=1)

    nonzero_rows = np.where(row_counts > 5)[0]
    if len(nonzero_rows) == 0:
        raise RuntimeError("No amber found")
    top = int(nonzero_rows[0])

    # Buscar el gap MÁS LARGO de filas <=5 pixels amber entre dog y wordmark
    # (no necesariamente 0, porque puede haber antialiasing residual)
    threshold = 5
    in_gap = False
    gap_start = None
    best_gap = (0, 0, 0)  # (length, start, end)
    for i in range(top, H):
        is_empty = row_counts[i] <= threshold
        if is_empty and not in_gap:
            in_gap = True
            gap_start = i
        elif not is_empty and in_gap:
            gap_len = i - gap_start
            if gap_len > best_gap[0]:
                best_gap = (gap_len, gap_start, i)
            in_gap = False
    # Cierre si la imagen termina en gap
    if in_gap and gap_start is not None:
        gap_len = H - gap_start
        if gap_len > best_gap[0]:
            best_gap = (gap_len, gap_start, H)

    # Si el gap más largo es >30px y está antes del 70% bottom, lo usamos
    if best_gap[0] > 30 and best_gap[1] < int(H * 0.75):
        dog_end = best_gap[1]
        print(f"Gap detected: {best_gap[0]}px between dog and wordmark at row {dog_end}")
    else:
        # Fallback: corte fijo al 60% superior
        dog_end = int(H * 0.60)
        print(f"No clear gap, cropping at 60% = row {dog_end}")

    print(f"Dog cropped: rows {top} to {dog_end} ({dog_end - top}px tall)")
    dog_crop = img.crop((0, top, W, dog_end))

    # Convert to RGBA con transparencia
    dog_arr = np.array(dog_crop)
    dh, dw, _ = dog_arr.shape
    dog_mask = (dog_arr[:, :, 0] > 130) & (dog_arr[:, :, 1] > 80) & (dog_arr[:, :, 2] < 90)
    rgba = np.zeros((dh, dw, 4), dtype=np.uint8)
    rgba[dog_mask] = [*AMBER, 255]
    out = Image.fromarray(rgba, "RGBA")

    # Trim al bounding box horizontal
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)

    return out


def make_og():
    W, H = 1200, 630
    bg = Image.new("RGBA", (W, H), (10, 10, 11, 255))

    # Glow ámbar arriba-izquierda
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([-200, -300, 700, 500], fill=(245, 158, 11, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    bg = Image.alpha_composite(bg, glow)

    # Grid sutil
    line = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(line)
    for x in range(0, W, 80):
        ld.line([(x, 0), (x, H)], fill=(255, 255, 255, 8), width=1)
    for y in range(0, H, 80):
        ld.line([(0, y), (W, y)], fill=(255, 255, 255, 8), width=1)
    bg = Image.alpha_composite(bg, line)

    # Sabueso detective de v2a, a la derecha
    dog = extract_dog_only(V2A)
    dog.thumbnail((460, 460), Image.LANCZOS)
    dog_x = W - dog.width - 80
    dog_y = (H - dog.height) // 2
    bg.paste(dog, (dog_x, dog_y), dog)

    d = ImageDraw.Draw(bg)

    # Pill badge
    badge_font = load_font(22)
    badge_text = "·   HECHO EN MÉXICO PARA PyMEs"
    pad_x, pad_y = 22, 12
    bx0, by0 = 80, 95
    tw = d.textlength(badge_text, font=badge_font)
    badge_w = tw + pad_x * 2
    badge_h = 44
    d.rounded_rectangle(
        [bx0, by0, bx0 + badge_w, by0 + badge_h],
        radius=22,
        fill=(245, 158, 11, 40),
        outline=(245, 158, 11, 180),
        width=2,
    )
    d.text((bx0 + pad_x, by0 + pad_y - 2), badge_text, fill=(252, 211, 77, 255), font=badge_font)

    # Título
    title_font = load_font(92)
    d.text((80, 170), "Sabuezo", fill=(255, 255, 255, 255), font=title_font)

    # Subtítulo
    sub_font = load_font(48)
    d.text((80, 285), "Protección anti-estafa", fill=(228, 228, 231, 255), font=sub_font)
    d.text((80, 345), "para tu PyME", fill=(245, 158, 11, 255), font=sub_font)

    # Tagline
    tag_font = load_font(23)
    d.text((80, 450), "Bot WhatsApp anti-fraude", fill=(161, 161, 170, 255), font=tag_font)
    d.text((80, 482), "+ diagnóstico de seguridad de tu sitio", fill=(161, 161, 170, 255), font=tag_font)

    # URL
    url_font = load_font(22)
    d.text((80, 535), "sabuezo.com", fill=(245, 158, 11, 255), font=url_font)

    flat = Image.new("RGB", (W, H), (10, 10, 11))
    flat.paste(bg, (0, 0), bg)
    out_path = APP / "opengraph-image.png"
    flat.save(out_path, "PNG", optimize=True)
    flat.save(APP / "twitter-image.png", "PNG", optimize=True)
    print(f"✓ {out_path}")

    # Copy to Downloads
    import shutil
    downloads = Path("/mnt/c/Users/avsolem/Downloads/sabuezo-logos/v2a-opengraph.png")
    shutil.copy(out_path, downloads)
    print(f"✓ Copiado a {downloads}")


if __name__ == "__main__":
    make_og()
