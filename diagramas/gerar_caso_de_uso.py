# -*- coding: utf-8 -*-
"""
Gera o diagrama de casos de uso do MATECH em SVG puro.

Por que SVG à mão e não Mermaid: o Mermaid não tem diagrama de casos de uso.
Desenhar aqui dá o vocabulário certo — ator boneco-palito, elipse, fronteira do
sistema, generalização de ator e «include» — que é o que a banca espera ver.
"""
import io

L = []                      # linhas do SVG
def add(s): L.append(s)

VERDE, TINTA, CINZA, BORDA = '#1B4D33', '#1f2422', '#5a6360', '#8b938f'
CLARO, FUNDO = '#eef3f0', '#ffffff'
FONTE = "Segoe UI, Helvetica, Arial, sans-serif"

LARG, ALT = 1200, 1320
BX0, BX1, BY0, BY1 = 300, 1120, 70, 1150      # fronteira do sistema
UCX, UCRX, UCRY = 700, 190, 27                # coluna e raio das elipses
ATX = 110                                      # coluna dos atores
BUS = 42                                       # calha da generalização

def ator(x, y, nome, linhas=None):
    """Boneco palito com o rótulo embaixo."""
    add(f'<circle cx="{x}" cy="{y-26}" r="13" fill="none" stroke="{VERDE}" stroke-width="2"/>')
    add(f'<line x1="{x}" y1="{y-13}" x2="{x}" y2="{y+16}" stroke="{VERDE}" stroke-width="2"/>')
    add(f'<line x1="{x-20}" y1="{y-2}" x2="{x+20}" y2="{y-2}" stroke="{VERDE}" stroke-width="2"/>')
    add(f'<line x1="{x}" y1="{y+16}" x2="{x-16}" y2="{y+40}" stroke="{VERDE}" stroke-width="2"/>')
    add(f'<line x1="{x}" y1="{y+16}" x2="{x+16}" y2="{y+40}" stroke="{VERDE}" stroke-width="2"/>')
    for i, t in enumerate(linhas or [nome]):
        add(f'<text x="{x}" y="{y+58+i*15}" font-family="{FONTE}" font-size="13" '
            f'font-weight="600" fill="{TINTA}" text-anchor="middle">{t}</text>')

def caso(y, texto, movel=False):
    add(f'<ellipse cx="{UCX}" cy="{y}" rx="{UCRX}" ry="{UCRY}" fill="{FUNDO}" '
        f'stroke="{VERDE}" stroke-width="1.6"/>')
    add(f'<text x="{UCX}" y="{y+5}" font-family="{FONTE}" font-size="13.5" '
        f'fill="{TINTA}" text-anchor="middle">{texto}</text>')
    if movel:
        add(f'<rect x="905" y="{y-11}" width="76" height="22" rx="3" fill="{CLARO}" stroke="{VERDE}"/>')
        add(f'<text x="943" y="{y+4}" font-family="{FONTE}" font-size="10.5" '
            f'font-weight="600" fill="{VERDE}" text-anchor="middle">app móvel</text>')

def assoc(ax, ay, uy):
    """Associação ator -> caso de uso, entrando pela esquerda da elipse."""
    add(f'<line x1="{ax+24}" y1="{ay}" x2="{UCX-UCRX-4}" y2="{uy}" '
        f'stroke="{CINZA}" stroke-width="1.2"/>')

add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{LARG}" height="{ALT}" '
    f'viewBox="0 0 {LARG} {ALT}" font-family="{FONTE}">')
add(f'<rect width="{LARG}" height="{ALT}" fill="{FUNDO}"/>')

add(f'<text x="{LARG//2}" y="38" font-size="19" font-weight="700" fill="{TINTA}" '
    f'text-anchor="middle">MATECH · Diagrama de Casos de Uso</text>')

# fronteira do sistema
add(f'<rect x="{BX0}" y="{BY0}" width="{BX1-BX0}" height="{BY1-BY0}" rx="6" '
    f'fill="none" stroke="{BORDA}" stroke-width="1.6"/>')
add(f'<text x="{(BX0+BX1)//2}" y="{BY0+26}" font-size="13" font-weight="700" '
    f'fill="{CINZA}" text-anchor="middle" letter-spacing="1.5">SISTEMA MATECH</text>')

