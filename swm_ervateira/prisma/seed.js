// Seed — popula o banco com dados de exemplo.
// Serve para conferir se os relacionamentos funcionam e para ter o que mostrar na API.
// Rode com: node prisma/seed.js

const { prisma } = require('../src/lib/prisma')
const { PerfilUsuario } = require('@prisma/client')
const { gerarHash } = require('../src/modules/auth/auth.service')

/** Os perfis que este seed vai gravar. */
const PERFIS_USADOS = [
  'OPERADOR_BALANCA',
  'ANALISTA_QUALIDADE',
  'COMPRADOR_AVALIADOR',
  'ADMINISTRATIVO',
  'ADMINISTRADOR',
]

/**
 * Confere que o Prisma Client conhece os perfis ANTES de apagar qualquer coisa.
 *
 * POR QUE ISTO EXISTE, e é a lição mais cara desta etapa: o seed começa
 * apagando todas as tabelas e só depois recria. Quando o enum ganhou o valor
 * ADMINISTRADOR, a migração foi aplicada no PostgreSQL mas o Client continuou
 * com a versão antiga em node_modules — e é o Client, não o banco, que valida
 * o argumento antes de a query sair. Resultado: o seed apagou o banco inteiro
 * e falhou na linha seguinte, deixando o sistema sem usuário nenhum e o login
 * recusando todo mundo com 401.
 *
 * O erro do Prisma nesse caso é um PrismaClientValidationError de trinta
 * linhas que não menciona `prisma generate` em lugar nenhum. Falhar aqui, com
 * o banco intacto e a instrução escrita, custa dois segundos.
 *
 * `migrate dev` NÃO resolve sozinho: ele só regenera o Client quando aplica
 * uma migração. Com a migração já aplicada, ele responde "Already in sync" e
 * não faz nada — que foi exatamente o que aconteceu.
 */
function conferirClientAtualizado() {
  const conhecidos = Object.keys(PerfilUsuario ?? {})
  const faltando = PERFIS_USADOS.filter((p) => !conhecidos.includes(p))
  if (faltando.length === 0) return

  console.error('\nO Prisma Client está desatualizado — NADA foi apagado.\n')
  console.error('  Perfis que o seed precisa:', PERFIS_USADOS.join(', '))
  console.error('  Perfis que o Client conhece:', conhecidos.join(', ') || '(nenhum)')
  console.error('  Faltando:', faltando.join(', '))
  console.error('\nRode, nesta ordem:\n')
  console.error('  npx prisma generate')
  console.error('  npm run seed\n')
  process.exit(1)
}

