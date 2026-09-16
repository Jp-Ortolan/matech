# -*- coding: utf-8 -*-
"""Diagrama de componentes do MATECH, em SVG puro e três camadas."""
import io

L = []
def add(s): L.append(s)

VERDE, TINTA, CINZA, BORDA = '#1B4D33', '#1f2422', '#5a6360', '#8b938f'
CLARO, CAMADA, FUNDO = '#eef3f0', '#f5f6f5', '#ffffff'
F = "Segoe UI, Helvetica, Arial, sans-serif"
LARG, ALT = 1240, 960

def txt(x, y, t, tam=13, cor=TINTA, peso='400', anc='middle', it=None, esp=None):
    e = f' letter-spacing="{esp}"' if esp else ''
    i = f' font-style="{it}"' if it else ''
    add(f'<text x="{x}" y="{y}" font-size="{tam}" fill="{cor}" font-weight="{peso}" '
        f'text-anchor="{anc}"{e}{i}>{t}</text>')

def camada(x0, y0, x1, y1, rotulo):
    add(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" rx="6" fill="{CAMADA}" '
        f'stroke="{BORDA}" stroke-width="1.2" stroke-dasharray="7 4"/>')
    txt(x0 + 14, y0 + 20, rotulo, 11.5, CINZA, '700', 'start', esp='1.6')

def componente(x0, y0, x1, y1, titulo, sub=None):
    """Caixa com o ícone de componente da UML no canto."""
    add(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" rx="4" fill="{FUNDO}" '
        f'stroke="{VERDE}" stroke-width="1.6"/>')
    ix, iy = x1 - 34, y0 + 12
    add(f'<rect x="{ix}" y="{iy}" width="20" height="15" fill="{FUNDO}" stroke="{VERDE}" stroke-width="1.2"/>')
    for dy in (3, 9):
        add(f'<rect x="{ix-5}" y="{iy+dy}" width="9" height="4" fill="{FUNDO}" stroke="{VERDE}" stroke-width="1.2"/>')
    txt(x0 + 16, y0 + 22, titulo, 13.5, TINTA, '700', 'start')
    if sub:
        txt(x0 + 16, y0 + 38, sub, 11, CINZA, '400', 'start')

def peca(x0, y0, w, h, t, tam=12, fill=CLARO, borda=VERDE):
    add(f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="3" fill="{fill}" '
        f'stroke="{borda}" stroke-width="1.1"/>')
    txt(x0 + w/2, y0 + h/2 + 4, t, tam)

def seta(x1, y1, x2, y2, rotulo=None, rot2=None, trac=False, lado='middle', dx=8):
    d = ' stroke-dasharray="6 4"' if trac else ''
    add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{CINZA}" stroke-width="1.4"{d} '
        f'marker-end="url(#pf)"/>')
    if rotulo:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        txt(mx + dx, my - (8 if rot2 else 2), rotulo, 11, CINZA, '400', lado)
        if rot2:
            txt(mx + dx, my + 8, rot2, 11, CINZA, '400', lado)

def cilindro(cx, cy, w, h, l1, l2):
    x0, y0, ry = cx - w/2, cy - h/2, 12
    add(f'<path d="M {x0} {y0+ry} a {w/2} {ry} 0 0 1 {w} 0 v {h-2*ry} a {w/2} {ry} 0 0 1 {-w} 0 Z" '
        f'fill="{CLARO}" stroke="{VERDE}" stroke-width="1.6"/>')
    add(f'<path d="M {x0} {y0+ry} a {w/2} {ry} 0 0 0 {w} 0" fill="none" stroke="{VERDE}" stroke-width="1.6"/>')
    txt(cx, cy + 2, l1, 12.5, TINTA, '700')
    txt(cx, cy + 18, l2, 11, CINZA)

add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{LARG}" height="{ALT}" '
    f'viewBox="0 0 {LARG} {ALT}" font-family="{F}">')
add(f'<defs><marker id="pf" markerWidth="9" markerHeight="9" refX="8" refY="3.2" orient="auto">'
    f'<path d="M0,0 L8,3.2 L0,6.4 z" fill="{CINZA}"/></marker></defs>')
add(f'<rect width="{LARG}" height="{ALT}" fill="{FUNDO}"/>')
txt(LARG/2, 34, 'MATECH · Diagrama de Componentes', 19, TINTA, '700')

# ─────────────────────────────────────────── camada de apresentação
camada(50, 58, 1190, 288, 'CAMADA DE APRESENTAÇÃO')
componente(70, 84, 600, 270, 'Cliente Web', 'React 19 · Vite 8 · Tailwind 4 · React Router')
TELAS = ['Painel · Pesagem · Avaliações de qualidade',
         'Avaliações de campo · Sincronização',
         'Produtores · Matéria-prima',
         'Pagamentos · Relatórios',
         'Configurações · Usuários']
