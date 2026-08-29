// ---------------------------------------------------------------------------
// MIDDLEWARE · autorização (você pode fazer isso?)
// ---------------------------------------------------------------------------
// A autenticação diz QUEM é o usuário. A autorização diz o que ele PODE fazer.
// São coisas diferentes e por isso ficam em arquivos diferentes.
//
// Atende ao RF15 e ao RNF04. Há UMA função que decide — conferir() — e duas
// portas de entrada para ela, porque existem dois tipos de operação no
// sistema e a diferença entre elas é real:
//
//   permitir(...)  → operação de NEGÓCIO. Pesar, analisar, pagar, cadastrar.
//                    Os dois perfis irrestritos passam sem precisar ser
//                    listados em cada rota.
//
//   apenas(...)    → operação de ADMINISTRAÇÃO DO SISTEMA. Abrir e fechar
//                    contas de acesso. Aqui não há acréscimo automático: só
//                    passa quem está escrito na rota, e ponto.
//
// Ter as duas no mesmo arquivo, sobre a mesma função, é o que impede o
// sistema de acabar com duas lógicas de autorização discordando uma da outra.

const PERFIS = [
  'OPERADOR_BALANCA',
  'ANALISTA_QUALIDADE',
  'COMPRADOR_AVALIADOR',
  'ADMINISTRATIVO',
  'ADMINISTRADOR',
]

/**
 * Perfis que passam em qualquer operação de NEGÓCIO sem serem listados.
 *
 * O ADMINISTRATIVO já era assim desde o começo, e continua idêntico — nenhuma
 * permissão existente mudou com a chegada do administrador. O ADMINISTRADOR
 * entra na mesma condição para poder conferir o sistema inteiro; o que só ele
 * faz é a administração de contas, que passa por apenas() e não por aqui.
 */
const IRRESTRITOS = ['ADMINISTRATIVO', 'ADMINISTRADOR']

/**
 * A pergunta, sem o HTTP em volta: este perfil passa numa operação de negócio?
 *
 * Existe porque em alguns lugares a resposta não é "deixa passar ou recusa",
 * e sim "entrega ou omite" — a ficha do produtor traz as ordens de pagamento
 * dele, e quem não pode ver dinheiro deve receber a ficha SEM as ordens, e não
 * um 403 na tela inteira. Omitir no servidor, e não na tela, é o que mantém a
 * decisão num lugar só: o front apenas desenha o que recebeu.
 */
function podeNegocio(perfil, ...perfisAutorizados) {
  return new Set([...perfisAutorizados, ...IRRESTRITOS]).has(perfil)
}

/** A decisão, num lugar só. As duas portas abaixo apenas montam a lista. */
function conferir(autorizados) {
  return function (req, res, next) {
    // Se este middleware rodar sem o autenticar antes, req.usuario não existe.
    if (!req.usuario) {
      return res.status(401).json({ erro: 'Não autenticado' })
    }

    if (!autorizados.has(req.usuario.perfil)) {
      return res.status(403).json({
        erro: 'Sem permissão',
        detalhe: `O perfil ${req.usuario.perfil} não pode executar esta operação.`,
        perfisPermitidos: [...autorizados],
      })
    }

    return next()
  }
}

/**
 * Operação de negócio.
 *
 * Uso na rota:
 *     router.post('/', autenticar, permitir('OPERADOR_BALANCA'), controlador)
 */
function permitir(...perfisAutorizados) {
  return conferir(new Set([...perfisAutorizados, ...IRRESTRITOS]))
}

/**
 * Operação restrita, sem perfil irrestrito nenhum.
 *
 * Uso na rota:
 *     router.get('/', autenticar, apenas('ADMINISTRADOR'), controlador)
 */
function apenas(...perfisAutorizados) {
  return conferir(new Set(perfisAutorizados))
}

module.exports = { permitir, apenas, podeNegocio, PERFIS, IRRESTRITOS }
