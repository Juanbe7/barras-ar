import { describe, expect, it } from "vitest";
import { createThemeStore, type Theme } from "../src/storage/theme";

function setup(options: { saved?: string; systemDark?: boolean } = {}) {
  const data = new Map<string, string>(options.saved ? [["barras-ar:theme", options.saved]] : []);
  const applied: Theme[] = [];
  const store = createThemeStore(
    { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) },
    () => options.systemDark ?? false,
    (theme) => applied.push(theme),
  );
  return { store, applied, data };
}

describe("theme store", () => {
  it("follows the system until a choice is made", () => {
    expect(setup({ systemDark: true }).store.current()).toBe("dark");
    expect(setup({ systemDark: false }).store.current()).toBe("light");
  });

  it("toggles to the opposite of the current theme and remembers it", () => {
    const { store, applied, data } = setup({ systemDark: true });
    expect(store.toggle()).toBe("light");
    expect(store.toggle()).toBe("dark");
    expect(applied).toEqual(["light", "dark"]);
    expect(data.get("barras-ar:theme")).toBe("dark");
  });

  it("applies the saved choice on start, and nothing when there is none", () => {
    const withChoice = setup({ saved: "dark" });
    withChoice.store.applySaved();
    expect(withChoice.applied).toEqual(["dark"]);

    const without = setup();
    without.store.applySaved();
    expect(without.applied).toEqual([]);
  });

  it("ignores an invalid saved value", () => {
    expect(setup({ saved: "sepia", systemDark: true }).store.current()).toBe("dark");
  });
});
