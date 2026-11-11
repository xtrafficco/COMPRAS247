# Sistema de Compras — conexão com o Supabase ESTOQUE247

**Projeto:** `ydqgavcpefwcmqaebdnl` (ESTOQUE247, região `us-east-1`)
**URL:** `https://ydqgavcpefwcmqaebdnl.supabase.co`
**Chave pública (publishable):** `sb_publishable_ABUNhls7LVLz3Q7MgcrgcA_5adC7pem`

Essas duas constantes ficam em [app.js:52](app.js:52). O backup do arquivo anterior
está em `app.js.bak`.

---

## 1. O que foi criado no banco

Migrações aplicadas (visíveis em *Database > Migrations* no painel):

| Migração | Conteúdo |
|---|---|
| `purchase_v2_core_tables` | schema `app_private`, `app_profiles`, `app_state` e todas as tabelas `purchase_*` |
| `purchase_v2_triggers` | `updated_at`, validação de transição de status do pedido, totais de pedido/recebimento, auditoria |
| `purchase_v2_rls_policies` | RLS em todas as tabelas, grants, RPC `get_purchase_catalog`, listas e settings iniciais |
| `purchase_v2_catalog_audit_triggers` | auditoria de catálogo/preços e carimbo de autor em `app_state` |

O conteúdo é o de `supabase_purchase_v2.sql` (já existente no projeto), **mais** a
tabela `public.app_state`, que o `app.js` usa de fato e que não existia em nenhum
arquivo SQL — ela guarda o estado completo do aplicativo em JSON.

### `public.app_state`

```sql
create table public.app_state (
  id         text primary key default 'main',
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
```

RLS: todo usuário com perfil ativo **lê e grava** a linha `main` (o app salva o
estado inteiro a cada alteração); apenas `admin` pode criar ou apagar a linha.
`updated_by` é preenchido automaticamente por trigger.

Acesso anônimo está bloqueado em todas as tabelas (`revoke ... from anon`),
verificado: `GET /rest/v1/app_state` sem login retorna **401**.

### Usuários

5 contas em `auth.users` + `public.app_profiles`, com e‑mail já confirmado
(nenhum e‑mail foi enviado). Senhas iniciais em `CREDENCIAIS_INICIAIS.txt`
— **troque e apague o arquivo**.

| Perfil | E-mail | role | store_key |
|---|---|---|---|
| Admin | admin@petville | `admin` | — |
| Comprador | comprador@petville | `comprador` | — |
| LOJA ICONHA | lojaiconha@petville | `loja` | `iconha` |
| LOJA RETA | lojareta@petville | `loja` | `reta` |
| Compras internas | comprasinternas@petville | `compras_internas` | — |

---

## 2. Importação do catálogo e das vendas

Fontes: `catalogo.xls` (aba `produtos`) e `vendas jan-out.xls`
(aba `Venda por produto - Curva ABC`).

Scripts reutilizáveis em `importacao/`:

- `01_gerar_dados.py` — lê os dois .xls e gera `products.json` (precisa de `xlrd`)
- `02_importar_supabase.mjs` — envia para o Supabase via PostgREST autenticado como admin

### Catálogo

1.788 produtos. Colunas usadas: `código do produto` → `code`, `nome` → `name`,
`preço de custo` → `cost_price`, `preço de venda` → `sale_price`.
A coluna `desativar` está vazia em todas as linhas, então todos entraram ativos.

Seis nomes repetidos (`FRETE` ×5 e `ROUPA BLUSA SOFT MANGA CURTA N3` ×2) receberam
o código entre parênteses no nome — ex.: `FRETE (18022)`. Isso é obrigatório: o
`app.js` funde produtos de mesmo nome (`deduplicateProducts`) e o banco tem índice
único em `lower(name)`.

### Vendas (jan → out/2026)

O relatório traz, para cada produto, **uma linha de cabeçalho** com quantidade e
valor totais do período e, abaixo, **uma linha por venda contendo só a data de
emissão** — não há quantidade por venda. Foram 2.435 blocos, 45.407 transações,
intervalo de 02/01/2026 a 31/10/2026.

