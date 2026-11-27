"""Diagnose virtual cameras + Unity feed while pump should be on air."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

OUT = Path(r"C:\Users\UNKNOWN\AppData\Local\Temp\cursor\screenshots")


def run(cmd: list[str]) -> tuple[int, str]:
    p = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def main() -> None:
    devices = [
        "Unity Video Capture",
        "AlterCam Virtual Camera",
        "OBS Virtual Camera",
        "Lanseyaoji",
    ]
    for name in devices:
        out = OUT / f"ffmpeg_{name.replace(' ', '_')}.png"
        code, log = run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "dshow",
                "-i",
                f"video={name}",
                "-frames:v",
                "1",
                "-update",
                "1",
                str(out),
            ]
        )
        size = out.stat().st_size if out.exists() else 0
        print(f"{name}: code={code} size={size} path={out}")
        if size < 1000:
            print(log[-500:].replace("\n", " | "))


if __name__ == "__main__":
    main()