# ------------------------------------------------------------------ casos
CASOS = [
    (150,  'Registrar pesagem e emitir ticket', False),
    (225,  'Cadastrar motorista e veículo',     False),
    (330,  'Lançar análise de laboratório',     False),
    (405,  'Calcular desconto e valor a pagar', False),
    (510,  'Cadastrar produtor',                True),
    (585,  'Avaliar erval em campo',            True),
    (660,  'Sincronizar coleta do aparelho',    True),
    (765,  'Emitir ordem de pagamento',         False),
    (840,  'Confirmar pagamento',               False),
    (930,  'Administrar contas de acesso',      False),
    (1085, 'Consultar cargas, produtores e relatórios', False),
]

# ---------------------------------------------------- atores e associações
ATORES = [
    (190,  ['Operador', 'de Balança'],        [150, 225]),
    (350,  ['Analista', 'de Qualidade'],      [330]),
    (585,  ['Comprador /', 'Avaliador'],      [510, 585, 660]),
    (800,  ['Administrativo'],                [765, 840]),
    (930,  ['Administrador'],                 [930]),
]

for ay, rot, ligados in ATORES:
    for uy in ligados:
        assoc(ATX, ay, uy)

# generalização: os cinco perfis são especializações do usuário autenticado
PAI_Y = 1085
assoc(ATX, PAI_Y, 1085)
for ay, _, _ in ATORES:
    add(f'<line x1="{ATX-34}" y1="{ay}" x2="{BUS}" y2="{ay}" stroke="{CINZA}" '
        f'stroke-width="1.2" stroke-dasharray="0"/>')
add(f'<line x1="{BUS}" y1="190" x2="{BUS}" y2="{PAI_Y-34}" stroke="{CINZA}" stroke-width="1.2"/>')
add(f'<line x1="{BUS}" y1="{PAI_Y-34}" x2="{ATX-20}" y2="{PAI_Y-34}" stroke="{CINZA}" stroke-width="1.2"/>')
add(f'<polygon points="{ATX-20},{PAI_Y-34} {ATX-34},{PAI_Y-41} {ATX-34},{PAI_Y-27}" '
    f'fill="{FUNDO}" stroke="{CINZA}" stroke-width="1.2"/>')

for y, txt, movel in CASOS:
    caso(y, txt, movel)

# «include» da análise para o cálculo
add(f'<line x1="{UCX}" y1="{330+UCRY}" x2="{UCX}" y2="{405-UCRY-8}" stroke="{CINZA}" '
    f'stroke-width="1.2" stroke-dasharray="6 4"/>')
add(f'<polygon points="{UCX},{405-UCRY} {UCX-6},{405-UCRY-10} {UCX+6},{405-UCRY-10}" fill="{CINZA}"/>')
add(f'<text x="{UCX+12}" y="{368}" font-size="11.5" fill="{CINZA}" font-style="italic">'
    f'&#171;include&#187;</text>')

for ay, rot, _ in ATORES:
    ator(ATX, ay, rot[0], rot)
ator(ATX, PAI_Y, 'Usuário', ['Usuário', 'autenticado'])

# ------------------------------------------------------------------ notas
def nota(x, y, w, h, linhas):
    dobra = 14
    add(f'<path d="M {x} {y} H {x+w-dobra} L {x+w} {y+dobra} V {y+h} H {x} Z" '
        f'fill="#f5f6f5" stroke="{BORDA}" stroke-width="1"/>')
    add(f'<path d="M {x+w-dobra} {y} V {y+dobra} H {x+w}" fill="none" stroke="{BORDA}" stroke-width="1"/>')
    for i, t in enumerate(linhas):
        add(f'<text x="{x+12}" y="{y+22+i*16}" font-size="11.5" fill="{CINZA}">{t}</text>')

nota(40, 1195, 560, 92, [
    'Administrativo e Administrador passam também nas operações de negócio',
    'acima: o permitir() do servidor acrescenta os dois à lista de autorizados',
    'de toda rota. A administração de contas é a única operação em que isso',
    'não vale — ela usa apenas(&#39;ADMINISTRADOR&#39;), sem acréscimo automático.',
])
nota(630, 1195, 530, 92, [
    'Os casos marcados como app móvel são executados no aplicativo Flutter,',
    'sem conexão. Ficam gravados no SQLite do aparelho e sobem depois, pela',
    'rota de sincronização, com idempotência garantida pelo clientId.',
    'Os demais são executados no cliente web.',
])

add('</svg>')
io.open('caso_de_uso.svg', 'w', encoding='utf-8').write('\n'.join(L))
print('caso_de_uso.svg gerado ·', len('\n'.join(L)), 'bytes')
