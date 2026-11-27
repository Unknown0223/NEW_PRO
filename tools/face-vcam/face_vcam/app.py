from __future__ import annotations

import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, ttk

from face_vcam.pump import run_pump

DEFAULT_VIDEO_PATH = (
    r"C:\Users\UNKNOWN\Pictures\Camera Roll\WIN_20261127_10_48_17_Pro.mp4"
)
PUMP_WIDTH = 1280
PUMP_HEIGHT = 720
PUMP_FPS = 30.0


class FaceVcamApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Face VCam")
        self.root.minsize(480, 160)

        self.stop_event = threading.Event()
        self._pump_thread: threading.Thread | None = None
        self._on_air = False

        self.path_var = tk.StringVar(value=DEFAULT_VIDEO_PATH)
        self.loop_var = tk.BooleanVar(value=True)
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

    def _start(self) -> None:
        if self._on_air:
            return

        video_path = self.path_var.get().strip()
        if not video_path:
            self._set_status("Choose a video file.")
            return

        self.stop_event.clear()
        self._on_air = True
        self.start_btn.state(["disabled"])
        loop = self.loop_var.get()

        def worker() -> None:
            try:
                self._schedule_status("On air")
                run_pump(
                    video_path=video_path,
                    loop=loop,
                    width=PUMP_WIDTH,
                    height=PUMP_HEIGHT,
                    fps=PUMP_FPS,
                    stop_event=self.stop_event,
                )
                if not self.stop_event.is_set():
                    self._schedule_status("Idle")
            except Exception as exc:
                self._schedule_status(str(exc))
            finally:
                self._on_air = False
                self.root.after(0, lambda: self.start_btn.state(["!disabled"]))

        self._pump_thread = threading.Thread(target=worker, daemon=True)
        self._pump_thread.start()

    def _stop(self) -> None:
        self.stop_event.set()
        self._set_status("Idle")


def main() -> None:
    root = tk.Tk()
    FaceVcamApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()