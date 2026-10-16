const servico = require('./cargas.service')
const { podeNegocio } = require('../../middlewares/autorizacao')
const { ocultarDaCarga } = require('../../lib/sigilo')
const { paginacao } = require('../../lib/validacao')

function comoEsteUsuarioPodeVer(req) {
  return { veDinheiro: podeNegocio(req.usuario.perfil, 'ADMINISTRATIVO') }
}

const POR_PAGINA_PADRAO = 20
const POR_PAGINA_MAXIMO = 500

async function listar(req, res) {
  const { produtorId, de, ate, situacao, busca } = req.query
  const { pagina, porPagina } = paginacao(req.query, { padrao: POR_PAGINA_PADRAO, maximo: POR_PAGINA_MAXIMO })

  const resultado = await servico.listar({ produtorId, de, ate, situacao, busca, pagina, porPagina })

  const visao = comoEsteUsuarioPodeVer(req)
  res.json({ ...resultado, cargas: resultado.cargas.map((c) => ocultarDaCarga(c, visao)) })
}

async function buscar(req, res) {
  const carga = await servico.buscarPorId(req.params.id)
  res.json(ocultarDaCarga(carga, comoEsteUsuarioPodeVer(req)))
}

async function registrar(req, res) {
  const carga = await servico.registrarEntrada(req.body, req.usuario.id)
  res.status(201).json(ocultarDaCarga(carga, comoEsteUsuarioPodeVer(req)))   // 201 = criado
}

async function calculo(req, res) {
  const carga = await servico.buscarPorId(req.params.id)
  const resultado = servico.calcularPagamento({
    pesoLiquidoKg: carga.pesoLiquidoKg,
    precoBaseKg: carga.precoBaseKg,
  })
  res.json({
    ticket: carga.numeroTicket,
    produtor: carga.produtor.nome,
    ...resultado,
  })
}

async function fecharTara(req, res) {
  const carga = await servico.fecharPesagem(req.params.id, req.body, req.usuario.id)
  res.json(ocultarDaCarga(carga, comoEsteUsuarioPodeVer(req)))
}

module.exports = { listar, buscar, registrar, fecharTara, calculo }
