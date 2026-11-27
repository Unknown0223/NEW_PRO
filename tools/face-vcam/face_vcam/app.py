from __future__ import annotations

import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, ttk

from face_vcam.pump import run_pump
from face_vcam.screen_tint import ScreenTintSampler

DEFAULT_VIDEO_PATH = r"C:\Users\UNKNOWN\Videos\2026-11-27 11-51-28.mp4"
PUMP_WIDTH = 1920
PUMP_HEIGHT = 1080
PUMP_FPS = 30.0
TINT_STATUS_MS = 500


class FaceVcamApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Face VCam")
        self.root.minsize(480, 160)

        self.stop_event = threading.Event()
        self._pump_thread: threading.Thread | None = None
        self._on_air = False
        self._on_air_base = ""
        self._tint_sampler: ScreenTintSampler | None = None
        self._status_poll_after_id: str | None = None

        self.path_var = tk.StringVar(value=DEFAULT_VIDEO_PATH)
        # Face ID: loop rewind resets oval / repeats the challenge
        self.loop_var = tk.BooleanVar(value=False)
        self.freeze_var = tk.BooleanVar(value=True)
        self.speed_var = tk.StringVar(value="0.5")
        self.screen_tint_var = tk.BooleanVar(value=True)
        self.status_var = tk.StringVar(value="Idle")

        pad = {"padx": 8, "pady": 4}

        path_frame = ttk.Frame(root)
        path_frame.pack(fill=tk.X, **pad)
        ttk.Label(path_frame, text="Video:").pack(side=tk.LEFT)
        ttk.Entry(path_frame, textvariable=self.path_var).pack(
            side=tk.LEFT, fill=tk.X, expand=True, padx=(6, 6)
        )
        ttk.Button(path_frame, text="Browse…", command=self._browse).pack(side=tk.LEFT)

        opts_frame = ttk.Frame(root)
        opts_frame.pack(fill=tk.X, **pad)
        ttk.Checkbutton(opts_frame, text="Loop", variable=self.loop_var).pack(
            side=tk.LEFT
        )
        ttk.Checkbutton(
            opts_frame, text="Oxirida muzlat", variable=self.freeze_var
        ).pack(side=tk.LEFT, padx=(12, 0))
        ttk.Checkbutton(
            opts_frame, text="Screen tint", variable=self.screen_tint_var
        ).pack(side=tk.LEFT, padx=(12, 0))
        ttk.Label(opts_frame, text="Sekinlash:").pack(side=tk.LEFT, padx=(16, 4))
        speed_box = ttk.Combobox(
            opts_frame,
            textvariable=self.speed_var,
            values=("0.25", "0.5", "0.75", "1.0"),
            width=5,
            state="readonly",
        )
        speed_box.pack(side=tk.LEFT)
        ttk.Label(opts_frame, text="×").pack(side=tk.LEFT, padx=(2, 0))

        btn_frame = ttk.Frame(root)
        btn_frame.pack(fill=tk.X, **pad)
        self.start_btn = ttk.Button(btn_frame, text="Start", command=self._start)
        self.start_btn.pack(side=tk.LEFT, padx=(0, 6))
        self.stop_btn = ttk.Button(btn_frame, text="Stop", command=self._stop)
        self.stop_btn.pack(side=tk.LEFT)

        status_frame = ttk.Frame(root)
        status_frame.pack(fill=tk.X, **pad)
        ttk.Label(status_frame, text="Status:").pack(side=tk.LEFT)
        ttk.Label(status_frame, textvariable=self.status_var).pack(
            side=tk.LEFT, padx=(6, 0)
        )

    def _browse(self) -> None:
        initial = self.path_var.get().strip()
        initial_dir = ""
        if initial:
            parent = Path(initial).parent
            if parent.is_dir():
                initial_dir = str(parent)
        path = filedialog.askopenfilename(
            title="Choose MP4",
            initialdir=initial_dir or None,
            filetypes=[
                ("Video", "*.mp4 *.avi *.mkv *.mov"),
                ("All files", "*.*"),
            ],
        )
        if path:
            self.path_var.set(path)

    def _set_status(self, text: str) -> None:
        self.status_var.set(text)

    def _schedule_status(self, text: str) -> None:
        self.root.after(0, lambda: self._set_status(text))

    def _tint_status_suffix(self) -> str:
        sampler = self._tint_sampler
        if sampler is None:
            return "tint=off"
        bands = sampler.latest_bands()
        if bands is None:
            return "tint=off"
        top, bot = bands
        return (
            f"tint=top#{top[0]:02X}{top[1]:02X}{top[2]:02X}"
            f"/bot#{bot[0]:02X}{bot[1]:02X}{bot[2]:02X}"
        )

    def _cancel_tint_poll(self) -> None:
        if self._status_poll_after_id is not None:
            self.root.after_cancel(self._status_poll_after_id)
            self._status_poll_after_id = None

    def _poll_tint_status(self) -> None:
        if not self._on_air:
            return
        self._set_status(f"{self._on_air_base} {self._tint_status_suffix()}")
        self._status_poll_after_id = self.root.after(
            TINT_STATUS_MS, self._poll_tint_status
        )

    def _begin_tint_poll(self) -> None:
        self._cancel_tint_poll()
        self._poll_tint_status()

    def _end_tint_poll(self) -> None:
        self._cancel_tint_poll()

    def _stop_tint_sampler(self) -> None:
        sampler = self._tint_sampler
        if sampler is not None:
            sampler.stop()
            self._tint_sampler = None

    def _start(self) -> None:
        if self._on_air:
            return

        video_path = self.path_var.get().strip()
        if not video_path:
            self._set_status("Choose a video file.")
            return

        try:
            speed = float(self.speed_var.get())
            if speed <= 0:
                raise ValueError
        except ValueError:
            self._set_status("Sekinlash qiymati noto‘g‘ri (masalan 0.5).")
            return

        self.stop_event.clear()
        self._on_air = True
        self.start_btn.state(["disabled"])
        loop = self.loop_var.get()
        freeze_at_end = self.freeze_var.get()
        screen_tint = self.screen_tint_var.get()
        tint_sampler: ScreenTintSampler | None = None
        if screen_tint:
            tint_sampler = ScreenTintSampler()
            self._tint_sampler = tint_sampler
            tint_sampler.start()

        mode = "freeze" if freeze_at_end and not loop else ("loop" if loop else "once")
        self._on_air_base = f"On air ({speed}×, {mode})"
        self.root.after(0, self._begin_tint_poll)

        def worker() -> None:
            try:
                run_pump(
                    video_path=video_path,
                    loop=loop,
                    width=PUMP_WIDTH,
                    height=PUMP_HEIGHT,
                    fps=PUMP_FPS,
                    stop_event=self.stop_event,
                    speed=speed,
                    freeze_at_end=freeze_at_end,
                    screen_tint=screen_tint,
                    tint_sampler=tint_sampler,
                )
                if not self.stop_event.is_set():
                    self._schedule_status("Idle")
            except Exception as exc:
                self._schedule_status(str(exc))
            finally:
                if tint_sampler is not None:
                    tint_sampler.stop()
                self._tint_sampler = None
                self._on_air = False
                self.root.after(0, self._end_tint_poll)
                self.root.after(0, lambda: self.start_btn.state(["!disabled"]))

        self._pump_thread = threading.Thread(target=worker, daemon=True)
        self._pump_thread.start()

    def _stop(self) -> None:
        self.stop_event.set()
        self._stop_tint_sampler()
        self._end_tint_poll()
        self._on_air = False
        self._set_status("Idle")


def main() -> None:
    root = tk.Tk()
    FaceVcamApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()