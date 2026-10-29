/** OpenAPI description of the public API, served at /openapi.json. */
export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "BarrasAR API",
    version: "0.1.0",
    description:
      "Open, free API of Argentine products by barcode (EAN). Data: Precios Claros – Base SEPA, " +
      "Subsecretaría de Defensa del Consumidor y Lealtad Comercial. License CC BY 4.0. " +
      "Processed and modified by BarrasAR. The data is what shops report and may contain errors; " +
      "this project is not endorsed by the Argentine government.",
    license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/deed.es" },
  },
  paths: {
    "/products/{ean}": {
      get: {
        summary: "A product by barcode",
        parameters: [
          {
            name: "ean",
            in: "path",
            required: true,
            description: "Barcode, 8 to 14 digits (EAN-8, UPC-A, EAN-13).",
            schema: { type: "string", example: "7790040147720" },
          },
        ],
        responses: {
          "200": {
            description: "The product",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ProductResponse" } } },
          },
          "400": { $ref: "#/components/responses/Error" },
          "404": { $ref: "#/components/responses/Error" },
          "429": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/products/{ean}/related": {
      get: {
        summary: "Products related to a barcode",
        description:
          "Products whose codes are close to this one: same manufacturer and, often, the same product line. " +
          "It works for codes that are not in the catalog, so a client can show it after a 404. " +
          "Closest first. The code itself is never included.",
        parameters: [
          {
            name: "ean",
            in: "path",
            required: true,
            schema: { type: "string", example: "7798184680905" },
          },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 20, default: 8 } },
        ],
        responses: {
          "200": {
            description: "Related products (possibly none)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/RelatedResponse" } } },
          },
          "400": { $ref: "#/components/responses/Error" },
          "429": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/products": {
      get: {
        summary: "Search products by text",
        description: "Every word must appear, as a whole or partial word, in the product's wording.",
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string", example: "galletitas bagley" },
          },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", minimum: 0, maximum: 10000, default: 0 },
          },
        ],
        responses: {
          "200": {
            description: "A page of products",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SearchResponse" } } },
          },
          "400": { $ref: "#/components/responses/Error" },
          "429": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/stats": {
      get: { summary: "Catalog size and latest data day", responses: { "200": { description: "Stats" } } },
    },
    "/health": {
      get: {
        summary: "Service status",
        responses: { "200": { description: "ok" }, "503": { description: "database unreachable" } },
      },
    },
  },
  components: {
    responses: {
      Error: {
        description: "Error",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } },
        },
      },
      Product: {
        type: "object",
        properties: {
          ean: { type: "string", example: "7790040147720" },
          description: { type: "string", example: "GALLETITAS SURTIDO BAGLEY BOLSA X 400 GRS" },
          brand: { type: "string", nullable: true, example: "BAGLEY" },
          quantity: { type: "number", nullable: true, example: 400 },
          unit: { type: "string", nullable: true, enum: ["g", "ml", "unit"] },
          category: { type: "string", nullable: true },
          reference_price: {
            nullable: true,
            type: "object",
            description: "National list price (promotions excluded): median of each chain's median.",
            properties: {
              median: { type: "number" },
              min: { type: "number" },
              max: { type: "number" },
              date: { type: "string", format: "date" },
            },
          },
          chains: { type: "integer", description: "In how many chains the code appears" },
          first_seen: { type: "string", format: "date" },
          last_seen: { type: "string", format: "date" },
        },
      },
      ProductResponse: {
        allOf: [
          { $ref: "#/components/schemas/Product" },
          { type: "object", properties: { source: { type: "string" } } },
        ],
      },
      RelatedResponse: {
        type: "object",
        properties: {
          ean: { type: "string", description: "The code asked for, as 13 digits" },
          data: { type: "array", items: { $ref: "#/components/schemas/Product" } },
          source: { type: "string" },
        },
      },
      SearchResponse: {
        type: "object",
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/Product" } },
          limit: { type: "integer" },
          offset: { type: "integer" },
          has_more: { type: "boolean" },
          source: { type: "string" },
        },
      },
    },
  },
} as const;
