const TEMPO_LIMITE = 6000

async function buscarComLimite(url) {
  const controle = new AbortController()
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE)
  try {
    const resposta = await fetch(url, { signal: controle.signal })
    if (!resposta.ok) return null
    return await resposta.json()
  } catch {
    return null
  } finally {
    clearTimeout(relogio)
  }
}

export async function consultarCep(cep) {
  const limpo = String(cep ?? '').replace(/\D/g, '')
  if (limpo.length !== 8) return null

  const dados = await buscarComLimite(`https://viacep.com.br/ws/${limpo}/json/`)
  if (!dados || dados.erro) return null

  return {
    cep: limpo,
    endereco: dados.logradouro || '',
    bairro: dados.bairro || '',
    municipio: dados.localidade || '',
    uf: dados.uf || '',
  }
}

export async function consultarCnpj(cnpj) {
  const limpo = String(cnpj ?? '').replace(/\D/g, '')
  if (limpo.length !== 14) return null

  const d = await buscarComLimite(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`)
  if (!d || !d.razao_social) return null

  const numero = d.numero ? `, ${d.numero}` : ''
  const complemento = d.complemento ? ` ${d.complemento}` : ''

  return {
    razaoSocial: d.razao_social,
    nome: d.nome_fantasia || d.razao_social,
    telefone: d.ddd_telefone_1 || '',
    cep: (d.cep || '').replace(/\D/g, ''),
    endereco: d.logradouro ? `${d.logradouro}${numero}${complemento}`.trim() : '',
    bairro: d.bairro || '',
    municipio: d.municipio || '',
    uf: d.uf || '',
    situacao: d.descricao_situacao_cadastral || '',
  }
}
