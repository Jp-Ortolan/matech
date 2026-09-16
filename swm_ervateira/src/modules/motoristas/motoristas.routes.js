const { Router } = require('express')
const { prisma } = require('../../lib/prisma')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir } = require('../../middlewares/autorizacao')
const { ErroDeNegocio } = require('../../middlewares/erros')
const { apenasDigitos, cpfValido } = require('../../lib/documentos')

const router = Router()
router.use(autenticar)

const COM_VEICULOS = {
  veiculos: {
    where: { ativo: true },
    orderBy: [{ principal: 'desc' }, { placa: 'asc' }],
    select: { id: true, placa: true, tipo: true, principal: true },
  },
}

const PLACA = /^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/

function normalizarPlaca(valor) {
  return String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

router.get('/', async (req, res) => {
  const { busca } = req.query

  const where = busca
    ? {
        ativo: true,
        OR: [
          { nome: { contains: busca, mode: 'insensitive' } },
          { cpf: { contains: apenasDigitos(busca) || busca } },
          { veiculos: { some: { placa: { contains: normalizarPlaca(busca) } } } },
        ],
      }
    : { ativo: true }

  const motoristas = await prisma.motorista.findMany({
    where,
    orderBy: { nome: 'asc' },
    include: { ...COM_VEICULOS, _count: { select: { cargas: true } } },
  })

  res.json({ total: motoristas.length, motoristas })
})

router.post('/', permitir('OPERADOR_BALANCA'), async (req, res) => {
  const { nome, cpf, telefone, cnhCategoria, cnhValidade, veiculo } = req.body

  if (!nome || String(nome).trim().length < 3) {
    throw new ErroDeNegocio('Informe o nome do motorista', 400)
  }
  const documento = apenasDigitos(cpf)
  if (!cpfValido(documento)) {
    throw new ErroDeNegocio('CPF do motorista inválido: confira os números', 400)
  }

  const dados = {
    nome: String(nome).trim(),
    cpf: documento,
    telefone: telefone || null,
    cnhCategoria: cnhCategoria || null,
    cnhValidade: cnhValidade ? new Date(cnhValidade) : null,
  }

  if (veiculo?.placa) {
    const placa = normalizarPlaca(veiculo.placa)
    if (!PLACA.test(placa)) {
      throw new ErroDeNegocio('Placa inválida. Use o formato ABC1234 ou ABC1D23', 400)
    }
    dados.veiculos = {
      create: [{
        placa,
        tipo: veiculo.tipo || null,
        principal: true,
      }],
    }
  }

  const criado = await prisma.motorista.create({ data: dados, include: COM_VEICULOS })
  res.status(201).json(criado)
})

router.post('/:id/veiculos', permitir('OPERADOR_BALANCA'), async (req, res) => {
  const { placa, tipo, principal } = req.body

  const normalizada = normalizarPlaca(placa)
  if (!PLACA.test(normalizada)) {
    throw new ErroDeNegocio('Placa inválida. Use o formato ABC1234 ou ABC1D23', 400)
  }

  const motorista = await prisma.motorista.findUnique({ where: { id: req.params.id } })
  if (!motorista) throw new ErroDeNegocio('Motorista não encontrado', 404)

  const criado = await prisma.veiculo.create({
    data: {
      motoristaId: motorista.id,
      placa: normalizada,
      tipo: tipo || null,
      principal: Boolean(principal),
    },
  })
  res.status(201).json(criado)
})

router.put('/:id', permitir('OPERADOR_BALANCA'), async (req, res) => {
  const { nome, telefone, cnhCategoria, cnhValidade, ativo } = req.body

  const dados = {}
  if (nome !== undefined) dados.nome = String(nome).trim()
  if (telefone !== undefined) dados.telefone = telefone || null
  if (cnhCategoria !== undefined) dados.cnhCategoria = cnhCategoria || null
  if (cnhValidade !== undefined) dados.cnhValidade = cnhValidade ? new Date(cnhValidade) : null
  if (ativo !== undefined) dados.ativo = Boolean(ativo)

  if (Object.keys(dados).length === 0) throw new ErroDeNegocio('Nada a atualizar', 400)

  const atualizado = await prisma.motorista.update({
    where: { id: req.params.id },
    data: dados,
    include: COM_VEICULOS,
  })
  res.json(atualizado)
})

module.exports = router