async function main() {
  conferirClientAtualizado()

  console.log('Limpando as tabelas...')
  // A ordem importa: apaga primeiro quem depende dos outros.
  await prisma.itemOrdemPagamento.deleteMany()
  await prisma.ordemPagamento.deleteMany()
  await prisma.analiseQualidade.deleteMany()
  await prisma.carga.deleteMany()
  await prisma.fotoErval.deleteMany()
  await prisma.avaliacao.deleteMany()
  await prisma.erval.deleteMany()
  await prisma.veiculo.deleteMany()
  await prisma.motorista.deleteMany()
  await prisma.produtor.deleteMany()
  await prisma.registroSincronizacao.deleteMany()
  await prisma.usuario.deleteMany()

  console.log('Criando usuários...')
  // Todos entram com a senha "matech123" — só para desenvolvimento.
  // O que vai para o banco é o HASH dela, nunca a senha em si: mesmo com
  // acesso ao PostgreSQL, ninguém consegue ler a senha de volta.
  // Na versão publicada, SENHA_SEED troca a senha de todos os usuários de teste.
  const senhaPadrao = await gerarHash(process.env.SENHA_SEED || 'matech123')
  const [operador, analista, avaliador, admin] = await Promise.all([
    prisma.usuario.create({ data: { nome: 'Rogério Anselmo', usuario: 'rogerio.anselmo', senhaHash: senhaPadrao, perfil: 'OPERADOR_BALANCA' } }),
    prisma.usuario.create({ data: { nome: 'Cristiane Modesto', usuario: 'cristiane.modesto', senhaHash: senhaPadrao, perfil: 'ANALISTA_QUALIDADE' } }),
    prisma.usuario.create({ data: { nome: 'Marcos Ferrari', usuario: 'marcos.ferrari', senhaHash: senhaPadrao, perfil: 'COMPRADOR_AVALIADOR' } }),
    prisma.usuario.create({ data: { nome: 'Solange Petry', usuario: 'solange.petry', senhaHash: senhaPadrao, perfil: 'ADMINISTRATIVO' } }),
    // Administrador do sistema: é quem abre e fecha as contas dos outros.
    // Não participa da operação — não pesa, não analisa, não paga.
    prisma.usuario.create({ data: { nome: 'Administrador MATECH', usuario: 'admin.matech', senhaHash: senhaPadrao, perfil: 'ADMINISTRADOR' } }),
  ])

  console.log('Criando produtores e ervais...')
  const jose = await prisma.produtor.create({
    data: {
      nome: 'José Fontana',
      cpfCnpj: '012.345.678-90',
      telefone: '(42) 99912-4477',
      municipio: 'Guarapuava',
      uf: 'PR',
      formaPagamento: 'PIX',
      tipoChavePix: 'CPF',
      chavePix: '012.345.678-90',
      titularConta: 'José Fontana',
      ervais: {
        create: [
          { identificacao: 'Erval 03 · Talhão Norte', tipoErva: 'NATIVA', quantidadeEstimadaKg: 18000, idadeAnos: 9, latitude: -25.3891, longitude: -51.4620 },
          { identificacao: 'Erval 05 · Beira do rio', tipoErva: 'PLANTADA', quantidadeEstimadaKg: 9000, idadeAnos: 5, latitude: -25.4012, longitude: -51.4488 },
        ],
      },
    },
    include: { ervais: true },
  })

  const marlene = await prisma.produtor.create({
    data: {
      nome: 'Marlene Kaviski',
      cpfCnpj: '987.123.456-01',
      telefone: '(42) 99845-7712',
      municipio: 'Turvo',
      uf: 'PR',
      formaPagamento: 'PIX',
      tipoChavePix: 'TELEFONE',
      chavePix: '(42) 99845-7712',
      titularConta: 'Marlene Kaviski',
      ervais: { create: [{ identificacao: 'Erval 11 · Sede', tipoErva: 'PLANTADA', quantidadeEstimadaKg: 12000, idadeAnos: 6 }] },
    },
    include: { ervais: true },
  })

  // Produtor cadastrado pelo celular, em campo, sem conexão.
  const otavio = await prisma.produtor.create({
    data: {
      nome: 'Otávio Bonato',
      cpfCnpj: '045.987.221-13',
      telefone: '(42) 99730-1188',
      endereco: 'Linha Rio das Pedras, s/n',
      municipio: 'Turvo',
      uf: 'PR',
      formaPagamento: 'PIX',
      tipoChavePix: 'CPF',
      chavePix: '045.987.221-13',
      titularConta: 'Otávio Bonato',
      clientId: 'app-produtor-0001',
      criadoOffline: true,
      sincronizadoEm: new Date(),
    },
  })

  console.log('Criando motorista e veículos...')
  const valdir = await prisma.motorista.create({
    data: {
      nome: 'Valdir Prestes',
      cpf: '987.654.321-00',
      telefone: '(42) 99845-2210',
      cnhCategoria: 'C',
      veiculos: {
        create: [
          { placa: 'AXK-7H29', tipo: 'Caminhão truck', taraKg: 1180, principal: true },
          { placa: 'BQP-2D14', tipo: 'Caminhão toco', taraKg: 980 },
        ],
      },
    },
    include: { veiculos: true },
  })

  console.log('Criando avaliação em campo (registrada offline)...')
  const avaliacao = await prisma.avaliacao.create({
    data: {
      ervalId: jose.ervais[0].id,
      usuarioId: avaliador.id,
      dataAvaliacao: new Date('2026-08-11T09:14:00'),
      tipoErva: 'NATIVA',
      ervaQueimada: 'NAO',
      idadeErvalAnos: 9,
      quantidadeEstimadaKg: 7500,
      classificacao: 'A',
      umidadeEstimada: 42,
      taloAparente: 'Média',
      valorCombinadoKg: 4.85,
      latitude: -25.3891,
      longitude: -51.4620,
      observacoes: 'Folha uniforme, sem sinal de queima.',
      clientId: 'app-avaliacao-0001',
      criadoOffline: true,
      alteradoEmOrigem: new Date('2026-08-11T09:14:00'),
      sincronizadoEm: new Date(),
      fotos: {
        create: [
          { caminho: 'fotos/erval03-a.jpg', tamanhoBytes: 2150000, clientId: 'app-foto-0001', sincronizadoEm: new Date() },
          { caminho: 'fotos/erval03-b.jpg', tamanhoBytes: 2080000, clientId: 'app-foto-0002' },
        ],
      },
    },
  })

  console.log('Criando cargas...')
  // Carga 1 — já pesada e analisada
  const carga1 = await prisma.carga.create({
    data: {
      numeroTicket: 'PES-2026-01184',
      produtorId: jose.id,
      ervalId: jose.ervais[0].id,
      motoristaId: valdir.id,
      veiculoId: valdir.veiculos[0].id,
      usuarioId: operador.id,
      avaliacaoId: avaliacao.id,
      dataHora: new Date('2026-08-11T10:03:00'),
      tipoMateriaPrima: 'ERVA_MATE_NATIVA',
      pesoBrutoKg: 8420,
      taraKg: 1180,
      pesoLiquidoKg: 7240,
      pesoEstimadoCampoKg: 7500,
      precoBaseKg: 4.85,
      situacao: 'ANALISADA',
    },
  })

  // Preço acordado na análise da carga 1. A ordem de pagamento mais abaixo
  // usa o mesmo valor, senão ordem e análise discordam.
  const precoAjustado = 4.85

  // A análise mede a amostra e aprova a carga. O valor é peso × preço acordado.
  await prisma.analiseQualidade.create({
    data: {
      cargaId: carga1.id,
      usuarioId: analista.id,
      palitoPercentual: 34,
      umidadePercentual: 41.2,
      folhaPercentual: 66,
      precoAjustadoKg: precoAjustado,
      valorTotal: 7240 * precoAjustado,
      observacoes: 'Amostra dentro do padrão de cor.',
    },
  })

  // Carga · caminhão na balança, ainda sem a segunda pesagem.
  // Existe no seed porque a fila "Aguardando tara" é um estado normal da
  // operação, e uma tela de fila que nasce vazia não se deixa conferir.
  await prisma.carga.create({
    data: {
      numeroTicket: 'PES-2026-01191',
      produtorId: marlene.id,
      usuarioId: operador.id,
      dataHora: new Date('2026-08-29T14:10:00'),
      tipoMateriaPrima: 'ERVA_MATE_NATIVA',
      pesoBrutoKg: 9350,
      taraKg: null,
      pesoLiquidoKg: null,
      situacao: 'AGUARDANDO_TARA',
    },
  })

  // Carga 2 — pesada, ainda sem análise
  await prisma.carga.create({
    data: {
      numeroTicket: 'PES-2026-01185',
      produtorId: marlene.id,
      ervalId: marlene.ervais[0].id,
      motoristaId: valdir.id,
      veiculoId: valdir.veiculos[1].id,
      usuarioId: operador.id,
      dataHora: new Date('2026-08-11T11:20:00'),
      tipoMateriaPrima: 'ERVA_MATE_PLANTADA',
      pesoBrutoKg: 6160,
      taraKg: 980,
      pesoLiquidoKg: 5180,
      precoBaseKg: 4.8,
      situacao: 'AGUARDANDO_ANALISE',
    },
  })

  // Carga 3 — lenha, com a metragem que o pátio confere junto do peso
  await prisma.carga.create({
    data: {
      numeroTicket: 'PES-2026-01186',
      produtorId: otavio.id,
      usuarioId: operador.id,
      dataHora: new Date('2026-08-10T15:40:00'),
      tipoMateriaPrima: 'LENHA',
      pesoBrutoKg: 4080,
      taraKg: 980,
      pesoLiquidoKg: 3100,
      metragemM3: 12.5,
      precoBaseKg: 0.32,
      situacao: 'AGUARDANDO_ANALISE',
    },
  })

  console.log('Criando ordem de pagamento...')
  const valorCarga1 = 7240 * precoAjustado
  await prisma.ordemPagamento.create({
    data: {
      numero: 'OP-2026-0148',
      produtorId: jose.id,
      periodoInicio: new Date('2026-08-01'),
      periodoFim: new Date('2026-08-31'),
      valorTotal: valorCarga1,
      situacao: 'PENDENTE',
      chavePixSnapshot: jose.chavePix,
      itens: {
        create: [{ cargaId: carga1.id, pesoLiquidoKg: 7240, precoKg: precoAjustado, valor: valorCarga1 }],
      },
    },
  })

  console.log('Criando histórico para os relatórios...')
  await criarHistorico({ produtores: [jose, marlene, otavio], motorista: valdir, operador, analista })

  console.log('Registrando eventos de sincronização...')
  await prisma.registroSincronizacao.createMany({
    data: [
      { dispositivoId: 'android-marcos-01', usuarioId: avaliador.id, entidade: 'Avaliacao', operacao: 'CREATE', clientId: 'app-avaliacao-0001', situacao: 'ENVIADO', criadoEmOrigem: new Date('2026-08-11T09:14:00'), confirmadoEm: new Date() },
      { dispositivoId: 'android-marcos-01', usuarioId: avaliador.id, entidade: 'FotoErval', operacao: 'CREATE', clientId: 'app-foto-0001', situacao: 'ENVIADO', criadoEmOrigem: new Date('2026-08-11T09:15:00'), confirmadoEm: new Date() },
      { dispositivoId: 'android-marcos-01', usuarioId: avaliador.id, entidade: 'FotoErval', operacao: 'CREATE', clientId: 'app-foto-0002', situacao: 'PENDENTE', tentativas: 2, criadoEmOrigem: new Date('2026-08-11T09:15:00') },
      { dispositivoId: 'android-marcos-01', usuarioId: avaliador.id, entidade: 'Produtor', operacao: 'CREATE', clientId: 'app-produtor-0001', situacao: 'ENVIADO', criadoEmOrigem: new Date('2026-08-11T08:31:00'), confirmadoEm: new Date() },
    ],
  })

  const totais = {
    usuarios: await prisma.usuario.count(),
    produtores: await prisma.produtor.count(),
    ervais: await prisma.erval.count(),
    motoristas: await prisma.motorista.count(),
    veiculos: await prisma.veiculo.count(),
    avaliacoes: await prisma.avaliacao.count(),
    fotos: await prisma.fotoErval.count(),
    cargas: await prisma.carga.count(),
    analises: await prisma.analiseQualidade.count(),
    ordens: await prisma.ordemPagamento.count(),
    sincronizacoes: await prisma.registroSincronizacao.count(),
  }
  console.log('\nPronto. Registros criados:')
  console.table(totais)
}

