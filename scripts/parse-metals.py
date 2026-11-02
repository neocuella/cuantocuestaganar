"""Extract Tatakua 2026 metals from AdLatina's winners article and match them to the shortlist.

Usage:
  curl -sL -A "Mozilla/5.0" "https://www.adlatina.com/publicidad/tatakua-2026-oniria-tbwa-la-mejor-agencia-y-23-sports-la-indie-del-ao" -o /tmp/adlatina.html
  python3 scripts/parse-metals.py /tmp/adlatina.html site/data/shortlist-2026.json site/data/metals-2026.json

The article lists each metal as: ORO: -"Título", de Agencia.
Its category headings are incomplete, so metals are matched to an idea (title + agency), not to a subcategory.
Fails if a metal has no matching shortlist entry or an idea wins more metals than it had finalist entries.
"""
import collections
import html
import json
import re
import sys
import unicodedata

SOURCE = "https://www.adlatina.com/publicidad/tatakua-2026-oniria-tbwa-la-mejor-agencia-y-23-sports-la-indie-del-ao"


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9 ]", "", s).strip()


def article_text(path):
    s = open(path, encoding="utf-8", errors="replace").read()
    s = re.sub(r"(?is)<(script|style).*?</\1>", "", s)
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"\s+", " ", s)


def main(article, shortlist_path, dest):
    shortlist = json.load(open(shortlist_path, encoding="utf-8"))
    names = {}
    finalists = collections.Counter()
    for r in shortlist:
        key = (norm(r["title"]), norm(r["agency"]))
        names[key] = (r["title"], r["agency"])
        finalists[key] += 1

    found = re.findall(r'(ORO|PLATA|BRONCE): -"([^"]+)", de ([^.]+)\.', article_text(article))
    metals, won = [], collections.Counter()
    for medal, title, agency in found:
        key = (norm(title), norm(agency))
        if key not in names:
            sys.exit(f"No shortlist entry for {medal}: {title} / {agency}")
        won[key] += 1
        metals.append({"medal": medal.lower(), "title": names[key][0], "agency": names[key][1]})
    for key, n in won.items():
        if n > finalists[key]:
            sys.exit(f"{names[key]} won {n} metals but had {finalists[key]} finalist entries")

    with open(dest, "w", encoding="utf-8") as f:
        json.dump({"source": SOURCE, "metals": metals}, f, ensure_ascii=False, indent=2)
    print(f"{len(metals)} metals -> {dest}", dict(collections.Counter(m["medal"] for m in metals)))


if __name__ == "__main__":
    main(*sys.argv[1:4])
