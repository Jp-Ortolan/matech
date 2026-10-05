const { Router } = require('express')
const express = require('express')
const path = require('node:path')

const servico = require('./sincronizacao.service')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir } = require('../../middlewares/autorizacao')
const { tipoDaImagem, EXTENSOES } = require('../../lib/imagens')

const router = Router()
router.use(autenticar)

router.post('/', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  const resultado = await servico.receberLote(req.body, req.usuario.id)
  res.json(resultado)
})

router.get('/resumo', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  res.json(await servico.resumo({ dispositivoId: req.query.dispositivoId }))
})

router.get('/registros', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  res.json(await servico.listarRegistros(req.query))
})

router.post(
  '/fotos',
  permitir('COMPRADOR_AVALIADOR'),
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' }),
  async (req, res) => {
    const clientId = req.get('x-client-id')
    const avaliacaoClientId = req.get('x-avaliacao-client-id')

    if (!clientId || !avaliacaoClientId) {
      return res.status(400).json({
        erro: 'Cabeçalhos obrigatórios ausentes',
        detalhe: 'Envie x-client-id (da foto) e x-avaliacao-client-id (da avaliação).',
      })
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({
        erro: 'Corpo vazio',
        detalhe: 'Envie a imagem como corpo bruto, com Content-Type image/jpeg, image/png ou image/webp.',
      })
    }

    const tipoReal = tipoDaImagem(req.body)
    if (!tipoReal) {
      return res.status(415).json({
        erro: 'O arquivo enviado não é uma imagem',
        detalhe: 'São aceitos JPEG, PNG e WebP. O conteúdo do arquivo é conferido, não apenas o Content-Type.',
      })
    }

    const extensao = EXTENSOES[tipoReal]
    const seguro = String(clientId).replace(/[^a-zA-Z0-9-]/g, '')
    if (seguro.length < 8) return res.status(400).json({ erro: 'clientId inválido' })

    // O caminho continua o mesmo de antes; a imagem é que passa a ir para o banco.
    const relativo = path.posix.join('fotos', `${seguro}.${extensao}`)

    const resultado = await servico.registrarFoto(
      {
        clientId: seguro,
        avaliacaoClientId,
        caminho: relativo,
        dados: req.body,
        tipoMime: tipoReal,
        tamanhoBytes: req.body.length,
        largura: req.get('x-largura'),
        altura: req.get('x-altura'),
      },
      req.get('x-dispositivo-id') || 'desconhecido',
      req.usuario.id
    )

    if (resultado.situacao === 'DEPENDENCIA_PENDENTE') return res.status(409).json(resultado)

    res.status(201).json(resultado)
  }
)

module.exports = router
