# BarrasAR

API abierta y gratuita de productos argentinos por código de barras (EAN). A partir de un código devuelve la ficha del producto: descripción, marca, presentación, categoría y un precio de referencia. Se alimenta todos los días con los datos públicos de SEPA (Precios Claros).

> Estado: en desarrollo. El plan completo está en [`docs/plan-del-proyecto.pdf`](docs/plan-del-proyecto.pdf).

## Cómo funciona

![Arquitectura](docs/diagramas/arquitectura.png)

1. **Ingesta diaria (GitHub Actions)**: baja el ZIP del día del dataset SEPA, lee los ZIP de cada cadena, valida los códigos y arma una ficha por producto.
2. **Catálogo (Supabase / PostgreSQL)**: una sola tabla, `productos`, con una fila por código de barras.
3. **API de lectura (Vercel)**: consulta por código y búsqueda por texto.

## Ejemplo

`GET /products/7790040147720`

```json
{
  "ean": "7790040147720",
  "description": "Galletitas Surtido Bagley Bolsa x 400 g",
  "brand": "Bagley",
  "quantity": 400,
  "unit": "g",
  "category": "Galletitas",
  "reference_price": { "median": 3850, "min": 2500, "max": 3985, "date": "2026-10-29" },
  "chains": 7,
  "last_seen": "2026-10-29",
  "source": "Precios Claros – Base SEPA (CC BY 4.0)"
}
```

La API y el esquema usan nombres en inglés; el contenido (descripciones, marcas) queda como lo informan los comercios.

| Endpoint | Para qué |
| --- | --- |
| `GET /products/{ean}` | Ficha de un producto; 404 si no está |
| `GET /products?q=galletitas bagley` | Búsqueda por texto, paginada |
| `GET /stats` | Cantidad de productos y última ingesta |
| `GET /health` | Estado del servicio |

## Números de un día real (jueves 29/10/2026)

- 76.581 códigos de barras válidos de 16 cadenas (Carrefour, DIA, Coto, Changomás, Jumbo/Disco/Vea, La Anónima, Cooperativa Obrera y otras).
- 14,3 millones de filas procesadas en unos 3 minutos.
- La tabla `productos` ocupa entre 25 y 28 MB con el índice de búsqueda.
- La regla que elige la descripción acertó en 93 de 100 productos revisados a mano.

## Hoja de ruta

![Hoja de ruta](docs/diagramas/hoja-de-ruta.png)

## Contenido de esta carpeta

| Carpeta | Qué hay |
| --- | --- |
| `packages/ingest/` | Ingesta diaria en TypeScript: lee los ZIP de SEPA, arma la ficha de cada producto y carga el catálogo ([detalles](packages/ingest/README.md)) |
| `db/migrations/` | Migraciones SQL del catálogo |
| `apps/api/` | API de lectura con Hono, pensada para Vercel ([detalles](apps/api/README.md)) |
| `docs/` | Plan del proyecto (PDF) y diagramas |
| `docs/metadata/` | Especificación oficial de los archivos SEPA, minorista (Anexo II, Res. 678/2020) y mayorista |
| `prototipo/` | Prototipo en Python que se usó para medir. Referencia histórica: la versión en TypeScript lo reemplaza |
| `muestras/` | 1.000 productos de ejemplo ya procesados y la prueba de la regla de descripción |

## Desarrollo

Requiere Node 22 o superior. Guía para colaborar en [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
npm install
npm test            # tests
npm run typecheck   # tipos
npm run lint        # ESLint
npm run format      # Prettier
```

## Fuente de los datos y licencia

Datos: [Precios Claros – Base SEPA](https://datos.produccion.gob.ar/dataset/sepa-precios), Subsecretaría de Defensa del Consumidor y Lealtad Comercial. Licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es). Datos procesados y modificados por BarrasAR (limpieza, unificación y normalización).

Los datos son los que informan los comercios y pueden contener errores. Este proyecto no está respaldado por el Gobierno argentino. Las marcas mencionadas pertenecen a sus titulares.

- Código: MIT.
- Datos que devuelve la API: CC BY 4.0, la misma licencia que la fuente.
