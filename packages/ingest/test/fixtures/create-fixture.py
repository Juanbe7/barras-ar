"""Builds sepa-mini.zip: a small "ZIP of ZIPs" with real chains from 2026-10-29,
chain 36 (empty, as SEPA ships it) and a corrupt chain 99 (made up, to test error handling).

Usage: python create-fixture.py ../../../../in/sepa_jueves.zip sepa-mini.zip
"""
import sys
import zipfile

source, target = sys.argv[1], sys.argv[2]
chains = {"-4_", "-23_", "-3_", "-36_"}
with zipfile.ZipFile(source) as z, zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as out:
    out.writestr("2026-10-29/", "")
    for info in z.infolist():
        if info.filename.endswith(".zip") and any(c in info.filename for c in chains):
            out.writestr(info.filename, z.read(info))
    out.writestr("2026-10-29/sepa_1_comercio-sepa-99_2026-10-29_09-05-11.zip", b"this is not a zip")
