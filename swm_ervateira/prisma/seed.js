// Seed — popula o banco com dados de exemplo.
// Serve para conferir se os relacionamentos funcionam e para ter o que mostrar na API.
// Rode com: node prisma/seed.js

const { prisma } = require('../src/lib/prisma')
const { gerarHash } = require('../src/modules/auth/auth.service')

async function main() {
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
  const senhaPadrao = await gerarHash('matech123')
  const [operador, analista, avaliador, admin] = await Promise.all([
    prisma.usuario.create({ data: { nome: 'Rogério Anselmo', usuario: 'rogerio.anselmo', senhaHash: senhaPadrao, perfil: 'OPERADOR_BALANCA' } }),
    prisma.usuario.create({ data: { nome: 'Cristiane Modesto', usuario: 'cristiane.modesto', senhaHash: senhaPadrao, perfil: 'ANALISTA_QUALIDADE' } }),
    prisma.usuario.create({ data: { nome: 'Marcos Ferrari', usuario: 'marcos.ferrari', senhaHash: senhaPadrao, perfil: 'COMPRADOR_AVALIADOR' } }),
    prisma.usuario.create({ data: { nome: 'Solange Petry', usuario: 'solange.petry', senhaHash: senhaPadrao, perfil: 'ADMINISTRATIVO' } }),
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

  // A regra: palito 34%, limite 30% → excedente de 4 p.p. → desconto de 4% no preço.
  const precoAjustado = 4.85 * 0.96 // 4.6560
  await prisma.analiseQualidade.create({
    data: {
      cargaId: carga1.id,
      usuarioId: analista.id,
      palitoPercentual: 34,
      umidadePercentual: 41.2,
      folhaPercentual: 66,
      limitePalito: 30,
      descontoPercentual: 4,
      precoAjustadoKg: precoAjustado,
      valorTotal: 7240 * precoAjustado,
      observacoes: 'Amostra dentro do padrão de cor.',
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

  // Carga 3 — lenha
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

main()
  .catch((e) => {
    console.error('Falhou:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
