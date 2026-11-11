# -*- coding: utf-8 -*-
"""Le FORNECEDOR.xls e gera suppliers.json pronto para importacao."""
import xlrd, json, re, unicodedata, collections

SRC = "C:/Users/PETVILLE/Desktop/FORNECEDOR.xls"
OUT = "suppliers.json"

def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]+", " ", s).strip()

def mask_cnpj(d):
    return "%s.%s.%s/%s-%s" % (d[0:2], d[2:5], d[5:8], d[8:12], d[12:14]) if len(d) == 14 else d

sh = xlrd.open_workbook(SRC).sheet_by_index(0)
raw = []
for r in range(1, sh.nrows):
    rz = re.sub(r"\s+", " ", str(sh.cell_value(r, 0)).replace("\xa0", " ")).strip()
    nf = re.sub(r"\s+", " ", str(sh.cell_value(r, 1)).replace("\xa0", " ")).strip()
    cn = re.sub(r"\D", "", str(sh.cell_value(r, 2)))
    raw.append({"row": r, "razao": rz, "fantasia": nf, "cnpj": cn})

skipped = []

# 1) linhas que nao sao fornecedor
kept = []
for x in raw:
    if x["razao"] in ("", "---"):
        skipped.append((x["row"], x["razao"], "linha separadora"))
    elif re.match(r"^\d{14}(?!\d)", x["razao"]):
        # razao social com o CNPJ colado no inicio (separador variavel) -> registro corrompido
        x["cnpj"] = x["cnpj"] or x["razao"][:14]
        x["razao"] = re.sub(r"^[\s\W_]+", "", x["razao"][14:]).strip()
        x["_corrompido"] = True
        kept.append(x)
    elif norm(x["razao"]) == "FORNECEDOR EXEMPLO":
        skipped.append((x["row"], x["razao"], "registro de exemplo do ERP"))
    else:
        kept.append(x)

# 2) mesmo CNPJ = mesmo estabelecimento -> um unico fornecedor
by_cnpj = collections.OrderedDict()
singles = []
for x in kept:
    if x["cnpj"]:
        by_cnpj.setdefault(x["cnpj"], []).append(x)
    else:
        singles.append(x)

merged = []
for cnpj, grp in by_cnpj.items():
    if len(grp) > 1:
        # mantem a razao social mais completa e a melhor fantasia do grupo
        best = max(grp, key=lambda g: len(g["razao"]))
        fant = ""
        for g in grp:
            if g["fantasia"] and norm(g["fantasia"]) != norm(best["razao"]):
                fant = g["fantasia"]
                break
        fant = fant or best["fantasia"]
        for g in grp:
            if g is not best:
                motivo = "CNPJ repetido de %s" % best["razao"]
                if g.get("_corrompido"):
                    motivo += " (linha com CNPJ colado no nome)"
                skipped.append((g["row"], g["razao"], motivo))
        merged.append({**best, "fantasia": fant})
    else:
        merged.append(grp[0])
merged.extend(singles)
merged.sort(key=lambda x: (norm(x["razao"]), x["cnpj"]))

# 3) nomes repetidos (filiais) precisam ser unicos: indice unico em lower(name)
#    no banco e deduplicacao por nome no app.js
groups = collections.defaultdict(list)
for x in merged:
    groups[norm(x["razao"])].append(x)

suppliers = []
desambiguados = 0
for x in merged:
    name = x["razao"]
    if len(groups[norm(x["razao"])]) > 1:
        if x["fantasia"] and norm(x["fantasia"]) != norm(x["razao"]):
            sufixo = x["fantasia"]
        elif len(x["cnpj"]) == 14:
            filial = x["cnpj"][8:12]
            sufixo = "matriz" if filial == "0001" else "filial %s" % filial
        else:
            sufixo = "sem CNPJ"
        name = "%s (%s)" % (name, sufixo)
        desambiguados += 1

    notas = []
    if x["cnpj"]:
        notas.append("CNPJ: %s" % mask_cnpj(x["cnpj"]))
    else:
        notas.append("CNPJ nao informado na planilha")
    if x["fantasia"] and norm(x["fantasia"]) != norm(x["razao"]):
        notas.append("Nome fantasia: %s" % x["fantasia"])

    suppliers.append({
        "id": len(suppliers) + 1,
        "name": name,
        "contact": "",
        "phone": "",
        "terms": "",
        "notes": " | ".join(notas),
        "_cnpj": x["cnpj"],
        "_row": x["row"],
    })

# checagem final de unicidade
dup = [k for k, v in collections.Counter(norm(s["name"]) for s in suppliers).items() if v > 1]
assert not dup, "nomes ainda duplicados: %s" % dup

json.dump(suppliers, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print("linhas na planilha ............", len(raw))
print("fornecedores a importar .......", len(suppliers))
print("nomes desambiguados ...........", desambiguados)
print("com CNPJ ......................", sum(1 for s in suppliers if s["_cnpj"]))
print("sem CNPJ ......................", sum(1 for s in suppliers if not s["_cnpj"]))
print()
print("IGNORADOS (%d):" % len(skipped))
for row, nome, motivo in sorted(skipped):
    print("  linha %-3s %-52s %s" % (row, nome[:52], motivo))
print()
print("NOMES DESAMBIGUADOS:")
for s in suppliers:
    if s["name"].endswith(")") and " (" in s["name"]:
        print("  ", s["name"])
