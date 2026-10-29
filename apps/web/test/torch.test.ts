import { describe, expect, it } from "vitest";
import { createTorch } from "../src/scanner/torch";

function fakeTrack(capabilities: unknown) {
  const applied: unknown[] = [];
  return {
    applied,
    track: {
      getCapabilities: () => capabilities,
      applyConstraints: async (constraints: MediaTrackConstraints) => {
        applied.push(constraints.advanced);
      },
    },
  };
}

describe("createTorch", () => {
  it("is null when the camera has no flash or there is no camera", () => {
    expect(createTorch(fakeTrack({}).track)).toBeNull();
    expect(createTorch(fakeTrack({ torch: false }).track)).toBeNull();
    expect(createTorch({ applyConstraints: async () => {} })).toBeNull();
    expect(createTorch(undefined)).toBeNull();
  });

  it("turns the flash on and off with each toggle", async () => {
    const { track, applied } = fakeTrack({ torch: true });
    const torch = createTorch(track)!;

    expect(await torch.toggle()).toBe(true);
    expect(await torch.toggle()).toBe(false);
    expect(applied).toEqual([[{ torch: true }], [{ torch: false }]]);
  });

  it("stays off when the camera refuses the change", async () => {
    const track = {
      getCapabilities: () => ({ torch: true }),
      applyConstraints: async () => {
        throw new Error("OverconstrainedError");
      },
    };
    const torch = createTorch(track)!;

    await expect(torch.toggle()).rejects.toThrow();
    // the failed attempt did not flip the state: the next one still asks to turn it on
    await expect(torch.toggle()).rejects.toThrow();
  });
});
