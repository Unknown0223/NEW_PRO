import sys
import threading

sys.path.insert(0, ".")
from face_vcam.pump import run_pump
from face_vcam.screen_tint import DEFAULT_TINT_ALPHA, ScreenTintSampler, ensure_tint_logger

ensure_tint_logger()
path = r"c:\Users\UNKNOWN\Videos\2026-11-27 11-51-28.mp4"
sampler = ScreenTintSampler(log=True)
sampler.start()
print(
    f"ON_AIR video=11-51-28 zoom=1.18 alpha={DEFAULT_TINT_ALPHA} pure-HSV face-keep — logs/tint.log",
    flush=True,
)
stop = threading.Event()
try:
    run_pump(
        video_path=path,
        loop=True,
        width=1920,
        height=1080,
        fps=30.0,
        stop_event=stop,
        backend="unitycapture",
        speed=1.0,
        freeze_at_end=False,
        screen_tint=True,
        tint_alpha=DEFAULT_TINT_ALPHA,
        tint_sampler=sampler,
        zoom=1.18,
    )
finally:
    sampler.stop()
