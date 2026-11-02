"""Parse the Tatakua 2026 shortlist PDF into structured rows.

Usage: python3 scripts/parse-shortlist.py docs/finalistas2026.pdf site/data/shortlist-2026.json

Reads pages 2-6 column by column (left, then right) with pdftotext -layout,
so entries stay under the subcategory heading printed above them.
"""
import json
import re
import subprocess
import sys

PAGES = range(2, 7)
COLUMNS = [(0, 298), (298, 297)]  # (x, width) in PDF points on an A4 page

# Fees from bases_condiciones_tatakua_2026.pdf, "Fechas y costos de inscripción" (IVA incluido)
FEE_PIEZA = 660_000
FEE_CAMPANA = 880_000
FEE_INTEGRADA = 990_000

BLOCKS = {
    "M": "Mensajes",
    "EP": "Experiencias",
    "I": "Interacción",
    "IN": "Integradas",
    "SL": "Sin lucro",
    "CB": "Creatividad para el bien",
    "ENT": "Entretenimiento",
    "P": "Producción y diseño",
}
CATEGORIES = {
    "MGR": "Gráficos", "MAV": "Audiovisuales", "MAU": "Audios",
    "EP": "Experiencias",
    "IDG": "Digital", "IDAT": "Datos", "IMC": "Mecánicas", "IDI": "Directo", "IPR": "PR",
    "IN": "Integradas", "SL": "Sin lucro", "CB": "Creatividad para el bien", "ENT": "Entretenimiento",
    "PGR": "Gráfica", "PAV": "Audiovisual", "PAU": "Audio", "PDI": "Diseño",
}

SUBCAT_RE = re.compile(r"^([A-Z]+)(\d+(?:-\d+)?)\.\s+(.*)$")


def block_for(prefix):
    if prefix in ("EP", "IN", "SL", "CB", "ENT"):
        return BLOCKS[prefix]
    return BLOCKS[prefix[0]]


def fee_for(code, name):
    if code.startswith("IN"):
        return FEE_INTEGRADA, "integrada"
    if "CAMPAÑA" in name:
        return FEE_CAMPANA, "campaña"
    if "PIEZA" in name:
        return FEE_PIEZA, "pieza"
    # Subcategory doesn't state a format (EP1, IDG1, ENT1, PAV1, SL3 ...): assume a single piece.
    return FEE_PIEZA, "pieza (asumido)"


def column_lines(pdf):
    for page in PAGES:
        for x, w in COLUMNS:
            out = subprocess.run(
                ["pdftotext", "-layout", "-f", str(page), "-l", str(page),
                 "-x", str(x), "-y", "0", "-W", str(w), "-H", "842", pdf, "-"],
                check=True, capture_output=True, text=True,
            ).stdout
            yield from out.splitlines()


def parse(pdf):
    rows, sub = [], None
    pending_header = False
    for raw in column_lines(pdf):
        line = raw.strip()
        if not line or line.startswith("BLOQUE") or line.startswith("CATEGORÍA"):
            continue
        m = SUBCAT_RE.match(line)
        if m:
            prefix, num, name = m.groups()
            sub = {"code": prefix + num, "prefix": prefix, "name": name}
            pending_header = name.endswith(" Y")  # IPR1 heading wraps onto a second line
            continue
        if pending_header:
            sub["name"] += " " + line
            pending_header = False
            continue
        if " / " in line or line.endswith(" /"):
            parts = [p.strip() for p in line.split("/")]
            rows.append({"_parts": parts, "sub": dict(sub)})
            continue
        if raw.startswith("  ") and not raw.startswith("   ") and rows:  # wrapped entry line
            last = rows[-1]["_parts"]
            last[-1] = (last[-1] + " " + line).strip()
            continue
        # Bloque titles that are not prefixed with "BLOQUE" (e.g. "LUCRO", "INTERACCION")
        continue

    out = []
    for r in rows:
        parts = [p for p in r["_parts"] if p]
        title, agency, brand = parts[0], parts[1], " / ".join(parts[2:])
        sub = r["sub"]
        fee, fmt = fee_for(sub["code"], sub["name"])
        out.append({
            "block": block_for(sub["prefix"]),
            "category": CATEGORIES[sub["prefix"]],
            "subcategoryCode": sub["code"],
            "subcategory": sub["name"],
            "title": title,
            "agency": agency,
            "brand": brand,
            "format": fmt,
            "feeGs": fee,
        })
    return out


if __name__ == "__main__":
    pdf, dest = sys.argv[1], sys.argv[2]
    data = parse(pdf)
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"{len(data)} shortlisted entries -> {dest}")
