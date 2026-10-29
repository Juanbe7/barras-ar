"""Builds sepa-wholesale-mini.zip: a small "ZIP of ZIPs" with real wholesale chains from 2026-10-29
(62 and 70 with products, 68 with a header and no rows, as SEPA ships it).

Usage: python create-wholesale-fixture.py path/to/sepa_mayorista_jueves.zip sepa-wholesale-mini.zip
"""
import sys
import zipfile

source, target = sys.argv[1], sys.argv[2]
chains = {"-62_", "-68_", "-70_"}
with zipfile.ZipFile(source) as z, zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as out:
    out.writestr("2026-10-29/", "")
    for info in z.infolist():
        if info.filename.endswith(".zip") and any(c in info.filename for c in chains):
            out.writestr(info.filename, z.read(info))