906 códigos aparecem em dois blocos: o produto foi recadastrado em meados de maio,
então um bloco tem o nome com `(desativado)` e cobre jan→maio e o outro cobre
maio→out. **Os dois são o mesmo produto** e foram somados no mesmo item do catálogo.

**Casamento com o catálogo (prioridade pelo código, como pedido):**

| | |
|---|---|
| códigos distintos no arquivo de vendas | 1.528 |
| casados pelo código | 1.509 |
| casados pelo nome (código não existe no catálogo) | 5 |
| sem correspondência → criados arquivados | 14 |

O sufixo `(desativado)` é removido do nome antes de qualquer comparação.
Os 14 produtos que só existem no arquivo de vendas foram cadastrados como
**arquivados** (`active = false`) para não perder o histórico — eles não aparecem
no catálogo nem entram em pedidos, mas ficam visíveis no filtro
*Produtos arquivados*. Total final: **1.802 produtos**.

**Como a quantidade virou venda mensal.** Como o relatório não traz quantidade por
transação, a quantidade total de cada bloco foi distribuída entre os meses na
proporção do número de transações daquele bloco em cada mês, com a sobra do
arredondamento jogada no mês mais forte. Cada bloco é distribuído separadamente
(o produto ativo e o `(desativado)` têm médias por venda diferentes) e depois
somados no produto. O total confere: 81.724,55 no arquivo × 81.724,59 gravados
(R$ 0,04 de arredondamento).

> Se o seu ERP exportar a quantidade **por mês** (ou por transação), refaça a
> importação com esses números: a distribuição proporcional deixa de ser necessária
> e o histórico fica exato.

Resultado: 6.592 linhas em `purchase_sales` (1.523 produtos com venda em 2026),
meses de janeiro a outubro preenchidos, novembro e dezembro vazios.

---

## 2.1 Importação dos fornecedores

Fonte: `FORNECEDOR.xls` (aba `Dados cadastrais fornecedores`), 90 linhas com
`Razão Social`, `Nome Fantasia` e `CNPJ`. Scripts: `importacao/03_gerar_fornecedores.py`
e `importacao/04_importar_fornecedores.mjs`.

**84 fornecedores importados.** O `name` recebeu a razão social, e o `notes` o CNPJ
formatado + o nome fantasia (quando difere da razão social). Os campos `contact`,
`phone` e condição de pagamento ficaram vazios — a planilha não traz esses dados;
é só preencher pela aba *Fornecedores*.

### 6 linhas não importadas

| Linha | Registro | Motivo |
|---|---|---|
| 1 | `---` | linha separadora |
| 7 | AGROMIX-INDUSTRIA E COMERCIO DE ALIMENTOS LTDA | CNPJ repetido — a linha 2 é o mesmo CNPJ com o número colado no nome (`55278220000173—AGROMIX...`); o nome foi limpo e as duas viraram um fornecedor |
| 10 | ALFA VET COMERCIO DE PRODUTOS AGROPECUAR | CNPJ repetido da linha 11 (razão social truncada) |
| 33 | FORNECEDOR EXEMPLO | registro de exemplo do ERP, sem CNPJ |
| 43 | INNOVAT FILIAL ES | linha duplicada idêntica à 42 |
| 70 | PASSARO MIX DISTRIBUIDORA DE RACAO | CNPJ repetido da linha 71 (razão social truncada) |

Nas duplicidades de CNPJ foi mantida a razão social mais completa e o nome fantasia
mais útil do grupo (ex.: `ALFA VET`, `PASSARO MIX`). Se quiser o
`FORNECEDOR EXEMPLO` no sistema, é só pedir.

`PETVILLE` (linha 73) **foi mantido** mesmo sem CNPJ: é a própria loja, usada no
fluxo de compras internas entre lojas.

### 18 nomes desambiguados (filiais)

9 razões sociais aparecem repetidas na planilha com CNPJ diferente — são filiais da
mesma empresa (ADIMAX, GUABI, MANFRIM ×3, NESTLÉ ×3, NUTRISANTOS, RPI, TECIDOS
MIGUEL BARTOLOMEU, VETTEC). Isso **não** podia entrar como está: o banco tem índice
único em `lower(name)` e o `app.js` funde fornecedores de mesmo nome, o que apagaria
filiais.

Cada nome repetido ganhou um sufixo entre parênteses:

