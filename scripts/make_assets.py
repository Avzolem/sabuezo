"""Genera favicon + apple-icon + OG image usando el logo del sabueso detective.

Output:
  frontend/app/icon.png            (512x512, favicon transparente)
  frontend/app/apple-icon.png      (180x180, fondo oscuro)
  frontend/app/opengraph-image.png (1200x630, OG informativo)
  frontend/app/twitter-image.png   (1200x630, Twitter Card)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "frontend/public/sabuezo-logo.png"
APP = ROOT / "frontend/app"


def fit_into(img: Image.Image, size: int) -> Image.Image:
    """Reescala manteniendo aspecto, devuelve imagen del tamaño solicitado (max)."""
    img = img.convert("RGBA").copy()
    img.thumbnail((size, size), Image.LANCZOS)
    return img


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


def make_favicon():
    """icon.png — logo con padding mínimo, transparente."""
    logo = Image.open(LOGO).convert("RGBA")
    out = fit_into(logo, 512)
    # Canvas 512x512 transparente, logo centrado
    canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    off = ((512 - out.width) // 2, (512 - out.height) // 2)
    canvas.paste(out, off, out)
    canvas.save(APP / "icon.png", "PNG", optimize=True)
    print(f"✓ icon.png 512x512 (transparente)")


def make_apple_icon():
    """apple-icon.png — iOS requiere bg sólido. Usamos oscuro como el sitio."""
    logo = Image.open(LOGO).convert("RGBA")
    fg = fit_into(logo, 168)  # margen de 6 px todos lados
    bg = Image.new("RGBA", (180, 180), (10, 10, 11, 255))
    off = ((180 - fg.width) // 2, (180 - fg.height) // 2)
    bg.paste(fg, off, fg)
    bg.save(APP / "apple-icon.png", "PNG", optimize=True)
    print(f"✓ apple-icon.png 180x180 (bg oscuro)")


def make_og_image():
    """opengraph-image.png — canvas oscuro, logo a la derecha, texto a la izquierda."""
    W, H = 1200, 630
    bg = Image.new("RGBA", (W, H), (10, 10, 11, 255))

    # Soft amber glow top-left
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-200, -300, 700, 500], fill=(245, 158, 11, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    bg = Image.alpha_composite(bg, glow)

    # Subtle grid lines
    line = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(line)
    for x in range(0, W, 80):
        ld.line([(x, 0), (x, H)], fill=(255, 255, 255, 8), width=1)
    for y in range(0, H, 80):
        ld.line([(0, y), (W, y)], fill=(255, 255, 255, 8), width=1)
    bg = Image.alpha_composite(bg, line)

    # Sabueso logo a la derecha — más prominente porque tiene mucho carácter
    logo = Image.open(LOGO).convert("RGBA")
    logo = fit_into(logo, 460)
    bg.paste(logo, (W - logo.width - 60, (H - logo.height) // 2), logo)

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

    # Subtítulo 2 líneas
    sub_font = load_font(48)
    d.text((80, 285), "Protección anti-estafa", fill=(228, 228, 231, 255), font=sub_font)
    d.text((80, 345), "para tu PyME", fill=(245, 158, 11, 255), font=sub_font)

    # Tagline
    tag_font = load_font(23)
    d.text(
        (80, 450),
        "Bot WhatsApp anti-fraude",
        fill=(161, 161, 170, 255),
        font=tag_font,
    )
    d.text(
        (80, 482),
        "+ diagnóstico de seguridad de tu sitio",
        fill=(161, 161, 170, 255),
        font=tag_font,
    )

    # URL bottom
    url_font = load_font(22)
    d.text((80, 535), "sabuezo.vercel.app", fill=(245, 158, 11, 255), font=url_font)

    # Save flat RGB
    flat = Image.new("RGB", (W, H), (10, 10, 11))
    flat.paste(bg, (0, 0), bg)
    flat.save(APP / "opengraph-image.png", "PNG", optimize=True)
    flat.save(APP / "twitter-image.png", "PNG", optimize=True)
    print(f"✓ opengraph-image.png + twitter-image.png 1200x630")


if __name__ == "__main__":
    make_favicon()
    make_apple_icon()
    make_og_image()
    print("\n✅ Assets generados en frontend/app/")
