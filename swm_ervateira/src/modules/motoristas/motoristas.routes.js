// ---------------------------------------------------------------------------
// MÓDULO · motoristas e veículos
// ---------------------------------------------------------------------------
// As duas tabelas existiam no banco desde a primeira migração e nunca tiveram
// porta de entrada — o operador via a coluna "Motorista" na tabela de cargas
// sempre com um travessão e não tinha onde cadastrar ninguém.
//
// POR QUE OS VEÍCULOS FICAM DENTRO DESTE MÓDULO, e não num seu:
// no pátio ninguém procura "o veículo": procura o motorista, e o veículo vem
// junto. Um módulo separado obrigaria duas telas e dois cadastros para
// registrar uma coisa só, que é "o Valdir chegou com o caminhão dele".
//
// A TARA GUARDADA NO VEÍCULO é o detalhe que mais economiza tempo. Sem ela, a
// balança teria de pesar o caminhão vazio a cada entrega — o que significa o
// caminhão subir na balança duas vezes, descarregar no meio, e a fila parar.
// Com ela, o operador escolhe a placa e o campo já vem preenchido, podendo
// sobrescrever quando o veículo estiver diferente do de costume.

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
    select: { id: true, placa: true, tipo: true, taraKg: true, principal: true },
  },
}

/** Placas do Brasil: ABC1234 (antiga) e ABC1D23 (Mercosul). */
const PLACA = /^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/

function normalizarPlaca(valor) {
  return String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// GET /api/motoristas?busca=
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

// POST /api/motoristas
// Quem cadastra é quem está na balança: o motorista aparece ali, na hora, e
// mandar a pessoa procurar o administrativo pararia a fila.
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

  // O veículo é opcional no cadastro, mas quando vem sobe junto, na mesma
  // transação: um motorista gravado e o caminhão dele perdido no meio do
  // caminho é pior que nenhum dos dois.
  if (veiculo?.placa) {
    const placa = normalizarPlaca(veiculo.placa)
    if (!PLACA.test(placa)) {
      throw new ErroDeNegocio('Placa inválida. Use o formato ABC1234 ou ABC1D23', 400)
    }
    dados.veiculos = {
      create: [{
        placa,
        tipo: veiculo.tipo || null,
        taraKg: veiculo.taraKg ? Number(veiculo.taraKg) : null,
        principal: true,
      }],
    }
  }

  const criado = await prisma.motorista.create({ data: dados, include: COM_VEICULOS })
  res.status(201).json(criado)
})

// POST /api/motoristas/:id/veiculos — o mesmo motorista pode trocar de carreta
router.post('/:id/veiculos', permitir('OPERADOR_BALANCA'), async (req, res) => {
  const { placa, tipo, taraKg, principal } = req.body

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
      taraKg: taraKg ? Number(taraKg) : null,
      principal: Boolean(principal),
    },
  })
  res.status(201).json(criado)
})

// PUT /api/motoristas/:id
router.put('/:id', permitir('OPERADOR_BALANCA'), async (req, res) => {
  const { nome, telefone, cnhCategoria, cnhValidade, ativo } = req.body

  const dados = {}
  if (nome !== undefined) dados.nome = String(nome).trim()
  if (telefone !== undefined) dados.telefone = telefone || null
  if (cnhCategoria !== undefined) dados.cnhCategoria = cnhCategoria || null
  if (cnhValidade !== undefined) dados.cnhValidade = cnhValidade ? new Date(cnhValidade) : null
  // O motorista não é APAGADO, é inativado: as cargas dele continuam
  // existindo, e uma carga sem motorista quebraria a rastreabilidade que é o
  // tema do trabalho.
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
