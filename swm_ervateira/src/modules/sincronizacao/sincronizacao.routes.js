// ---------------------------------------------------------------------------
// ROTAS · sincronização
// ---------------------------------------------------------------------------
// A porta de entrada do que o aplicativo coletou em campo. Só o avaliador
// (e o administrativo) sincronizam: é o perfil que usa o celular no erval.
//
// Repare que NÃO há aqui uma rota de "criar avaliação" avulsa. É proposital:
// se existissem duas portas de entrada — uma para o app e outra genérica —
// a segunda entraria sem clientId, sem alteradoEmOrigem e sem registro de
// auditoria, e a garantia de não duplicar valeria só metade do tempo.

const { Router } = require('express')
const express = require('express')
const fs = require('node:fs/promises')
const path = require('node:path')

const servico = require('./sincronizacao.service')
const { PASTA_UPLOADS } = require('../../config/env')
const { autenticar } = require('../../middlewares/autenticacao')
const { permitir } = require('../../middlewares/autorizacao')
const { tipoDaImagem, EXTENSOES } = require('../../lib/imagens')

const router = Router()
router.use(autenticar)

// POST /api/sincronizacao — recebe o lote de operações do aparelho
router.post('/', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  // O usuário vem do token: a avaliação fica registrada no nome de quem
  // estava com o celular, e não de quem o corpo da requisição disser.
  const resultado = await servico.receberLote(req.body, req.usuario.id)
  res.json(resultado)
})

// GET /api/sincronizacao/resumo?dispositivoId= — a taxa do Quadro 7
// Restrita ao mesmo perfil que sincroniza: é o diagnóstico do aparelho dele.
router.get('/resumo', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  res.json(await servico.resumo({ dispositivoId: req.query.dispositivoId }))
})

// GET /api/sincronizacao/registros?dispositivoId=&situacao=&limite=
router.get('/registros', permitir('COMPRADOR_AVALIADOR'), async (req, res) => {
  res.json(await servico.listarRegistros(req.query))
})

// ---------------------------------------------------------------------------
// POST /api/sincronizacao/fotos — uma foto por requisição, binário puro
// ---------------------------------------------------------------------------
// express.raw() é do próprio Express: não precisa de multer nem de nenhuma
// biblioteca de upload. O corpo chega como Buffer e o Node grava o arquivo.
//
// Os metadados vêm em cabeçalhos, e não no corpo, porque o corpo inteiro é a
// imagem. Um multipart resolveria o mesmo problema custando uma dependência.
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

    // O TIPO VEM DOS BYTES. Antes vinha do Content-Type, e o Content-Type é
    // escolhido por quem envia: bastava anunciar image/jpeg para gravar
    // qualquer coisa dentro de uploads/fotos/, que é uma pasta servida
    // estaticamente na mesma origem da API.
    //
    // O express.raw() acima também filtra por Content-Type, e continua útil —
    // ele evita ler 8 MB de um corpo que nem se diz imagem. Mas ele confia no
    // mesmo cabeçalho, então não é ele quem garante nada. A garantia é esta.
    const tipoReal = tipoDaImagem(req.body)
    if (!tipoReal) {
      return res.status(415).json({
        erro: 'O arquivo enviado não é uma imagem',
        detalhe: 'São aceitos JPEG, PNG e WebP. O conteúdo do arquivo é conferido, não apenas o Content-Type.',
      })
    }

    // O clientId é UUID gerado no aparelho e é único — serve de nome de
    // arquivo sem risco de um envio sobrescrever outro. A extensão sai do
    // tipo real, para que ninguém escolha o sufixo do arquivo gravado no
    // servidor a partir de um cabeçalho.
    const extensao = EXTENSOES[tipoReal]
    const seguro = String(clientId).replace(/[^a-zA-Z0-9-]/g, '')
    if (seguro.length < 8) return res.status(400).json({ erro: 'clientId inválido' })

    const relativo = path.posix.join('fotos', `${seguro}.${extensao}`)
    const destino = path.join(PASTA_UPLOADS, 'fotos', `${seguro}.${extensao}`)

    await fs.mkdir(path.dirname(destino), { recursive: true })
    await fs.writeFile(destino, req.body)

    const resultado = await servico.registrarFoto(
      {
        clientId: seguro,
        avaliacaoClientId,
        caminho: relativo,
        tamanhoBytes: req.body.length,
        largura: req.get('x-largura'),
        altura: req.get('x-altura'),
      },
      req.get('x-dispositivo-id') || 'desconhecido',
      req.usuario.id
    )

    // A dependência ainda não chegou: o arquivo já está em disco, mas a linha
    // no banco não. O aparelho reenvia depois e o upload vira DUPLICADO —
    // sem custo, porque o nome do arquivo é o mesmo.
    if (resultado.situacao === 'DEPENDENCIA_PENDENTE') return res.status(409).json(resultado)

    res.status(201).json(resultado)
  }
)

module.exports = router
