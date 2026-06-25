"""Generate og-image.png (1200x630) for WordForge social sharing."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1200, 630

# Brand colors
BG = (15, 23, 42)           # slate-900
ACCENT = (37, 99, 235)      # blue-600
ACCENT2 = (139, 92, 246)    # purple-500
WHITE = (248, 250, 252)     # slate-50
MUTED = (148, 163, 184)     # slate-400
TILE_BG = (30, 41, 59)      # slate-800
TILE_BORDER = (51, 65, 85)  # slate-700

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

# Try to load a nice font; fall back to default
def load_font(size, bold=True):
    candidates = [
        "/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Bold.otf" if bold else "/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Regular.otf",
        "/usr/share/fonts/truetype/chinese/NotoSansSC-Bold.ttf" if bold else "/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                pass
    return ImageFont.load_default()

font_title = load_font(96, bold=True)
font_sub = load_font(36, bold=False)
font_tile_letter = load_font(56, bold=True)
font_tile_score = load_font(22, bold=True)
font_tag = load_font(28, bold=True)

# Subtle radial background — left accent gradient
# Draw vertical bands of slightly different slate tones for visual interest
for x in range(0, W, 4):
    ratio = x / W
    # blend BG slightly toward ACCENT2 near center-left
    if ratio < 0.5:
        t = ratio * 2  # 0..1
        r = int(BG[0] + (ACCENT2[0] // 10) * (1 - t))
        g = int(BG[1] + (ACCENT2[1] // 10) * (1 - t))
        b = int(BG[2] + (ACCENT2[2] // 10) * (1 - t))
    else:
        r, g, b = BG
    draw.line([(x, 0), (x, H)], fill=(r, g, b), width=4)

# Brand chip top-left
draw.rounded_rectangle([(60, 60), (260, 110)], radius=25, fill=ACCENT)
draw.text((90, 65), "WordForge", font=font_tag, fill=WHITE)

# Hero title
title = "Unscramble Any Letters"
draw.text((60, 180), title, font=font_title, fill=WHITE)

# Subtitle
sub = "The fastest word unscrambler on the internet."
draw.text((60, 310), sub, font=font_sub, fill=MUTED)

sub2 = "370,000+ words · Scrabble scores · Blank tiles · Zero ads"
# Wrap if too long — measure sub2 width
bbox = draw.textbbox((0, 0), sub2, font=font_sub)
sub2_w = bbox[2] - bbox[0]
draw.text((60, 360), sub2, font=font_sub, fill=ACCENT)

# Decorative letter tiles on the right side
tiles = [
    ("L", 1), ("I", 1), ("S", 1), ("T", 1), ("E", 1), ("N", 1),
]
tile_size = 90
gap = 12
start_x = W - (len(tiles) * (tile_size + gap)) - 60
start_y = 200

for i, (letter, score) in enumerate(tiles):
    x = start_x + i * (tile_size + gap)
    y = start_y
    # Tile background with subtle border
    draw.rounded_rectangle([(x, y), (x + tile_size, y + tile_size)], radius=14,
                           fill=TILE_BG, outline=TILE_BORDER, width=2)
    # Letter
    letter_bbox = draw.textbbox((0, 0), letter, font=font_tile_letter)
    letter_w = letter_bbox[2] - letter_bbox[0]
    letter_h = letter_bbox[3] - letter_bbox[1]
    draw.text(
        (x + (tile_size - letter_w) / 2, y + (tile_size - letter_h) / 2 - 4),
        letter,
        font=font_tile_letter,
        fill=WHITE,
    )
    # Score badge
    badge_size = 28
    bx = x + tile_size - badge_size - 6
    by = y + tile_size - badge_size - 6
    draw.rounded_rectangle([(bx, by), (bx + badge_size, by + badge_size)],
                           radius=6, fill=ACCENT)
    score_str = str(score)
    sb = draw.textbbox((0, 0), score_str, font=font_tile_score)
    sw = sb[2] - sb[0]
    sh = sb[3] - sb[1]
    draw.text((bx + (badge_size - sw) / 2, by + (badge_size - sh) / 2 - 2),
              score_str, font=font_tile_score, fill=WHITE)

# Anagram hint below tiles
hint = "= SILENT, INLETS, TINSEL, LISTEN…"
draw.text((start_x, start_y + tile_size + 20), hint, font=font_sub, fill=MUTED)

# Footer divider
draw.line([(60, 540), (W - 60, 540)], fill=TILE_BORDER, width=2)

# Footer text
footer = "wordforge.app"
fbbox = draw.textbbox((0, 0), footer, font=font_tag)
fw = fbbox[2] - fbbox[0]
draw.text((60, 560), footer, font=font_tag, fill=ACCENT)

footer2 = "Free · No signup · Privacy-first"
f2bbox = draw.textbbox((0, 0), footer2, font=font_tag)
f2w = f2bbox[2] - f2bbox[0]
draw.text((W - 60 - f2w, 560), footer2, font=font_tag, fill=MUTED)

out = "/home/z/my-project/wordforge/public/og-image.png"
img.save(out, "PNG", optimize=True)
print(f"Saved {out}")
print(f"Size: {os.path.getsize(out) / 1024:.1f} KB")
