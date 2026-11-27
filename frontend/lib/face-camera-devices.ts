/** Face ID webcam — qurilma tanlash (OBS Virtual Camera test uchun). */

export type FaceCameraDevice = {
  deviceId: string;
  label: string;
};

const STORAGE_KEY = "face-login-camera-device-id";

export function readSavedFaceCameraDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(STORAGE_KEY)?.trim() ?? "";
    return v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function writeSavedFaceCameraDeviceId(deviceId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!deviceId) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, deviceId);
  } catch {
    /* private mode */
  }
}

export function faceCameraLabel(info: MediaDeviceInfo, index: number): string {
  const raw = info.label?.trim();
  if (raw) return raw;
  return `Камера ${index + 1}`;
}

export async function listFaceVideoDevices(): Promise<FaceCameraDevice[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((d) => d.kind === "videoinput" && d.deviceId)
    .map((d, i) => ({ deviceId: d.deviceId, label: faceCameraLabel(d, i) }));
}

export function buildFaceVideoConstraints(deviceId: string | null): MediaTrackConstraints {
  const base: MediaTrackConstraints = {
    width: { ideal: 720 },
    height: { ideal: 720 }
  };
  if (deviceId) {
    return { ...base, deviceId: { exact: deviceId } };
  }
  return { ...base, facingMode: { ideal: "user" } };
}
