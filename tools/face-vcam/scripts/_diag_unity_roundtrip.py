"""Kill competing pumps, send known RGB via Unity Capture, read back, report."""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import pyvirtualcam

OUT = Path(__file__).resolve().parent / "_selfcheck"
OUT.mkdir(exist_ok=True)


def kill_other_pumps() -> None:
    # WMIC-less: PowerShell-friendly tasklist parse via ctypes not needed —
    # caller should stop pumps; still try a soft pattern with taskkill on known scripts.
    subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-Command",
            (
                "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
                "Where-Object { $_.CommandLine -match '_run_user_mp4|run_pump' } | "
                "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; "
                "Write-Output $_.ProcessId }"
            ),
        ],
        check=False,
    )


def read_unity(n: int = 5) -> list[float]:
    means: list[float] = []
    # Prefer OpenCV by friendly name
    cap = cv2.VideoCapture("Unity Video Capture", cv2.CAP_DSHOW)
    if not cap.isOpened():
        print("opencv open failed, trying ffmpeg")
        ff = "ffmpeg"
        dest = OUT / "unity_rt.jpg"
        subprocess.run(
            [
                ff,
                "-y",
                "-rtbufsize",
                "100M",
                "-f",
                "dshow",
                "-i",
                "video=Unity Video Capture",
                "-frames:v",
                "1",
                "-update",
                "1",
                str(dest),
            ],
            capture_output=True,
        )
        img = cv2.imread(str(dest))
        if img is None:
            return []
        return [float(img.mean())]
    for i in range(n):
        ok, frame = cap.read()
        if not ok or frame is None:
            means.append(-1.0)
            continue
        means.append(float(frame.mean()))
        if i == 0:
            cv2.imwrite(str(OUT / "unity_rt.jpg"), frame)
        time.sleep(0.05)
    cap.release()
    return means


def main() -> int:
    kill_other_pumps()
    time.sleep(1.0)

    # Baseline before send
    print("before_send means", read_unity(3))

    w, h, fps = 1280, 720, 30
    red = np.zeros((h, w, 3), dtype=np.uint8)
    red[:, :] = (220, 40, 40)  # RGB
    face = np.zeros((h, w, 3), dtype=np.uint8)
    # skin-ish oval
    yy, xx = np.ogrid[:h, :w]
    mask = ((xx - w / 2) / (w * 0.18)) ** 2 + ((yy - h / 2) / (h * 0.32)) ** 2 <= 1
    face[:] = (30, 30, 30)
    face[mask] = (190, 150, 120)

    print("opening Camera…")
    with pyvirtualcam.Camera(width=w, height=h, fps=fps, backend="unitycapture") as cam:
        print("device", getattr(cam, "device", "?"), "backend", cam.backend)
        for i in range(45):
            cam.send(face if i % 2 == 0 else red)
            cam.sleep_until_next_frame()
        # keep sending while we read
        means_live: list[float] = []
        cap = cv2.VideoCapture("Unity Video Capture", cv2.CAP_DSHOW)
        print("reader_open", cap.isOpened())
        for i in range(60):
            cam.send(face)
            cam.sleep_until_next_frame()
            if cap.isOpened() and i % 5 == 0:
                ok, fr = cap.read()
                if ok and fr is not None:
                    m = float(fr.mean())
                    means_live.append(m)
                    if len(means_live) == 1:
                        cv2.imwrite(str(OUT / "unity_live.jpg"), fr)
        cap.release()
        print("live_means", means_live)

    time.sleep(0.3)
    print("after_close means", read_unity(2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
