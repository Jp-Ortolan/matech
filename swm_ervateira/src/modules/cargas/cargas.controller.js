// ---------------------------------------------------------------------------
// CONTROLADOR · cargas
// ---------------------------------------------------------------------------
// Traduz HTTP para chamadas de serviço e devolve a resposta.
// Repare que não há nenhuma conta aqui: toda regra está no cargas.service.js.

const servico = require('./cargas.service')
const { podeNegocio } = require('../../middlewares/autorizacao')
const { ocultarDaCarga } = require('../../lib/sigilo')

// GET /api/cargas é aberto a todo perfil — é a base de Pesagem, Matéria-prima,
// Relatórios e do painel. O que NÃO é aberto é o que vai dentro dela: preço,
// valor e o CPF do produtor saem da resposta para quem não tem o perfil.
//
// Filtrar aqui, e não na tela, é o que fecha a segregação de função: escondida
// no front, a coluna some da tabela e o número continua no corpo da resposta.
function comoEsteUsuarioPodeVer(req) {
  return { veDinheiro: podeNegocio(req.usuario.perfil, 'ADMINISTRATIVO') }
}

// Teto de registros por página. Existe para que uma requisição com
// ?porPagina=999999 não obrigue o banco a montar a tabela inteira em memória.
const POR_PAGINA_PADRAO = 20
const POR_PAGINA_MAXIMO = 500

// GET /api/cargas?produtorId=&de=&ate=&situacao=&busca=&pagina=&porPagina=
async function listar(req, res) {
  const { produtorId, de, ate, situacao, busca, pagina, porPagina } = req.query

  // porPagina vem da tela: o histórico usa 20, mas o painel e os relatórios
  // precisam do período inteiro para que os totais não fiquem truncados.
  const tamanho = Math.min(Number(porPagina) || POR_PAGINA_PADRAO, POR_PAGINA_MAXIMO)

  const resultado = await servico.listar({
    produtorId, de, ate, situacao, busca,
    pagina: Number(pagina) || 1,
    porPagina: tamanho,
  })

  const visao = comoEsteUsuarioPodeVer(req)
  res.json({ ...resultado, cargas: resultado.cargas.map((c) => ocultarDaCarga(c, visao)) })
}

// GET /api/cargas/:id
async function buscar(req, res) {
  const carga = await servico.buscarPorId(req.params.id)
  res.json(ocultarDaCarga(carga, comoEsteUsuarioPodeVer(req)))
}

// POST /api/cargas
// O id do usuário NÃO vem do corpo da requisição: vem do token.
// Se viesse do corpo, qualquer um poderia registrar uma carga no nome de outro.
async function registrar(req, res) {
  const carga = await servico.registrarPesagem(req.body, req.usuario.id)
  // Passa pelo mesmo filtro da consulta: é desta resposta que sai o ticket
  // impresso, e o operador de balança não é quem vê preço.
  res.status(201).json(ocultarDaCarga(carga, comoEsteUsuarioPodeVer(req)))   // 201 = criado
}

// GET /api/cargas/:id/calculo
// Mostra a memória de cálculo do pagamento — é o que a tela de análise exibe.
async function calculo(req, res) {
  const carga = await servico.buscarPorId(req.params.id)
  const resultado = servico.calcularPagamento({
    pesoLiquidoKg: carga.pesoLiquidoKg,
    precoBaseKg: carga.precoBaseKg,
    palitoPercentual: carga.analise?.palitoPercentual ?? null,
    limitePalito: carga.analise?.limitePalito ?? 30,
  })
  res.json({
    ticket: carga.numeroTicket,
    produtor: carga.produtor.nome,
    ...resultado,
  })
}

module.exports = { listar, buscar, registrar, calculo }