- o **nome fantasia**, quando existe e identifica a unidade —
  `ADIMAX ... (INDUSTRIA SALTO DE PIRAPORA SP)`, `NESTLE BRASIL LTDA (BR DC Broker Ventura)`,
  `VETTEC PRODUTOS AGROPECUARIOS EIRELI (TECNEW)`
- o **número da filial do CNPJ**, quando o fantasia é igual à razão social ou está vazio —
  `MANFRIM INDUSTRIAL E COMERCIAL LTDA (matriz)`, `(filial 0002)`, `(filial 0004)`

Verificado na interface: a aba *Fornecedores* lista as 84 linhas e o seletor de
fornecedor do pedido mostra as 84 opções — nenhuma foi fundida.

---

## 3. Verificações feitas

- Login dos 5 perfis pelo endpoint real de autenticação: OK
- Leitura e gravação de `app_state` por cada perfil: OK
- Acesso anônimo (sem login): bloqueado (401) em `app_state`, `purchase_products` e `app_profiles`
- Aplicativo aberto no navegador como Admin: catálogo lista os 1.788 produtos ativos
  com preços, acentuação e classe ABC corretos
- Aba *Importação*: janeiro a outubro marcados como **preenchido**, 1.509 de 1.788
  produtos com venda em 2026
- Gravação ponta a ponta: item adicionado pela interface apareceu em
  `app_state.data->'list'` com `updated_by = admin@petville` (item removido depois)
- 84 fornecedores em `purchase_suppliers` e em `app_state`, conferidos na aba
  *Fornecedores* e no seletor de fornecedor do pedido

### Pendências de configuração (painel do Supabase, não dá para fazer por SQL)

- **Leaked password protection** está desativada — *Authentication > Policies*.
- Fornecedores entraram sem contato, telefone e condição de pagamento (a planilha
  não tem esses campos) — preencher pela aba *Fornecedores*.
- `public.get_purchase_catalog` aparece no linter como `SECURITY DEFINER` chamável
  por usuário autenticado. É intencional: a função checa o papel internamente e
  esconde preços e vendas do perfil `loja`.

---

## 4. Rodar o sistema

É um site estático. Qualquer servidor HTTP serve:

```bash
npx -y http-server . -p 5599 -c-1
```

Também já existe `.claude/launch.json` com essa configuração.


---

## 5. Exclusão dos produtos de granel ("KILO ...") — 11/11/2026

**150 produtos apagados em definitivo**, a pedido, por serem itens vendidos a
quilo no varejo (KILO ALPISTE, KILO MILHO, KILO ZORRO CAT...) e não unidades de
compra. O casamento foi exato: todos começavam com `KILO `, nenhum tinha "kilo"
no meio do nome e não havia nenhum "quilo".

Foi exclusão real, não arquivamento. Junto com os produtos foram embora, por
`ON DELETE CASCADE`:

| | Antes | Depois |
|---|---|---|
| `purchase_products` | 1.802 | 1.652 |
| `purchase_sales` | 6.592 | 5.609 |
| `purchase_price_history` | 1.802 | 1.652 |

As 983 linhas de venda removidas somavam 30.980,50 em quantidade e cerca de
**R$ 288 mil** — uns 23% do faturamento de jan a out/2026. Esse valor não aparece
mais em nenhum relatório do sistema.

**Backup antes de apagar:** `backup-produtos-kilo-removidos.json` (dados
completos, com as vendas mês a mês) e `backup-produtos-kilo-removidos.csv`
(planilha). É a única via de recuperação — o banco não tem volta.

Nenhum dos 150 estava em lista aberta, pedido ou cotação, então nada ficou órfão.
O `app_state` foi reconstruído a partir das tabelas, preservando fornecedores,
pedidos, ajustes e auditoria, e o evento ficou registrado na aba *Auditoria*.

Efeito colateral esperado: a **curva ABC foi recalculada** sobre o catálogo que
sobrou, porque o granel pesava bastante no faturamento.

| | Antes | Depois |
|---|---|---|
| Classe A | 164 | 126 |
| Classe B | 358 | 355 |
| Classe C | 1.266 | 1.158 |
| Ativos no catálogo | 1.788 | 1.639 |
