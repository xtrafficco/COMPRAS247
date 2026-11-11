# Remodelagem do layout — responsivo e espaçamento padronizado

Arquivos alterados: `styles.css`, `index.html`, `app.js`.
Backups do estado anterior: `styles.css.bak`, `index.html.bak`, `app.js.bak`.

---

## 1. O problema do espaçamento

A distância entre os cards vinha de cinco lugares diferentes, e por isso não
batia de uma aba para a outra:

- `.summary-grid { margin-bottom: 18px }` e `.import-panel { margin-bottom: 18px }`
- `gap` próprio de cada grade: 14px, 16px, 12px, 10px
- `style="margin-top: 16px"`, `18px` e `14px` escritos direto no HTML (5 ocorrências)
- cards sem margem nenhuma, que ficavam colados — era o caso do primeiro card
  do *Histórico de preços*, grudado na faixa de indicadores abaixo dele

### Como ficou

Uma escala única em `:root`, e **um só gap** governando a pilha de cards:

```css
--gap-card: clamp(12px, 1.1vw + 6px, 20px);   /* entre cards */
--pad-card: clamp(14px, 0.9vw + 8px, 20px);   /* dentro do card */
--pad-card-y: clamp(12px, 0.6vw + 8px, 16px); /* cabeçalho/rodapé do card */
--pad-main: clamp(14px, 2vw + 4px, 32px);     /* respiro da área de conteúdo */
--space-1..7: 4px 8px 12px 16px 20px 24px 32px;
```

```css
.tab-panel.active {
  display: grid;
  gap: var(--gap-card);
  align-content: start;
}
```

Nenhum card carrega mais margem própria: a aba é uma grade e o espaçamento é o
`gap` dela. As margens inline saíram do HTML; onde um bloco precisa se separar de
outro **dentro** de um card, existe a classe `.block-gap`.

O mesmo token alimenta `.summary-grid`, `.import-panel`, `.order-layout`,
`.form-grid` e `.grid`, e `--pad-card` alimenta `.panel-body`, `.import-box`,
`.stat`, `.approval-card` e `.detail-grid`. Medido no navegador: em qualquer
largura, todos esses valores são **exatamente o mesmo número**.

Como são `clamp()`, o respiro cresce junto com a tela — 12px no celular, 20px a
partir de ~1.270px — sem nenhum breakpoint para isso.

---

## 2. O problema das resoluções

### Colunas fixas que estouravam

`.summary-grid` era `repeat(3, 1fr)`, `.dashboard-summary` e
`.price-history-summary` eram `repeat(4, 1fr)`, `.import-panel` e `.form-grid`
eram `1fr 1fr`. O número de colunas estava no CSS, não na largura disponível, e
só mudava em 1040px e 760px — entre esses pontos as colunas ficavam apertadas.

Agora todas usam `repeat(auto-fit, minmax(min(<largura>, 100%), 1fr))`: a
quantidade de colunas sai da largura real. O `min(..., 100%)` é o que impede o
estouro em telas muito estreitas.

### Menu lateral no celular

Antes, abaixo de 760px a sidebar virava um bloco no topo com as abas em duas
colunas. Para o perfil Admin são 14 abas, ou seja 7 linhas de botões empurrando
o conteúdo para muito abaixo da dobra.

Agora, abaixo de 900px ela é uma **gaveta sobreposta** (`position: fixed`,
`transform: translateX(-100%)`), aberta por um botão "Menu" que aparece só nesse
tamanho. Fecha ao escolher uma aba, ao clicar no fundo escuro, com `Esc`, ao sair
do sistema e ao voltar para a largura de desktop. Enquanto está aberta, a rolagem
do corpo fica travada; fechada, fica com `visibility: hidden` e sai da ordem de
tabulação. O botão tem `aria-expanded` e `aria-controls`.

### Outros ajustes

- `100dvh` ao lado de `100vh` em shell, sidebar, login e modal — resolve a barra
  de endereço do navegador móvel, que comia 100vh
