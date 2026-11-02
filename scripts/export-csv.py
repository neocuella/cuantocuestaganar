"""Export the 2026 data as CSV, with the same rules the site uses (site/app.js).

Usage:
  python3 scripts/export-csv.py site/data/shortlist-2026.json site/data/metals-2026.json site/data

Writes three files (UTF-8 with BOM so Excel keeps the accents, comma-separated, amounts in
guaraníes as whole numbers):
  finalistas-2026.csv  one row per finalist entry, as listed in the shortlist
  ideas-2026.csv       one row per idea (same title + same entrant), with its metals and points
  inscriptos-2026.csv  one row per entrant: investment, metals, points and cost per metal/point

Metals are assigned to the idea, not to a single entry (the winners list doesn't name every
subcategory), so finalistas-2026.csv has no metal column.
"""
import collections
import csv
import json
import os
import sys

# Keep in sync with site/app.js
PRODUCTORAS = {"THE LAB", "SYNCHRO", "HEI FILMS", "BARRACO FILMS", "RENOVATIO FILMS", "GUARANI FILMS", "SUENA POLENTA"}
GRAN_TATAKUA = {("EL CREATIVO", "SMASHED RACTIS")}
AWARDS = {
    "ONIRIA TBWA": "Agencia del Año",
    "VEINTITRÉS": "Agencia Independiente del Año",
    "THE LAB": "Productora del Año",
}
POINTS = {"gran": 15, "oro": 9, "plata": 6, "bronce": 3, "finalista": 1}
MEDALS = ("oro", "plata", "bronce")


def kind(name):
    return "productora" if name in PRODUCTORAS else "agencia"


def points(medals, entries, grans):
    # A metal replaces the finalist point; a Gran Tatakua adds on top of its gold
    metal_count = sum(medals.values())
    return sum(medals[m] * POINTS[m] for m in MEDALS) + (entries - metal_count) * POINTS["finalista"] + grans * POINTS["gran"]


def write(path, header, rows):
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"{path}: {len(rows)} filas")


def main(shortlist_path, metals_path, out_dir):
    rows = json.load(open(shortlist_path, encoding="utf-8"))
    metals = json.load(open(metals_path, encoding="utf-8"))["metals"]

    medals_by_idea = collections.defaultdict(collections.Counter)
    for m in metals:
        medals_by_idea[(m["agency"], m["title"])][m["medal"]] += 1

    write(
        os.path.join(out_dir, "finalistas-2026.csv"),
        ["bloque", "categoria", "codigo_subcategoria", "subcategoria", "idea", "inscripto", "tipo_inscripto", "marca", "formato", "costo_gs"],
        [[r["block"], r["category"], r["subcategoryCode"], r["subcategory"], r["title"], r["agency"], kind(r["agency"]), r["brand"], r["format"], r["feeGs"]] for r in rows],
    )

    ideas = collections.OrderedDict()
    for r in rows:
        ideas.setdefault((r["agency"], r["title"]), []).append(r)
    idea_rows = []
    for (agency, title), entries in ideas.items():
        medals = {m: medals_by_idea[(agency, title)][m] for m in MEDALS}
        gran = int((agency, title) in GRAN_TATAKUA)
        brand = collections.Counter(e["brand"] for e in entries).most_common(1)[0][0]
        idea_rows.append([
            agency, kind(agency), title, brand, len(entries), sum(e["feeGs"] for e in entries),
            medals["oro"], medals["plata"], medals["bronce"], gran,
            len(entries) - sum(medals.values()), points(medals, len(entries), gran),
        ])
    idea_rows.sort(key=lambda x: (x[0], -x[5], x[2]))
    write(
        os.path.join(out_dir, "ideas-2026.csv"),
        ["inscripto", "tipo_inscripto", "idea", "marca", "finalistas", "inversion_gs", "oro", "plata", "bronce", "gran_tatakua", "finalistas_sin_metal", "puntos"],
        idea_rows,
    )

    by_agency = collections.OrderedDict()
    for r in idea_rows:
        by_agency.setdefault(r[0], []).append(r)
    agency_rows = []
    for agency, its in by_agency.items():
        entries = sum(i[4] for i in its)
        total = sum(i[5] for i in its)
        medals = {m: sum(i[6 + k] for i in its) for k, m in enumerate(MEDALS)}
        grans = sum(i[9] for i in its)
        metal_count = sum(medals.values())
        pts = points(medals, entries, grans)
        agency_rows.append([
            agency, kind(agency), len(its), entries, total,
            medals["oro"], medals["plata"], medals["bronce"], metal_count, grans, pts,
            round(total / metal_count) if metal_count else "", round(total / pts),
            AWARDS.get(agency, ""),
        ])
    agency_rows.sort(key=lambda x: (x[1] != "agencia", -x[4], x[0]))
    write(
        os.path.join(out_dir, "inscriptos-2026.csv"),
        ["inscripto", "tipo_inscripto", "ideas", "finalistas", "inversion_gs", "oro", "plata", "bronce", "metales", "gran_tatakua", "puntos", "gs_por_metal", "gs_por_punto", "premio_del_ano"],
        agency_rows,
    )


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
