# Diagramas do MATECH

Três diagramas, cada um em **PNG** (para colar no artigo) e **SVG** (para
imprimir ou ampliar sem perder qualidade), com o **fonte** ao lado — que é o
equivalente ao arquivo do Astah, só que em texto e versionável no Git.

| Diagrama | Imagem | Fonte |
|---|---|---|
| Casos de uso | `caso_de_uso.png` · `.svg` | `gerar_caso_de_uso.py` |
| Classes de domínio | `classe_dominio.png` · `.svg` | `classes.mmd` |
| Componentes | `componentes.png` · `.svg` | `gerar_componentes.py` |

## O que cada um mostra

**Casos de uso** — os cinco perfis e o que cada um faz. Traz três construções
que a banca costuma procurar: a **fronteira do sistema**, a **generalização de
ator** (os cinco perfis são especializações de *Usuário autenticado*, que é
quem consulta) e um **«include»** (lançar a análise sempre inclui calcular o
desconto e o valor). Os casos marcados como *app móvel* rodam no Flutter, sem
conexão.

**Classes de domínio** — as 12 entidades com atributos e cardinalidades.
Repare nos campos `clientId`, `criadoOffline` e `alteradoEmOrigem`: são eles
que sustentam a sincronização. `RegistroSincronizacao` aparece separado de
propósito — não tem chave estrangeira para as demais, e a nota explica por quê.

**Componentes** — as três camadas e o que atravessa cada fronteira. Mostra que
o cliente móvel nunca fala com o PostgreSQL: ele grava no SQLite e o
sincronizador leva a fila embora.

## Como regenerar

Os dois SVG desenhados à mão só precisam de Python:

```bash
python3 gerar_caso_de_uso.py     # gera caso_de_uso.svg
python3 gerar_componentes.py     # gera componentes.svg
```

O de classes usa o Mermaid CLI:

```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i classes.mmd -o classe_dominio.svg -c mermaid-cfg.json -b white
mmdc -i classes.mmd -o classe_dominio.png -c mermaid-cfg.json -b white -s 2
```

Para converter um SVG desenhado à mão em PNG, qualquer navegador serve — abrir
o SVG e imprimir para PDF, ou usar o Chrome em modo headless:

```bash
chrome --headless --screenshot=saida.png --window-size=1200,1600 \
       --force-device-scale-factor=2 arquivo.svg
```

## Ajustar alguma coisa

Nos scripts Python, as listas no topo controlam o conteúdo: `CASOS` e `ATORES`
no de casos de uso, `TELAS` e `MODS` no de componentes. Mudar um texto é mudar
uma linha da lista e rodar de novo. As cores estão nas constantes `VERDE`,
`TINTA`, `CINZA` — são as mesmas da identidade do sistema.
