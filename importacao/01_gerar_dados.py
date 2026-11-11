# -*- coding: utf-8 -*-
"""Le catalogo.xls + vendas jan-out.xls e gera products.json pronto para importacao."""
import xlrd, json, re, unicodedata, collections, decimal

CAT = "C:/Users/PETVILLE/Desktop/catalogo.xls"
VEN = "C:/Users/PETVILLE/Desktop/vendas jan-out.xls"
OUT = "C:/Users/PETVILLE/AppData/Local/Temp/claude/9506f6168d7ab96d/b34517c1-1bab-46f0-920f-348a5734721d/scratchpad/products.json"
YEAR = 2026

def money(v):
    s = str(v or "").strip()
    if not s:
        return 0.0
    s = s.replace(".", "").replace(",", ".") if "," in s else s
    try:
        return round(float(s), 2)
    except ValueError:
        return 0.0

def clean_name(v):
    s = str(v or "").strip()
    s = re.sub(r"\s*\(desativado\)\s*$", "", s, flags=re.I)   # ignora o marcador (desativado)
    return re.sub(r"\s+", " ", s).strip()

def key_code(v):
    return str(v or "").strip().lower()

# ---------------- catalogo ----------------
cb = xlrd.open_workbook(CAT)
cs = cb.sheet_by_index(0)
products = []
by_code = {}
for r in range(1, cs.nrows):
    code = str(cs.cell_value(r, 1)).strip()
    name = clean_name(cs.cell_value(r, 2))
    if not code or not name:
        continue
    p = {
        "id": len(products) + 1,
        "code": code,
        "name": name,
        "price": money(cs.cell_value(r, 7)),      # preco de custo
        "salePrice": money(cs.cell_value(r, 5)),  # preco de venda
        "active": True,
        "sales": [0.0] * 12,
    }
    products.append(p)
    by_code[key_code(code)] = p

# ---------------- vendas ----------------
vb = xlrd.open_workbook(VEN)
vs = vb.sheet_by_index(0)
dm = vb.datemode
rows = [r for r in range(1, vs.nrows)
        if str(vs.cell_value(r, 0)).strip() and str(vs.cell_value(r, 1)).strip()]

groups = []          # (code, name, qty, Counter(mes -> transacoes))
for i, h in enumerate(rows):
    end = rows[i + 1] if i + 1 < len(rows) else vs.nrows
    code = str(vs.cell_value(h, 0)).strip()
    name = clean_name(vs.cell_value(h, 1))
    qty = vs.cell_value(h, 5)
    qty = float(qty) if isinstance(qty, float) else money(qty)
    months = collections.Counter()
    for r in range(h + 1, end):
        v = vs.cell_value(r, 7)
        if isinstance(v, float) and v > 1000:
            d = xlrd.xldate_as_datetime(v, dm)
            if d.year == YEAR:
                months[d.month] += 1
    groups.append((code, name, qty, months))

codes_in_sales = set(key_code(g[0]) for g in groups)

# ---------------- casamento por codigo, depois por nome ----------------
norm = lambda s: re.sub(r"[^A-Z0-9]+", " ",
        unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().upper()).strip()
by_name = {}
for p in products:
    by_name.setdefault(norm(p["name"]), p)

extra = []
matched_code = matched_name = 0
seen_codes = set()
for code, name, qty, months in groups:
    k = key_code(code)
    p = by_code.get(k)
    if p is not None:
        if k not in seen_codes:
            matched_code += 1
    else:
        p = by_name.get(norm(name))
        if p is not None:
            if k not in seen_codes:
                matched_name += 1
        else:
            p = {
                "id": None, "code": code, "name": name,
                "price": 0.0, "salePrice": 0.0, "active": False,
                "sales": [0.0] * 12,
            }
            extra.append(p)
            by_code[k] = p
    seen_codes.add(k)

    # distribui a quantidade do grupo pelos meses, na proporcao das transacoes do grupo
    total_tx = sum(months.values())
    if total_tx and qty:
        parts = [round(qty * months[m] / total_tx, 2) for m in range(1, 13)]
        diff = round(qty - sum(parts), 2)
        if abs(diff) >= 0.01:        # sobra do arredondamento vai para o mes mais forte
            best = max(range(12), key=lambda i: parts[i])
            parts[best] = round(parts[best] + diff, 2)
        for m in range(12):
            p["sales"][m] = round(p["sales"][m] + max(0.0, parts[m]), 2)

# ids dos produtos extras (somente vendas, fora do catalogo) -> arquivados
next_id = len(products) + 1
for p in extra:
    p["id"] = next_id
    next_id += 1
    products.append(p)

# nomes duplicados quebram o indice unico e a deduplicacao do app: desambigua com o codigo
seen = {}
dups = 0
for p in products:
    k = p["name"].strip().lower()
    if k in seen:
        p["name"] = "%s (%s)" % (p["name"], p["code"])
        dups += 1
    else:
        seen[k] = p

json.dump(products, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)

tot_qty_file = round(sum(g[2] for g in groups), 2)
tot_qty_out = round(sum(sum(p["sales"]) for p in products), 2)
with_sales = sum(1 for p in products if sum(p["sales"]) > 0)
print("produtos do catalogo .......", len(products) - len(extra))
print("linhas de produto no arquivo", len(groups))
print("codigos distintos ..........", len(codes_in_sales))
print("  casados por codigo .......", matched_code)
print("  casados por nome .........", matched_name)
print("  sem catalogo (arquivados) ", len(extra))
print("nomes desambiguados ........", dups)
print("total de produtos ..........", len(products))
print("produtos com vendas ........", with_sales)
print("qty total no arquivo .......", tot_qty_file)
print("qty total gravada ..........", tot_qty_out)
print("diferenca ..................", round(tot_qty_out - tot_qty_file, 2))
for m in range(12):
    s = round(sum(p["sales"][m] for p in products), 2)
    if s: print("  mes %02d: %s" % (m + 1, s))