for i, t in enumerate(TELAS):
    peca(90, 130 + i * 28, 490, 24, t, 11.5)

componente(650, 84, 1170, 270, 'Cliente Móvel', 'Flutter 3.44 · Dart 3.12 · local-first')
peca(690, 130, 440, 26, 'Telas de coleta', 11.5)
peca(690, 172, 440, 26, 'DAOs · gravam no SQLite', 11.5)
peca(690, 214, 440, 26, 'Sincronizador · fila Outbox', 11.5)
for y in (156, 198):
    add(f'<line x1="910" y1="{y}" x2="910" y2="{y+16}" stroke="{CINZA}" stroke-width="1.4" marker-end="url(#pf)"/>')

# ─────────────────────────────────────────── camada de aplicação
camada(50, 330, 1190, 660, 'CAMADA DE APLICAÇÃO')
componente(70, 356, 1170, 642, 'API REST', 'Node.js 24 · Express 5 · sem estado')
peca(100, 400, 1040, 40, 'Middlewares · autenticar (JWT) → permitir() para negócio · apenas() para administração de contas',
     12, '#e4eee8')
MODS = ['auth', 'usuarios', 'produtores', 'motoristas', 'cargas',
        'qualidade', 'pagamentos', 'sincronizacao', 'avaliacoes']
for i, m in enumerate(MODS):
    lin, col = divmod(i, 5)
    peca(100 + col * 209, 470 + lin * 52, 194, 40, m, 12.5, FUNDO)
txt(620, 606, 'cada módulo: rota → controlador → serviço', 11.5, CINZA, '400', it='italic')
add(f'<line x1="100" y1="440" x2="100" y2="470" stroke="{CINZA}" stroke-width="1.2"/>')
add(f'<line x1="100" y1="455" x2="1140" y2="455" stroke="{CINZA}" stroke-width="1.2"/>')
add(f'<line x1="1140" y1="440" x2="1140" y2="470" stroke="{CINZA}" stroke-width="1.2"/>')

# ─────────────────────────────────────────── camada de dados
camada(50, 700, 1190, 900, 'CAMADA DE DADOS')
cilindro(230, 810, 240, 110, 'PostgreSQL 18', '12 tabelas · fonte da verdade')
add(f'<path d="M 540 780 h 90 l 14 16 h 96 v 76 h -200 Z" fill="{CLARO}" stroke="{VERDE}" stroke-width="1.6"/>')
txt(640, 830, 'uploads/fotos', 12.5, TINTA, '700')
txt(640, 848, 'arquivos do erval', 11, CINZA)
cilindro(1010, 810, 240, 110, 'SQLite · sqflite', '7 tabelas + fila Outbox')

# ─────────────────────────────────────────── ligações entre camadas
seta(335, 270, 335, 400, 'HTTPS · REST sem estado', 'JSON + Bearer token', lado='start')
seta(910, 270, 910, 400, 'POST /api/sincronizacao', 'lote idempotente por clientId', lado='start')
seta(230, 642, 230, 755, 'Prisma 7 + adapter-pg', lado='start')
seta(640, 642, 640, 780, 'express.raw · imagem', lado='start')
add(f'<line x1="1170" y1="185" x2="1205" y2="185" stroke="{CINZA}" stroke-width="1.4" stroke-dasharray="6 4"/>')
add(f'<line x1="1205" y1="185" x2="1205" y2="810" stroke="{CINZA}" stroke-width="1.4" stroke-dasharray="6 4"/>')
add(f'<line x1="1205" y1="810" x2="1134" y2="810" stroke="{CINZA}" stroke-width="1.4" stroke-dasharray="6 4" marker-end="url(#pf)"/>')
txt(1196, 316, 'local-first: lê e grava sem rede', 11, CINZA, '400', 'end')

def nota(x, y, w, h, linhas):
    d = 14
    add(f'<path d="M {x} {y} H {x+w-d} L {x+w} {y+d} V {y+h} H {x} Z" fill="{CAMADA}" stroke="{BORDA}"/>')
    add(f'<path d="M {x+w-d} {y} V {y+d} H {x+w}" fill="none" stroke="{BORDA}"/>')
    for i, t in enumerate(linhas):
        txt(x + 12, y + 21 + i * 15, t, 11, CINZA, '400', 'start')

nota(50, 912, 1140, 40, [
    'A regra de negócio vive apenas na camada de aplicação: os dois clientes só apresentam. O cliente móvel nunca fala com o PostgreSQL — ele grava no SQLite e o',
    'sincronizador leva a fila embora, o que faz o aplicativo se comportar igual com e sem sinal.',
])

add('</svg>')
io.open('componentes.svg', 'w', encoding='utf-8').write('\n'.join(L))
print('componentes.svg gerado')
