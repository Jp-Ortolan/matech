// ---------------------------------------------------------------------------
// CONSULTAS EXTERNAS · CEP e CNPJ
// ---------------------------------------------------------------------------
// O QUE SE CONSULTA, E O QUE NÃO SE CONSULTA — e a distinção é de princípio:
//
//   CEP   · ViaCEP. Endereço é informação pública de logradouro.
//   CNPJ  · BrasilAPI. Razão social de empresa é registro público na Receita.
//   CPF   · NADA. Não existe consulta legítima: o nome do titular a partir do
//           CPF é dado pessoal protegido pela LGPD, e os serviços que a
//           oferecem operam em zona irregular. O sistema faz o que é correto
//           e suficiente — valida o dígito verificador, offline, em
//           lib/documentos.js.
//
// AS DUAS CONSULTAS SÃO OPCIONAIS POR CONSTRUÇÃO. Elas preenchem campos para
// poupar digitação; nenhuma delas bloqueia o cadastro. Se a internet cair, ou
// se o serviço estiver fora, o operador digita à mão e a vida segue — que é o
// mesmo princípio do aplicativo em campo: rede é conveniência, não requisito.
//
// Por isso toda função aqui devolve null em vez de lançar. Quem chama trata
// "não veio" como caso normal, não como erro.

/** Tempo máximo de espera. Passou disso, digita-se à mão — é mais rápido. */
const TEMPO_LIMITE = 6000

async function buscarComLimite(url) {
  const controle = new AbortController()
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE)
  try {
    const resposta = await fetch(url, { signal: controle.signal })
    if (!resposta.ok) return null
    return await resposta.json()
  } catch {
    // Sem rede, serviço fora, tempo esgotado: tudo dá no mesmo para quem
    // chama, e nenhum desses casos é motivo para atrapalhar o cadastro.
    return null
  } finally {
    clearTimeout(relogio)
  }
}

/**
 * ViaCEP. Devolve { cep, endereco, bairro, municipio, uf } ou null.
 * O ViaCEP responde 200 com { erro: true } para CEP inexistente — por isso a
 * checagem explícita, e não só o status.
 */
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

/**
 * BrasilAPI. Devolve { nome, fantasia, telefone, cep, endereco, ... } ou null.
 *
 * O nome preferido é o FANTASIA quando existe: numa ervateira, o produtor é
 * conhecido pelo nome da propriedade, não pela razão social com "LTDA" no fim.
 * A razão social vem junto, para quem precisar dela na nota.
 */
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
