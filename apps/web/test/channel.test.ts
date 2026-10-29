import { describe, expect, it, vi } from "vitest";
import { boxPrice, otherChannel, priceFor } from "../src/domain/channel";
import { createChannelStore } from "../src/storage/channel";

const price = (median: number) => ({ median, min: median - 10, max: median + 10, date: "2026-10-29" });

describe("priceFor", () => {
  it("picks the price of the channel", () => {
    const product = { reference_price: price(100), wholesale_price: price(80) };
    expect(priceFor(product, "retail")?.median).toBe(100);
    expect(priceFor(product, "wholesale")?.median).toBe(80);
  });

  it("is null where nobody reported a price, or when the API does not send wholesale prices yet", () => {
    expect(priceFor({ reference_price: null, wholesale_price: price(80) }, "retail")).toBeNull();
    expect(priceFor({ reference_price: price(100) }, "wholesale")).toBeNull();
  });
});

describe("otherChannel", () => {
  it("flips between the two", () => {
    expect(otherChannel("retail")).toBe("wholesale");
    expect(otherChannel("wholesale")).toBe("retail");
  });
});

describe("boxPrice", () => {
  it("multiplies the unit price by the units in the box", () => {
    expect(boxPrice(2900, 12)).toBe(34800);
    expect(boxPrice(1899.49, 6)).toBe(11397);
  });
});

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("channel store", () => {
  it("starts on supermarket prices", () => {
    expect(createChannelStore(fakeStorage()).current()).toBe("retail");
  });

  it("remembers the choice for the next visit", () => {
    const storage = fakeStorage();
    createChannelStore(storage).set("wholesale");
    expect(createChannelStore(storage).current()).toBe("wholesale");
  });

  it("ignores a saved value it does not know", () => {
    expect(createChannelStore(fakeStorage({ "barras-ar:channel": "otro" })).current()).toBe("retail");
  });

  it("tells the listeners about a change, once, and not about choosing the same channel", () => {
    const store = createChannelStore(fakeStorage());
    const listener = vi.fn();
    const stop = store.subscribe(listener);

    store.set("retail");
    expect(listener).not.toHaveBeenCalled();
    store.set("wholesale");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("wholesale");

    stop();
    store.set("retail");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("works when storage refuses to read or write", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const store = createChannelStore(blocked);
    expect(store.current()).toBe("retail");
    store.set("wholesale");
    expect(store.current()).toBe("wholesale");
  });
});
