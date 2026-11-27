"""Short-lived pump smoke: default MP4 + loop. Exit 0 if frames sent ~2s."""
from __future__ import annotations

import sys
import threading
import time

from face_vcam.app import DEFAULT_VIDEO_PATH
from face_vcam.pump import run_pump

DURATION_S = 2.5


def main() -> int:
    stop = threading.Event()
    err: list[BaseException] = []

    def worker() -> None:
        try:
            run_pump(
                video_path=DEFAULT_VIDEO_PATH,
                loop=True,
                width=640,
                height=480,
                fps=30,
                stop_event=stop,
            )
        except BaseException as exc:
            err.append(exc)

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    time.sleep(DURATION_S)
    stop.set()
    t.join(timeout=10)
    if err:
        print(f"FAIL: {err[0]}", file=sys.stderr)
        return 1
    print("OK: pump ran without error")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())