"""Genera favicon + apple-icon + OG image + logo de sitio usando v3.

Fuente: /tmp/sabuezo-logos/v3.png (silueta abstracta de cabeza amber sobre negro)

Output:
  frontend/public/sabuezo-logo.png   (silueta solo amber + transparente, para header)
  frontend/app/icon.png              (512x512, favicon transparente)
  frontend/app/apple-icon.png        (180x180, fondo oscuro)
  frontend/app/opengraph-image.png   (1200x630, OG con texto + ícono)
  frontend/app/twitter-image.png     (idem)
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = Path("/tmp/sabuezo-logos/v3.png")  # icon abstracto amber sobre negro
APP = ROOT / "frontend/app"
PUBLIC = ROOT / "frontend/public"
AMBER = (245, 158, 11)


def extract_amber_transparent(src_path: Path) -> Image.Image:
    """Toma una imagen amber-on-black, devuelve solo el amber con fondo transparente.

    Normaliza TODO el color amber al exacto Tailwind amber-500 #F59E0B (245,158,11)
    para que matchee con los botones del sitio. Preserva antialiasing en los bordes
    interpolando entre amber puro y transparente según la 'cercanía a amber' de cada pixel.
    """
    img = Image.open(src_path).convert("RGB")
    arr = np.array(img).astype(np.float32)
    H, W, _ = arr.shape

    # 'Amber-ness' score: qué tanto se parece a un amber (R alto, G medio, B bajo)
    # Score = R - B (alto cuando es amarillo/amber, bajo cuando es negro o gris)
    score = arr[:, :, 0] - arr[:, :, 2]
    # Normalizamos a 0-1 con threshold para descartar el fondo casi negro
    alpha = np.clip((score - 50) / 150.0, 0, 1)

    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    rgba[:, :, 0] = AMBER[0]
    rgba[:, :, 1] = AMBER[1]
    rgba[:, :, 2] = AMBER[2]
    rgba[:, :, 3] = (alpha * 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def crop_to_content(img: Image.Image, padding: int = 40) -> Image.Image:
    """Recorta al bounding box del contenido + padding."""
    bbox = img.getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    w, h = img.size
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(w, x1 + padding)
    y1 = min(h, y1 + padding)
    return img.crop((x0, y0, x1, y1))


def square_canvas(img: Image.Image, size: int, transparent: bool = True) -> Image.Image:
    """Centra la imagen en un canvas cuadrado."""
    img = img.copy()
    img.thumbnail((size, size), Image.LANCZOS)
    bg = (0, 0, 0, 0) if transparent else (10, 10, 11, 255)
    canvas = Image.new("RGBA", (size, size), bg)
    off = ((size - img.width) // 2, (size - img.height) // 2)
    canvas.paste(img, off, img)
    return canvas


def load_font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for c in candidates:
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def make_site_logo():
    """sabuezo-logo.png + .webp — silueta amber-500 puro, transparente."""
    silhouette = extract_amber_transparent(SRC)
    silhouette = crop_to_content(silhouette, padding=20)
    silhouette.save(PUBLIC / "sabuezo-logo.png", "PNG", optimize=True)
    silhouette.save(PUBLIC / "sabuezo-logo.webp", "WEBP", quality=95, method=6)
    print(f"✓ sabuezo-logo.png + .webp {silhouette.size} (amber-500 exacto)")

    # Versión grande para usar en hero (high-res)
    silhouette_hero = extract_amber_transparent(SRC)
    silhouette_hero = crop_to_content(silhouette_hero, padding=10)
    silhouette_hero.save(PUBLIC / "sabuezo-hero.webp", "WEBP", quality=95, method=6)
    print(f"✓ sabuezo-hero.webp {silhouette_hero.size} (versión grande para hero)")


def make_favicon():
    """icon.png — 512x512 amber + transparente."""
    silhouette = extract_amber_transparent(SRC)
    silhouette = crop_to_content(silhouette, padding=30)
    out = square_canvas(silhouette, 512, transparent=True)
    out.save(APP / "icon.png", "PNG", optimize=True)
    print(f"✓ icon.png 512x512")


def make_apple_icon():
    """apple-icon.png — 180x180 con fondo oscuro."""
    silhouette = extract_amber_transparent(SRC)
    silhouette = crop_to_content(silhouette, padding=30)
    silhouette.thumbnail((140, 140), Image.LANCZOS)
    bg = Image.new("RGBA", (180, 180), (10, 10, 11, 255))
    off = ((180 - silhouette.width) // 2, (180 - silhouette.height) // 2)
    bg.paste(silhouette, off, silhouette)
    bg.save(APP / "apple-icon.png", "PNG", optimize=True)
    print(f"✓ apple-icon.png 180x180")


def make_og_image():
    """opengraph-image.png — texto a la izquierda + ícono v3 a la derecha."""
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

    # Ícono v3 a la derecha
    icon = extract_amber_transparent(SRC)
    icon = crop_to_content(icon, padding=20)
    icon.thumbnail((420, 420), Image.LANCZOS)
    bg.paste(icon, (W - icon.width - 90, (H - icon.height) // 2), icon)

    d = ImageDraw.Draw(bg)

    # Pill badge
    badge_font = load_font(22)
    badge_text = "·   HECHO EN MÉXICO PARA PyMEs"
    pad_x, pad_y = 22, 12
    bx0, by0 = 80, 95
    try:
        tw = d.textlength(badge_text, font=badge_font)
    except AttributeError:
        tw = len(badge_text) * 12
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
    flat.save(APP / "opengraph-image.png", "PNG", optimize=True)
    flat.save(APP / "twitter-image.png", "PNG", optimize=True)
    print(f"✓ opengraph-image.png + twitter-image.png 1200x630")


if __name__ == "__main__":
    if not SRC.exists():
        raise SystemExit(f"No existe {SRC}")
    make_site_logo()
    make_favicon()
    make_apple_icon()
    make_og_image()
    print("\n✅ Assets generados con v3.")
