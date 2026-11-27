"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { FaceCameraDevice } from "@/lib/face-camera-devices";

type Props = {
  devices: FaceCameraDevice[];
  value: string | null;
  disabled?: boolean;
  onChange: (deviceId: string) => void;
};

/** Face ID — webcam qurilmasini tanlash (masalan OBS Virtual Camera). */
export function FaceCameraPicker({ devices, value, disabled, onChange }: Props) {
  if (devices.length < 2) return null;
  const selected = value && devices.some((d) => d.deviceId === value) ? value : devices[0]!.deviceId;

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600" htmlFor="face-camera-select">
        Камера
      </label>
      <Select value={selected} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger id="face-camera-select" className="h-9 bg-white text-left">
          <SelectValue placeholder="Выберите камеру…" />
        </SelectTrigger>
        <SelectContent>
          {devices.map((d) => (
            <SelectItem key={d.deviceId} value={d.deviceId}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