// ---------------------------------------------------------------------------
// HISTÓRICO · dois meses e meio de recebimento, para os relatórios terem o
// que mostrar. Os números saem de um sorteio com semente fixa: rodar o seed
// de novo gera exatamente os mesmos dados.
// ---------------------------------------------------------------------------
function sorteio(semente) {
  let x = semente
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296
    return x / 4294967296
  }
}

async function criarHistorico({ produtores, motorista, operador, analista }) {
  const aleatorio = sorteio(2026)
  const entre = (min, max) => min + aleatorio() * (max - min)
  const redondo = (v, casas = 2) => Number(v.toFixed(casas))

  // Mais três produtores, com CPF válido e só os dígitos, como o sistema grava.
  const novos = await Promise.all([
    ['Ademir Woiciechowski', '52601815906', 'Prudentópolis'],
    ['Neusa Baran', '08301661305', 'Pinhão'],
    ['Ervateira Rio Bonito Ltda', '99351819000160', 'Guarapuava'],
  ].map(([nome, cpfCnpj, municipio]) =>
    prisma.produtor.create({
      data: {
        nome, cpfCnpj, municipio, uf: 'PR',
        formaPagamento: 'PIX', tipoChavePix: cpfCnpj.length === 14 ? 'ALEATORIA' : 'CPF',
        chavePix: cpfCnpj.length === 14 ? 'b7e1c0d2-5a4f-4e8a-9c1d-0f3a6b2e7d91' : cpfCnpj,
        titularConta: nome,
      },
    })
  ))
  const todos = [...produtores, ...novos]

  const inicio = new Date('2026-07-20T08:00:00')
  const cargas = []
  for (let i = 0; i < 40; i++) {
    const dia = new Date(inicio.getTime() + i * 1.8 * 24 * 3600 * 1000)
    dia.setHours(7 + Math.floor(entre(0, 9)), Math.floor(entre(0, 60)))
    const produtor = todos[i % todos.length]
    const lenha = i % 7 === 3
    const tipo = lenha ? 'LENHA' : i % 3 === 0 ? 'ERVA_MATE_PLANTADA' : 'ERVA_MATE_NATIVA'
    const tara = redondo(entre(960, 1250), 0)
    const liquido = redondo(lenha ? entre(2800, 4200) : entre(4500, 11000), 0)
    const preco = redondo(lenha ? entre(0.28, 0.36) : entre(4.3, 5.2), 2)
    const reprovada = i === 9 || i === 27
    const recente = dia >= new Date('2026-09-20T00:00:00')

    const carga = await prisma.carga.create({
      data: {
        numeroTicket: `PES-2026-${String(900 + i).padStart(5, '0')}`,
        produtorId: produtor.id,
        motoristaId: motorista.id,
        veiculoId: motorista.veiculos[i % 2].id,
        usuarioId: operador.id,
        dataHora: dia,
        tipoMateriaPrima: tipo,
        pesoBrutoKg: liquido + tara,
        taraKg: tara,
        pesoLiquidoKg: liquido,
        metragemM3: lenha ? redondo(liquido / 250, 1) : null,
        pesoEstimadoCampoKg: lenha ? null : redondo(liquido * entre(0.9, 1.1), 0),
        precoBaseKg: preco,
        situacao: reprovada ? 'REPROVADA' : recente ? 'ANALISADA' : 'PAGA',
      },
    })

    await prisma.analiseQualidade.create({
      data: {
        cargaId: carga.id,
        usuarioId: analista.id,
        dataHora: new Date(dia.getTime() + 2 * 3600 * 1000),
        palitoPercentual: redondo(reprovada ? entre(46, 55) : entre(22, 41), 1),
        umidadePercentual: redondo(entre(38, 46), 1),
        folhaPercentual: redondo(entre(55, 75), 1),
        aprovada: !reprovada,
        motivoReprovacao: reprovada ? 'Palito acima do aceitável para o lote.' : null,
        precoAjustadoKg: reprovada ? null : preco,
        valorTotal: reprovada ? null : redondo(liquido * preco),
      },
    })

    if (!reprovada && !recente) cargas.push({ carga, produtor, dia, liquido, preco })
  }

  // Uma ordem por produtor e por mês, já paga.
  const grupos = new Map()
  for (const c of cargas) {
    const chave = `${c.produtor.id}|${c.dia.getMonth()}`
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave).push(c)
  }
  let numero = 100
  for (const lista of grupos.values()) {
    const { produtor, dia } = lista[0]
    const valor = redondo(lista.reduce((s, c) => s + c.liquido * c.preco, 0))
    const fimDoMes = new Date(dia.getFullYear(), dia.getMonth() + 1, 0)
    await prisma.ordemPagamento.create({
      data: {
        numero: `OP-2026-${String(numero++).padStart(4, '0')}`,
        produtorId: produtor.id,
        periodoInicio: new Date(dia.getFullYear(), dia.getMonth(), 1),
        periodoFim: fimDoMes,
        valorTotal: valor,
        situacao: 'PAGA',
        emitidaEm: fimDoMes,
        pagaEm: new Date(fimDoMes.getTime() + 2 * 24 * 3600 * 1000),
        formaPagamentoSnapshot: 'PIX',
        chavePixSnapshot: produtor.chavePix,
        tipoChavePixSnapshot: produtor.tipoChavePix,
        titularSnapshot: produtor.titularConta,
        itens: {
          create: lista.map((c) => ({
            cargaId: c.carga.id, pesoLiquidoKg: c.liquido, precoKg: c.preco, valor: redondo(c.liquido * c.preco),
          })),
        },
      },
    })
  }
}

main()
  .catch((e) => {
    console.error('Falhou:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
