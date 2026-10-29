"""
Prototipo de ingesta de BarrasAR (referencia para pasar a TypeScript).

Lee un ZIP diario de SEPA minorista (el "ZIP de ZIPs" que se baja de
datos.produccion.gob.ar/dataset/sepa-precios) y genera productos.csv con una
fila por código de barras, con las columnas del modelo final:

  ean, descripcion, marca, cantidad, unidad, categoria, texto_busqueda,
  precio_mediana, precio_min, precio_max, cadenas, fecha_precio

Uso:
  python3 catalogo.py sepa_jueves.zip productos.csv

Con el ZIP del jueves 29/10/2026 tardó unos 3 minutos y generó 76.581 productos.
La categoría queda vacía: falta armar las reglas (ver el plan).
"""
import collections
import csv
import io
import re
import statistics
import sys
import unicodedata
import zipfile

csv.field_size_limit(10**9)

# ---------------------------------------------------------------- lectura

def leer_csv(zf, nombre):
    """Lee un CSV de SEPA: separador |, UTF-8 con BOM, CRLF y una línea final
    'Ultima actualizacion: ...' que se descarta porque no tiene todas las columnas."""
    with zf.open(nombre) as f:
        texto = io.TextIOWrapper(f, encoding="utf-8-sig", errors="replace", newline="")
        lector = csv.reader(texto, delimiter="|")
        cabecera = [h.strip() for h in next(lector)]
        for fila in lector:
            if len(fila) < len(cabecera):
                continue
            yield dict(zip(cabecera, fila))


def ean_valido(codigo):
    """Dígito verificador GTIN (sirve para EAN-8, UPC-A, EAN-13 con ceros a la izquierda)."""
    if not codigo.isdigit():
        return False
    digitos = [int(x) for x in codigo]
    cuerpo, verificador = digitos[:-1], digitos[-1]
    total = sum(d * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(cuerpo)))
    return (10 - total % 10) % 10 == verificador

# ---------------------------------------------------------------- normalización

UNIDADES = {
    "g": ["gr", "gr.", "grm", "g", "grs", "grs.", "gramos", "grm.", "gm"],
    "kg": ["kg", "kgm", "kgr", "kg.", "kilo", "kgs"],
    "ml": ["ml", "ml.", "cm3", "cc.", "cc", "cmq", "c3"],
    "l": ["l", "lt", "lt.", "ltr", "lts", "litro", "litros", "l."],
    "unidad": ["uni", "ea", "ud", "unidad", "un.", "uni.", "un", "u", "und", "unid",
               "unid.", "u.", "paquete", "pack", "cu", "unida"],
}
MAPA_UNIDADES = {alias: base for base, alias_list in UNIDADES.items() for alias in alias_list}

# Sufijo que agrega una cadena al final de la descripción, por ejemplo "BSA-80-gr."
SUFIJO_CADENA = re.compile(r"\s+[A-Z]{3}-[\d.]+-[a-zA-Z]+\.?(\s+[A-Z]{3}-[\d.]+-[a-zA-Z]+\.?)*\s*$")

PALABRAS_CORTAS_OK = {"DE", "CON", "SIN", "LA", "EL", "LOS", "LAS", "Y", "EN", "X", "P/", "PARA"}


def limpiar_descripcion(d):
    return re.sub(r"\s+", " ", SUFIJO_CADENA.sub("", d)).strip(" .,")


