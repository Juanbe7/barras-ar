import { describe, expect, it } from "vitest";
import type { Product } from "../src/api/types";
import { describeRelated } from "../src/domain/related";

const product = (brand: string | null): Product => ({
  ean: "1",
  description: "x",
  brand,
  quantity: null,
  unit: null,
  category: null,
  reference_price: null,
  chains: 1,
  first_seen: "2026-10-01",
  last_seen: "2026-10-29",
});

describe("describeRelated", () => {
  it("claims the same brand only when most of the list shares it", () => {
    const list = ["SAPHIRUS", "SAPHIRUS", "Saphirus", "SAPHIRUS", "OTRA"].map(product);
    expect(describeRelated(list).title).toBe("Productos parecidos de la misma marca");
  });

  it("falls back to the manufacturer wording when the brands are mixed", () => {
    const list = ["A", "B", "C", "A"].map(product);
    expect(describeRelated(list).title).toBe("Productos relacionados");
  });

  it("does not claim a brand from a short list or from missing brands", () => {
    expect(describeRelated(["A", "A"].map(product)).title).toBe("Productos relacionados");
    expect(describeRelated([null, null, null].map(product)).title).toBe("Productos relacionados");
  });

  it("always says it is not the scanned product", () => {
    expect(describeRelated([]).note).toContain("No es el producto que escaneaste");
    expect(describeRelated(["A", "A", "A"].map(product)).note).toContain("No es el producto que escaneaste");
  });
});
