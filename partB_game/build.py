"""Assemble the single-file game: python build.py  ->  MachineWhisperer3D.html (works offline)."""
from pathlib import Path
here = Path(__file__).resolve().parent; s = here / "src"
html = (s / "index.template.html").read_text()
for tag, f in [("/*CSS*/", "ui.css"), ("/*THREE*/", "vendor/three.min.js"), ("/*DATA*/", "data.js"), ("/*LOGIC*/", "logic.js"), ("/*SCENE*/", "scene.js"), ("/*GAME*/", "game.js")]:
    html = html.replace(tag, (s / f).read_text())
(here / "MachineWhisperer3D.html").write_text(html)
print("built", len(html) // 1024, "KB")
