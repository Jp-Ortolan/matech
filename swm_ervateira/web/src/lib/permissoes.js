export const PERFIS = [
  { id: 'OPERADOR_BALANCA', rotulo: 'Operador de balança', curto: 'Balança' },
  { id: 'ANALISTA_QUALIDADE', rotulo: 'Analista de qualidade', curto: 'Qualidade' },
  { id: 'COMPRADOR_AVALIADOR', rotulo: 'Comprador / avaliador', curto: 'Campo' },
  { id: 'ADMINISTRATIVO', rotulo: 'Administrativo', curto: 'Administrativo' },
  { id: 'ADMINISTRADOR', rotulo: 'Administrador', curto: 'Administrador' },
]

export const NOME_PERFIL = Object.fromEntries(PERFIS.map((p) => [p.id, p.rotulo]))

export const PERFIL_ADMINISTRADOR = 'ADMINISTRADOR'
