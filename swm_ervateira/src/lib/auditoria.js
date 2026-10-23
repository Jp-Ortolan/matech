const { prisma } = require('./prisma')

const ACOES = {
  // contas
  USUARIO_CRIADO: 'USUARIO_CRIADO',
  USUARIO_ALTERADO: 'USUARIO_ALTERADO',
  SENHA_REDEFINIDA: 'SENHA_REDEFINIDA',
  SENHA_TROCADA: 'SENHA_TROCADA',
  // cadastros
  PRODUTOR_CADASTRADO: 'PRODUTOR_CADASTRADO',
  PRODUTOR_ALTERADO: 'PRODUTOR_ALTERADO',
  MOTORISTA_CADASTRADO: 'MOTORISTA_CADASTRADO',
  MOTORISTA_ALTERADO: 'MOTORISTA_ALTERADO',
  VEICULO_CADASTRADO: 'VEICULO_CADASTRADO',
  // balança
  ENTRADA_REGISTRADA: 'ENTRADA_REGISTRADA',
  PESAGEM_FECHADA: 'PESAGEM_FECHADA',
  // qualidade e pagamento
  ANALISE_LANCADA: 'ANALISE_LANCADA',
  ORDEM_EMITIDA: 'ORDEM_EMITIDA',
  ORDEM_PAGA: 'ORDEM_PAGA',
  // app de campo
  SINCRONIZACAO_RECEBIDA: 'SINCRONIZACAO_RECEBIDA',
}

// Copia só os campos pedidos e preenchidos (para gravar no registro).
function apenasCampos(obj, campos) {
  const saida = {}
  for (const campo of campos) {
    if (obj && obj[campo] != null && obj[campo] !== '') saida[campo] = normalizar(obj[campo])
  }
  return saida
}

function diferencas(antes, depois) {
  const mudou = { antes: {}, depois: {} }
  const campos = new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})])

  for (const campo of campos) {
    const a = normalizar(antes?.[campo])
    const d = normalizar(depois?.[campo])
    if (a === d) continue
    mudou.antes[campo] = a
    mudou.depois[campo] = d
  }

  const houve = Object.keys(mudou.depois).length > 0
  return houve ? mudou : null
}

function normalizar(v) {
  if (v === undefined || v === null) return null
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object' && typeof v.toString === 'function') return v.toString()
  return v
}

async function registrar(req, { acao, entidade, entidadeId, alvo, antes, depois }) {
  try {
    await prisma.registroAuditoria.create({
      data: {
        usuarioId: req.usuario.id,
        usuarioNome: req.usuario.nome,
        usuarioPerfil: req.usuario.perfil,
        acao,
        entidade,
        entidadeId: entidadeId ?? null,
        alvo: alvo ?? null,
        antes: antes ?? undefined,
        depois: depois ?? undefined,
      },
    })
  } catch (e) {
    console.error('[auditoria] não foi possível registrar a alteração:', acao, e.message)
  }
}

const descreverUsuario = (u) => (u ? `${u.nome} (${u.usuario})` : null)

module.exports = { registrar, diferencas, apenasCampos, descreverUsuario, ACOES }
