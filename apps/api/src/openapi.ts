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
            description:
              "Barcode, 8 to 14 digits (EAN-8, UPC-A, EAN-13). A 14-digit wholesale box code (DUN-14) also works: " +
              "the response is the product the box holds, plus a `pack` field.",
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
    "/products/batch": {
      post: {
        summary: "Many lookups in one request",
        description:
          "Looks up to 100 items, each by text (`q`) or by barcode (`ean`), and answers one result per item, in the " +
          "same order. The whole batch counts as ONE request for the rate limit, so it is the way to look up hundreds " +
          "of products (a bulk import). A bad or unmatched item never fails the batch: it comes back with " +
          "`found: false` (and an `error` when the item was invalid). Not cached at the edge.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/BatchRequest" } } },
        },
        responses: {
          "200": {
            description: "One result per item, in the request's order",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BatchResponse" } } },
          },
          "400": { $ref: "#/components/responses/Error" },
          "413": { $ref: "#/components/responses/Error" },
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
      Price: {
        type: "object",
        properties: {
          median: { type: "number" },
          min: { type: "number" },
          max: { type: "number" },
          date: { type: "string", format: "date", description: "Day of the SEPA file the price comes from" },
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
            allOf: [{ $ref: "#/components/schemas/Price" }],
            description:
              "Supermarket price: national list price per unit with VAT, promotions excluded (median of each chain's median).",
          },
          wholesale_price: {
            nullable: true,
            allOf: [{ $ref: "#/components/schemas/Price" }],
            description:
              "Wholesale price per unit with VAT, promotions excluded: an approximate cost for a shop that buys to resell. " +
              "Usually below the supermarket price, but not always (about 15% of products cost more at wholesalers), so it is not a suggested price.",
          },
          chains: { type: "integer", description: "In how many chains the code appears" },
          first_seen: { type: "string", format: "date" },
          last_seen: { type: "string", format: "date" },
        },
      },
      ProductResponse: {
        allOf: [
          { $ref: "#/components/schemas/Product" },
          {
            type: "object",
            properties: {
              pack: {
                type: "object",
                description: "Only when the code asked for is a box (DUN-14)",
                properties: {
                  code: { type: "string", example: "57790060023689" },
                  units: { type: "integer", description: "Units of the product inside the box", example: 12 },
                },
              },
              source: { type: "string" },
            },
          },
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
      BatchRequest: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: {
              type: "object",
              required: ["id"],
              description: "Exactly one of `q` or `ean`.",
              properties: {
                id: {
                  type: "string",
                  minLength: 1,
                  maxLength: 64,
                  description:
                    "Yours (for example the spreadsheet row). Unique within the batch; it comes back in the result.",
                  example: "row-2",
                },
                q: {
                  type: "string",
                  maxLength: 200,
                  description: "Text search, like GET /products?q=",
                  example: "alfajor milka",
                },
                ean: {
                  type: "string",
                  description: "Barcode, 8 to 14 digits, like GET /products/{ean}",
                  example: "7790040147720",
                },
                limit: {
                  type: "integer",
                  minimum: 1,
                  maximum: 20,
                  default: 5,
                  description: "Maximum products for a text item",
                },
              },
            },
          },
        },
      },
      BatchItemResult: {
        type: "object",
        properties: {
          id: { type: "string" },
          found: { type: "boolean" },
          data: {
            type: "array",
            description: "The products found (one for an `ean` item; plus `pack` when the code is a box)",
            items: { $ref: "#/components/schemas/Product" },
          },
          error: {
            type: "object",
            description:
              "Only when this item was invalid (invalid_item, invalid_ean, invalid_query, invalid_limit) or failed (internal_error)",
            properties: { code: { type: "string" }, message: { type: "string" } },
          },
        },
      },
      BatchResponse: {
        type: "object",
        properties: {
          results: { type: "array", items: { $ref: "#/components/schemas/BatchItemResult" } },
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
