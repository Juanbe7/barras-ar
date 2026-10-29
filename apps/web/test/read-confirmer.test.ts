import { describe, expect, it } from "vitest";
import { createReadConfirmer } from "../src/scanner/read-confirmer";

function setup(required = 3, maxGapMs = 1000) {
  let time = 0;
  const confirmer = createReadConfirmer(required, maxGapMs, () => time);
  return { confirmer, advance: (ms: number) => (time += ms) };
}

describe("read confirmer", () => {
  it("accepts a code on its third consecutive read", () => {
    const { confirmer, advance } = setup();
    expect(confirmer.confirm("7798184680905")).toBe(false);
    advance(150);
    expect(confirmer.confirm("7798184680905")).toBe(false);
    advance(150);
    expect(confirmer.confirm("7798184680905")).toBe(true);
  });

  it("starts over when a different code interrupts", () => {
    const { confirmer, advance } = setup();
    confirmer.confirm("7798184680905");
    advance(150);
    confirmer.confirm("7792724680905"); // a misread
    advance(150);
    expect(confirmer.confirm("7798184680905")).toBe(false);
    advance(150);
    expect(confirmer.confirm("7798184680905")).toBe(false);
    advance(150);
    expect(confirmer.confirm("7798184680905")).toBe(true);
  });

  it("does not count reads that are too far apart", () => {
    const { confirmer, advance } = setup(2, 1000);
    confirmer.confirm("7798184680905");
    advance(2000);
    expect(confirmer.confirm("7798184680905")).toBe(false);
    advance(100);
    expect(confirmer.confirm("7798184680905")).toBe(true);
  });

  it("never accepts a single stray misread", () => {
    const { confirmer } = setup();
    expect(confirmer.confirm("7792724680905")).toBe(false);
  });
});