- `minmax(0, 1fr)` nas colunas de grade e `min-width: 0` nos filhos: nome de
  produto ou de fornecedor comprido não estica mais a coluna
- campos de formulário a 16px no celular, que é o que evita o zoom automático do
  iOS ao focar um input (antes o CSS aumentava a fonte do `body` inteiro)
- tabela mais compacta até 640px (`padding` menor, `min-width` de 720 para 560),
  então mais colunas aparecem antes de precisar rolar
- barra de topo: a busca ocupa a linha inteira e os botões dividem a seguinte,
  em vez de quatro controles empilhados em largura cheia
- paginação, cabeçalho de card, rodapé de modal e cabeçalho de aprovação com
  `flex-wrap`, para quebrarem em vez de transbordar
- telas baixas (celular na horizontal): o card de login passa a alinhar no topo e
  a página rola, em vez de o card ser cortado em cima e embaixo

### Breakpoints

| Largura | O que muda |
|---|---|
| ≤ 1040px | pedido e segurança passam a uma coluna |
| ≤ 900px | sidebar vira gaveta; a rolagem passa a ser da página |
| ≤ 760px | barra de topo em coluna; campos a 16px; barra de métrica em 2 linhas |
| ≤ 640px | tabela compacta; paginação centralizada; inputs de tabela menores |
| ≤ 420px | tudo em uma coluna; toast de borda a borda |
| altura ≤ 560px | gaveta rolável; login alinhado ao topo |

---

## 3. Verificação

Auditoria rodada no navegador nas **14 abas do perfil Admin**, em 320, 360, 430,
740×360, 768, 900, 1024, 1280, 1440 e 1920px. Em todas:

- `scrollWidth == clientWidth` — nenhum transbordo horizontal da página
- nenhum elemento passando da largura da janela fora de um container de rolagem
- todas as distâncias entre cards iguais ao `gap` da aba (tolerância 0,6px)

Checado também: a tabela do catálogo (1.389px de largura) rola **dentro do card**
e não arrasta a página; o modal cabe na tela a 320px; o card de login fica
centrado com 17px de folga de cada lado a 320px; a gaveta abre em `translateX(0)`
com o fundo visível e fecha pelos cinco caminhos.

---

## 4. Correção: seções empilhadas dentro de um card

A primeira passagem padronizou a distância **entre cards**, mas deixou de fora o
empilhamento **dentro** de um card. No card *Dados do pedido* isso aparecia:

| Par de blocos | Antes | Vinha de |
|---|---|---|
| formulário → indicadores | 20px | `.block-gap` |
| indicadores → simulação de pagamentos | **0px** | nada |
| simulação → botão Enviar | 20px | `margin-bottom` da `.payment-sim` |

Ou seja, os três indicadores ficavam colados na faixa de simulação, e as outras
duas distâncias só batiam por coincidência de dois valores escritos em lugares
diferentes.

A correção é a mesma ideia aplicada às abas: quem define o espaçamento é a pilha,
não cada bloco.

```css
.panel-body.stack {
  display: grid;
  align-content: start;
  gap: var(--gap-card);
}

/* Botão solto na pilha mantém a largura do próprio rótulo. */
.panel-body.stack > .button {
  justify-self: start;
}
```

Aplicado em `.panel-body` que empilha seções: *Dados do pedido*,
*Cadastrar fornecedor* e o gráfico do *Histórico de preços*. A classe utilitária
`.block-gap` e a `margin-bottom` da `.payment-sim` foram removidas — ninguém mais
carrega margem própria.

Medido depois da correção, a 1.280px: os quatro blocos do card do pedido
(formulário, indicadores, simulação, botão) separados por **20px cada**, o mesmo
valor que separa os cards entre si, e o botão mantendo seus 180px de largura em
vez de esticar. Auditoria completa repetida em 360, 768, 1024, 1440 e 1920px,
agora cobrindo também as pilhas internas: nenhuma distância fora do padrão e
nenhum transbordo.
