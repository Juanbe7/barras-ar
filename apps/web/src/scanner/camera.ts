export type CameraErrorKind = "denied" | "unavailable";

export class CameraError extends Error {
  constructor(readonly kind: CameraErrorKind) {
    super(kind === "denied" ? "Camera permission denied" : "No camera available");
    this.name = "CameraError";
  }
}

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: { ideal: "environment" } },
  audio: false,
};

export function toCameraError(error: unknown): CameraError {
  if (error instanceof CameraError) return error;
  const denied = error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name);
  return new CameraError(denied ? "denied" : "unavailable");
}

export async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError("unavailable");
  try {
    return await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
  } catch (error) {
    throw toCameraError(error);
  }
}
