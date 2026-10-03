#!/usr/bin/env python3
# Patient Records: build script
# Copyright (C) 2026 Daniyal
# SPDX-License-Identifier: LicenseRef-Patient-Records-Free-Use-1.0
# Free to use. Selling it is not allowed. See the LICENSE file.
#
# Combines src/index.html, its stylesheet and all its scripts (including the
# SheetJS library in vendor/) into ONE file: dist/Patient_Records.html.
# That single file is what users download and open. It works offline.
#
# Usage:  python3 build.py        (Python 3.7 or newer, no extra packages)

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src" / "index.html"
OUT = ROOT / "dist" / "Patient_Records.html"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def inline_css(match: re.Match) -> str:
    css = read((SRC.parent / match.group(1)).resolve())
    return "<style>\n" + css + "\n</style>"


def inline_js(match: re.Match) -> str:
    path = (SRC.parent / match.group(1)).resolve()
    js = read(path)
    # Third-party files keep their license text next to them (Apache 2.0 asks for this).
    lic = path.parent / "LICENSE-SheetJS.txt"
    if path.parent.name == "vendor" and lic.exists():
        js = "/*! SheetJS Community Edition: license below\n\n" + read(lic) + "\n*/\n" + js
    # A literal "</script" inside the code would end the tag early.
    js = re.sub(r"</(script)", r"<\\/\1", js, flags=re.IGNORECASE)
    return "<script>\n" + js + "\n</script>"


def main() -> None:
    html = read(SRC)
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
    html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)
    left = re.findall(r'<script src=|<link rel="stylesheet"', html)
    if left:
        raise SystemExit("Some files were not inlined. Check the tags in src/index.html.")
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"Built {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
