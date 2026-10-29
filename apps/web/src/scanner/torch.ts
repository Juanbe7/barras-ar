export interface Torch {
  /** Flips the light and returns whether it is now on. */
  toggle(): Promise<boolean>;
}

interface TorchTrack {
  getCapabilities?(): unknown;
  applyConstraints(constraints: MediaTrackConstraints): Promise<void>;
}

/** The phone's flash as a switch, or null when the camera has none (most computers, Safari on iPhone). */
export function createTorch(track: TorchTrack | undefined): Torch | null {
  const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined;
  if (!track || capabilities?.torch !== true) return null;

  let on = false;
  return {
    async toggle() {
      const next = !on;
      // `torch` is not in the TypeScript DOM types yet
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      on = next;
      return on;
    },
  };
}

/** The flash of the camera that feeds the video element, once a scanner has started it. */
export function findTorch(video: HTMLVideoElement): Torch | null {
  const stream = video.srcObject;
  return createTorch(stream instanceof MediaStream ? stream.getVideoTracks()[0] : undefined);
}
