"""Hold pump until SIGINT/timeout — for manual or browser smoke."""
from __future__ import annotations

import argparse
import signal
import sys
import threading
import time

from face_vcam.app import DEFAULT_VIDEO_PATH
from face_vcam.pump import run_pump


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seconds", type=float, default=120.0)
    parser.add_argument("--speed", type=float, default=0.5, help="playback rate (0.5 = half)")
    args = parser.parse_args()

    stop = threading.Event()

    def on_signal(_sig: int, _frame: object) -> None:
        stop.set()

    signal.signal(signal.SIGINT, on_signal)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, on_signal)

    err: list[BaseException] = []

    def worker() -> None:
        try:
            run_pump(
                video_path=DEFAULT_VIDEO_PATH,
                loop=True,
                width=1280,
                height=720,
                fps=30,
                stop_event=stop,
                speed=args.speed,
            )
        except BaseException as exc:
            err.append(exc)
            stop.set()

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    deadline = time.monotonic() + args.seconds
    while not stop.is_set() and time.monotonic() < deadline:
        time.sleep(0.25)
    stop.set()
    t.join(timeout=10)
    if err:
        print(f"FAIL: {err[0]}", file=sys.stderr)
        return 1
    print("OK: pump stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())