# Prototipo de ingesta (Python)

Sirvió para medir el proyecto con datos reales. Es la referencia para escribir la versión en TypeScript, no el código final.

## Requisitos

Python 3.9 o superior, sin librerías externas.

## Uso

```bash
python3 catalogo.py ruta/a/sepa_jueves.zip productos.csv 2026-10-29
```

- Entrada: el ZIP del día del dataset SEPA minorista (un "ZIP de ZIPs": carpeta `AAAA-MM-DD/` con un ZIP por cadena).
- Salida: `productos.csv` con las columnas de la tabla `productos` (ver `schema.sql`).
- Con el ZIP del jueves 29/10/2026 (325 MB) tardó unos 3 minutos y generó 76.581 productos.

## Cargar en PostgreSQL

```bash
psql -f schema.sql
psql -c "\copy productos(ean,descripcion,marca,cantidad,unidad,categoria,texto_busqueda,precio_mediana,precio_min,precio_max,cadenas,fecha_precio) FROM 'productos.csv' CSV HEADER NULL ''"
```

## Qué hace, paso a paso

1. Recorre cada ZIP de cadena y saltea los vacíos (por ejemplo, el de la cadena 36).
2. Lee `productos.csv` (separador `|`, UTF-8 con BOM, descarta la línea final de texto).
3. Se queda con `productos_ean = 1` y valida el dígito verificador.
4. Por cada código y cadena, toma la variante más repetida entre sus sucursales.
5. Elige la descripción más completa, quitando sufijos como "BSA-80-gr.".
6. Elige la marca más repetida y la presentación más repetida, normalizada a g, ml o unidad.
7. Arma `texto_busqueda` con las palabras de todas las variantes.
8. Calcula el precio de referencia: mediana de las medianas de cada cadena, con mínimo y máximo (solo el precio de lista, sin promociones).

## Pendiente

- Categoría: reglas por palabras clave con las categorías del Anexo I de la Res. 678/2020.
- Si todas las cadenas informan "1 unidad", sacar la cantidad del texto ("X 10 ML").