def sin_tildes_mayus(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().upper()


def palabras_busqueda(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.findall(r"[a-z0-9]+", s)


def elegir_marca(variantes):
    marcas = collections.Counter(
        sin_tildes_mayus(v["marca"]).strip()
        for v in variantes
        if v["marca"].strip() and sin_tildes_mayus(v["marca"]).strip() not in ("SIN MARCA", "GENERICO")
    )
    return marcas.most_common(1)[0][0] if marcas else ""


def elegir_descripcion(variantes, marca):
    def puntaje(d):
        tokens = re.findall(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]+\.?|\d+[\.,]?\d*", d)
        palabras = [t for t in tokens if t[0].isalpha()]
        completas = sum(1 for p in palabras if len(p.rstrip(".")) >= 4 and not p.endswith("."))
        abreviadas = sum(1 for p in palabras if p.endswith(".") or (len(p) <= 3 and p.upper() not in PALABRAS_CORTAS_OK))
        s = completas * 2 - abreviadas
        if marca and marca.split()[0] in sin_tildes_mayus(d):
            s += 3
        if re.search(r"\d", d):
            s += 2
        return s
    return max((v["descripcion"] for v in variantes), key=lambda d: (puntaje(d), len(d)))


def elegir_presentacion(variantes):
    """La presentación más repetida entre cadenas, normalizada a g, ml o unidad,
    descartando el '1 unidad' genérico si alguna cadena informa peso o volumen."""
    conteo = collections.Counter()
    for v in variantes:
        unidad = MAPA_UNIDADES.get(v["unidad"].strip().lower())
        try:
            cantidad = float(v["cantidad"].replace(",", "."))
        except ValueError:
            continue
        if not unidad or cantidad <= 0:
            continue
        if unidad == "kg":
            cantidad, unidad = cantidad * 1000, "g"
        if unidad == "l":
            cantidad, unidad = cantidad * 1000, "ml"
        conteo[(round(cantidad, 2), unidad)] += 1
    if not conteo:
        return None
    reales = [(k, n) for k, n in conteo.items() if not (k[1] == "unidad" and k[0] == 1)]
    return max(reales or list(conteo.items()), key=lambda kv: kv[1])[0]

# ---------------------------------------------------------------- proceso

def procesar(ruta_zip):
    """Devuelve {ean: {'variantes': [...], 'precios': {id_comercio: [precios]}}}.
    Una variante por cadena: la descripción/marca/presentación más repetida en sus sucursales."""
    por_cadena = collections.defaultdict(collections.Counter)   # (ean, comercio) -> Counter(variante)
    precios = collections.defaultdict(lambda: collections.defaultdict(list))
    externo = zipfile.ZipFile(ruta_zip)
    for info in externo.infolist():
        if not info.filename.endswith(".zip"):
            continue
        if info.file_size == 0:          # hay ZIP de cadena vacíos (ej. comercio 36)
            print("ZIP vacío:", info.filename, file=sys.stderr)
            continue
        interno = zipfile.ZipFile(io.BytesIO(externo.read(info)))
        nombre_productos = [n for n in interno.namelist() if n.endswith("productos.csv")][0]
        for p in leer_csv(interno, nombre_productos):
            codigo = p["id_producto"].strip()
            if p["productos_ean"].strip() != "1" or not ean_valido(codigo):
                continue
            ean = codigo.lstrip("0").zfill(13)
            comercio = p["id_comercio"].strip()
            variante = (
                limpiar_descripcion(p["productos_descripcion"].strip()),
                p["productos_marca"].strip(),
                p["productos_cantidad_presentacion"].strip(),
                p["productos_unidad_medida_presentacion"].strip(),
            )
            por_cadena[(ean, comercio)][variante] += 1
            try:
                precios[ean][comercio].append(float(p["productos_precio_lista"]))
            except ValueError:
                pass
        print("procesado", info.filename, file=sys.stderr)

    productos = collections.defaultdict(lambda: {"variantes": [], "precios": {}})
    for (ean, comercio), conteo in por_cadena.items():
        d, m, c, u = conteo.most_common(1)[0][0]
        productos[ean]["variantes"].append({"descripcion": d, "marca": m, "cantidad": c, "unidad": u})
    for ean, por_comercio in precios.items():
        productos[ean]["precios"] = por_comercio
    return productos


def ficha(ean, datos, fecha):
    variantes = datos["variantes"]
    marca = elegir_marca(variantes)
    descripcion = elegir_descripcion(variantes, marca)
    presentacion = elegir_presentacion(variantes)
    palabras = []
    for texto in [descripcion] + [v["descripcion"] for v in variantes] + [marca]:
        for p in palabras_busqueda(texto):
            if p not in palabras:
                palabras.append(p)
    medianas_por_cadena = [statistics.median(v) for v in datos["precios"].values() if v]
    return {
        "ean": ean,
        "descripcion": descripcion,
        "marca": marca,
        "cantidad": presentacion[0] if presentacion else "",
        "unidad": presentacion[1] if presentacion else "",
        "categoria": "",
        "texto_busqueda": " ".join(palabras),
        "precio_mediana": round(statistics.median(medianas_por_cadena), 2) if medianas_por_cadena else "",
        "precio_min": min(medianas_por_cadena) if medianas_por_cadena else "",
        "precio_max": max(medianas_por_cadena) if medianas_por_cadena else "",
        "cadenas": len(variantes),
        "fecha_precio": fecha,
    }


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    ruta_zip, salida = sys.argv[1], sys.argv[2]
    fecha = sys.argv[3] if len(sys.argv) > 3 else ""
    productos = procesar(ruta_zip)
    columnas = ["ean", "descripcion", "marca", "cantidad", "unidad", "categoria", "texto_busqueda",
                "precio_mediana", "precio_min", "precio_max", "cadenas", "fecha_precio"]
    with open(salida, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columnas)
        w.writeheader()
        for ean, datos in productos.items():
            w.writerow(ficha(ean, datos, fecha))
    print(f"{len(productos)} productos escritos en {salida}", file=sys.stderr)


if __name__ == "__main__":
    main()
