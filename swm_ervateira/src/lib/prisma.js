// ---------------------------------------------------------------------------
// BANCO DE DADOS · conexão única
// ---------------------------------------------------------------------------
// Cria UM PrismaClient para a aplicação inteira e exporta.
//
// Por que um só: cada PrismaClient abre um conjunto de conexões com o
// PostgreSQL. Se cada arquivo criasse o seu, o banco ficaria cheio de conexões
// abertas à toa e acabaria recusando novas.
//
// Detalhe do Prisma 7: a linha de conexão não fica mais no schema.prisma.
// Ela é entregue ao cliente por um "adaptador", que é o driver real do
// PostgreSQL (o pacote pg).

const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { DATABASE_URL } = require('../config/env')

const adapter = new PrismaPg({ connectionString: DATABASE_URL })
const prisma = new PrismaClient({ adapter })

module.exports = { prisma }
