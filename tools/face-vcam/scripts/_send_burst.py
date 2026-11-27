"""Send MP4 to Unity Capture for N seconds (diagnostic)."""
from __future__ import annotations

import sys
import time

import cv2
import pyvirtualcam

sys.path.insert(0, ".")
from face_vcam.pump import frame_to_rgb, load_video

SECONDS = 20
PATH = r"c:\Users\UNKNOWN\Videos\2026-11-27 11-51-28.mp4"


def main() -> None:
    cap = load_video(PATH)
    with pyvirtualcam.Camera(
        width=1280, height=720, fps=30.0, backend="unitycapture"
    ) as cam:
        print("SENDER_ON", cam.device, flush=True)
        end = time.time() + SECONDS
        n = 0
        while time.time() < end:
            ok, frame = cap.read()
            if not ok:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            rgb = frame_to_rgb(frame, 1280, 720, zoom=1.4)
            cam.send(rgb)
            cam.sleep_until_next_frame()
            n += 1
            if n % 60 == 0:
                print("sent", n, "mean", float(rgb.mean()), flush=True)
        print("SENDER_DONE", n, flush=True)
    cap.release()


if __name__ == "__main__":
    main()
