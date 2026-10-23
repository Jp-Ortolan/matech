const servico = require('./cargas.service')
const { podeNegocio } = require('../../middlewares/autorizacao')
const { ocultarDaCarga } = require('../../lib/sigilo')
const { paginacao } = require('../../lib/validacao')
const { registrar: registrarAlteracao, apenasCampos, ACOES } = require('../../lib/auditoria')

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

// descrição da carga no registro: "PES-2026-01191 · Marlene Kaviski"
const descreverCarga = (c) => [c.numeroTicket, c.produtor?.nome].filter(Boolean).join(' · ')

async function registrar(req, res) {
  const carga = await servico.registrarEntrada(req.body, req.usuario.id)

  await registrarAlteracao(req, {
    acao: ACOES.ENTRADA_REGISTRADA,
    entidade: 'Carga',
    entidadeId: carga.id,
    alvo: descreverCarga(carga),
    depois: {
      ...apenasCampos(carga, ['tipoMateriaPrima', 'pesoBrutoKg']),
      ...(carga.veiculo?.placa ? { placa: carga.veiculo.placa } : {}),
    },
  })

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

  await registrarAlteracao(req, {
    acao: ACOES.PESAGEM_FECHADA,
    entidade: 'Carga',
    entidadeId: carga.id,
    alvo: descreverCarga(carga),
    depois: apenasCampos(carga, ['pesoBrutoKg', 'taraKg', 'pesoLiquidoKg']),
  })

  res.json(ocultarDaCarga(carga, comoEsteUsuarioPodeVer(req)))
}

module.exports = { listar, buscar, registrar, fecharTara, calculo }
