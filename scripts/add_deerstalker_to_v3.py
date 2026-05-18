"""Toma v3 (icon abstracto del sabueso) y le añade un deerstalker amber arriba."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

SRC = Path("/tmp/sabuezo-logos/v3.png")
OUT = Path("/tmp/sabuezo-logos/v3-detective.png")
AMBER = (245, 158, 11)

img = Image.open(SRC).convert("RGB")
W, H = img.size
arr = np.array(img)

# Amber pixels (loose threshold porque puede haber antialiasing)
mask = (arr[:, :, 0] > 140) & (arr[:, :, 1] > 90) & (arr[:, :, 2] < 80)
ys, xs = np.where(mask)
if len(ys) == 0:
    raise RuntimeError("No amber pixels found in v3")

# Encontrar el topmost punto del shape
top_y = int(ys.min())
# Centro x en la fila topmost (para evitar artefactos, promedio del top ~20 filas)
narrow_mask = ys < top_y + 20
top_x = int(np.mean(xs[narrow_mask]))

print(f"Top de la cabeza detectado en ({top_x}, {top_y}) — canvas {W}x{H}")

# Recargamos limpia
img = Image.open(SRC).convert("RGB")

# Identificar el "head bump" — buscamos la x del top_y exacto y su rango horizontal
# para centrar el hat sobre la parte alta real (no sobre todo el shape)
head_band = np.where(ys < top_y + 50)[0]
head_xs = xs[head_band]
head_left = int(head_xs.min())
head_right = int(head_xs.max())
head_center = (head_left + head_right) // 2
head_width = head_right - head_left
print(f"Cabeza band: x=[{head_left},{head_right}] center={head_center} width={head_width}")

# Re-bajamos el shift x para centrar sobre la cabeza real
top_x = head_center

# Hat dimensions: relativos al ancho de la cabeza (no al shape total)
crown_w = int(head_width * 0.95)
crown_h = int(crown_w * 0.36)

# Gap visible entre cabeza y hat (sin overlap)
gap = int(crown_h * 0.18)

# Earflaps grandes que sobresalen claramente
flap_w = int(crown_w * 0.32)
flap_h = int(crown_h * 1.05)

pom_r = int(crown_w * 0.08)

# Posición: hat con gap arriba del top de la cabeza
crown_left = top_x - crown_w // 2
crown_top = top_y - crown_h - gap

draw = ImageDraw.Draw(img)

# 1. Earflaps a los lados (sobresalen hacia abajo y a los lados)
flap_y = crown_top + int(crown_h * 0.25)
# Izquierdo
draw.ellipse(
    [crown_left - flap_w + int(flap_w * 0.2), flap_y, crown_left + int(flap_w * 0.5), flap_y + flap_h],
    fill=AMBER,
)
# Derecho
draw.ellipse(
    [crown_left + crown_w - int(flap_w * 0.5), flap_y, crown_left + crown_w + flap_w - int(flap_w * 0.2), flap_y + flap_h],
    fill=AMBER,
)

# 2. Crown principal — más como un domo (oval) que un rectángulo, estilo deerstalker
draw.ellipse(
    [crown_left, crown_top, crown_left + crown_w, crown_top + crown_h * 2],
    fill=AMBER,
)
# Recortamos la mitad inferior del óvalo dibujando un rectángulo negro
draw.rectangle(
    [0, crown_top + crown_h, W, H],
    fill=(10, 10, 11),
)

# Re-dibujamos earflaps ENCIMA del recorte para que se vean por debajo del crown
draw.ellipse(
    [crown_left - flap_w + int(flap_w * 0.2), flap_y, crown_left + int(flap_w * 0.5), flap_y + flap_h],
    fill=AMBER,
)
draw.ellipse(
    [crown_left + crown_w - int(flap_w * 0.5), flap_y, crown_left + crown_w + flap_w - int(flap_w * 0.2), flap_y + flap_h],
    fill=AMBER,
)

# Re-dibujamos la mitad superior del óvalo (que es el crown)
draw.chord(
    [crown_left, crown_top, crown_left + crown_w, crown_top + crown_h * 2],
    start=180, end=360,
    fill=AMBER,
)

# Re-dibujamos la imagen original V3 encima del recorte (porque el rectángulo negro borró parte del dog)
v3_orig = Image.open(SRC).convert("RGB")
# Pegamos solo la parte original donde NO interfiere con el hat
mask_amber_orig = Image.new("L", (W, H), 0)
mask_arr = np.zeros((H, W), dtype=np.uint8)
orig_arr = np.array(v3_orig)
amber_mask = (orig_arr[:, :, 0] > 140) & (orig_arr[:, :, 1] > 90) & (orig_arr[:, :, 2] < 80)
mask_arr[amber_mask] = 255
mask_amber_orig = Image.fromarray(mask_arr, mode="L")
img.paste(v3_orig, (0, 0), mask_amber_orig)

# 3. Visor delantero (pequeño rectángulo abajo del crown)
visor_w = int(crown_w * 0.62)
visor_h = int(crown_h * 0.16)
visor_x = top_x - visor_w // 2
visor_y = crown_top + crown_h - int(visor_h * 0.3)
draw.rounded_rectangle(
    [visor_x, visor_y, visor_x + visor_w, visor_y + visor_h],
    radius=int(visor_h * 0.5),
    fill=AMBER,
)

# 4. Pom en la cima
pom_x = top_x
pom_top = crown_top - pom_r * 2 + int(pom_r * 0.5)
draw.ellipse(
    [pom_x - pom_r, pom_top, pom_x + pom_r, pom_top + pom_r * 2],
    fill=AMBER,
)

img.save(OUT, "PNG", optimize=True)
print(f"✓ Guardado: {OUT}")
