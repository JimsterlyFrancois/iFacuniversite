#!/usr/bin/env python3
"""Generate Android launcher icon resources from the official iFac SVG logo."""
from pathlib import Path
import re

try:
    import cairosvg
except ImportError as exc:
    raise SystemExit("CairoSVG is required. Install it with: python -m pip install CairoSVG") from exc

ROOT = Path(__file__).resolve().parents[1]
LOGO_PATH = ROOT / "client" / "public" / "ifac-logo.svg"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
BACKGROUND = "#0b0d0f"

if not LOGO_PATH.is_file():
    raise SystemExit(f"Official iFac logo not found: {LOGO_PATH}")

logo = LOGO_PATH.read_text(encoding="utf-8")
match = re.search(r"<svg\\b[^>]*>(.*)</svg>\\s*$", logo, flags=re.DOTALL | re.IGNORECASE)
if not match:
    raise SystemExit("The official iFac SVG logo could not be parsed.")
logo_body = match.group(1)

# Legacy launcher icons are opaque square images using iFac's dark background.
legacy_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="{BACKGROUND}"/>
  <svg x="0" y="0" width="512" height="512" viewBox="0 0 512 512">{logo_body}</svg>
</svg>'''

# Android adaptive icons reserve a central safe zone. The emblem is scaled to
# 320px on a transparent 432px canvas so its circular edge is not clipped.
adaptive_foreground_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432" viewBox="0 0 432 432">
  <svg x="56" y="56" width="320" height="320" viewBox="0 0 512 512">{logo_body}</svg>
</svg>'''

for density, size in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
    target_dir = RES / f"mipmap-{density}"
    target_dir.mkdir(parents=True, exist_ok=True)
    png = cairosvg.svg2png(bytestring=legacy_svg.encode("utf-8"), output_width=size, output_height=size)
    (target_dir / "ic_launcher.png").write_bytes(png)
    (target_dir / "ic_launcher_round.png").write_bytes(png)

foreground_dir = RES / "drawable-nodpi"
foreground_dir.mkdir(parents=True, exist_ok=True)
foreground_png = cairosvg.svg2png(
    bytestring=adaptive_foreground_svg.encode("utf-8"),
    output_width=432,
    output_height=432,
)
(foreground_dir / "ic_launcher_foreground.png").write_bytes(foreground_png)

adaptive_dir = RES / "mipmap-anydpi-v26"
adaptive_dir.mkdir(parents=True, exist_ok=True)
adaptive_xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
'''
(adaptive_dir / "ic_launcher.xml").write_text(adaptive_xml, encoding="utf-8")
(adaptive_dir / "ic_launcher_round.xml").write_text(adaptive_xml, encoding="utf-8")

values_dir = RES / "values"
values_dir.mkdir(parents=True, exist_ok=True)
(values_dir / "ic_launcher_background.xml").write_text(
    '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0B0D0F</color>
</resources>
''',
    encoding="utf-8",
)

print("Generated iFac launcher icons: legacy densities + Android adaptive icons.")
