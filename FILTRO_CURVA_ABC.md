# Filtro de curva ABC no catálogo

Arquivos alterados: `index.html`, `app.js`, `styles.css`.

## Onde fica

No cabeçalho do card *Catálogo em lista*, à esquerda do filtro de situação já
existente. Os dois ficam agrupados em `.header-filters`, que quebra em linhas
abaixo de 560px em vez de transbordar.

```
Catalogo em lista          [ Todas as curvas (1788) ▾ ] [ Produtos ativos ▾ ]
```

## Como funciona

Quatro opções: **Todas as curvas**, **Classe A**, **Classe B** e **Classe C**.
Cada rótulo traz, entre parênteses, quantos produtos cairiam naquela curva
**com os outros filtros já aplicados** — busca e situação. Assim a escolha não
vira tentativa e erro: buscando "racao" entre os ativos, por exemplo, o seletor
mostra `Classe A (1)`, `Classe B (1)`, `Classe C (10)`.

A classe usada no filtro é exatamente a que aparece na coluna ABC da tabela
(função `productAbcClass`), então filtro e coluna nunca discordam. O cálculo
continua sendo o do sistema: produtos ordenados por valor de venda, A até 80%
do acumulado, B até 95%, C no resto — e o ranking considera somente produtos
ativos, como já era antes.

Trocar a curva volta para a página 1 da paginação, igual aos outros filtros.

## Permissões

| Perfil | Vê o filtro de curva | Vê o filtro de situação |
|---|---|---|
| Admin | sim | sim |
| Comprador | sim | não |
| Compras internas | sim | não |
| Loja Iconha / Loja Reta | **não** | não |

O perfil `loja` não vê preços nem indicadores no catálogo — essa regra já
existia, e o filtro de curva segue ela.

## Verificação

Testado no navegador com os três perfis e todas as combinações:

- contagens batem com o total: A 164 + B 358 + C 1266 = 1788 produtos ativos
- cada seleção devolve só a classe escolhida na coluna ABC da tabela
- combinado com busca: "racao" → 12 produtos, e Classe A dentro deles → 1
- combinado com situação: os 14 produtos arquivados caem todos em C (ficam fora
  do ranking), e Classe A + arquivados devolve 0 com o estado vazio correto
- estando na página 5, trocar a curva volta para a página 1
- perfil loja: o seletor não aparece e o catálogo continua sem a coluna ABC
- layout auditado em 360, 420, 768 e 1440px: sem transbordo e sem espaçamento
  fora do padrão; a 420px o seletor ocupa a linha inteira
