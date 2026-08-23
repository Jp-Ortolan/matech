// ---------------------------------------------------------------------------
// PÁGINA · configurações
// ---------------------------------------------------------------------------
// Esta tela não configura: ela EXPLICA. É uma decisão consciente.
//
// As três coisas que um usuário procuraria aqui — quem sou eu, quem pode fazer
// o quê, e com que números o sistema calcula — hoje moram no código, não no
// banco. Transformá-las em campo editável exigiria tabela de parâmetros,
// versionamento (o valor mudou quando? a ordem antiga usou qual?) e tela de
// administração de usuários. Nada disso está no escopo do TCC.
//
// O que dá para fazer, e é honesto, é mostrar o valor em vigor e dizer de onde
// ele vem. Um sistema que esconde a própria regra é pior que um sistema que a
// exibe em leitura.
//
// A matriz de perfis desta tela é o mesmo conteúdo que o permitir() aplica no
// servidor — está em lib/permissoes.js, com a rota de cada linha ao lado, para
// que a conferência seja possível sem sair da tela.

import { useEffect, useState, useCallback } from 'react'
import { auth, sistema } from '../api/recursos'
import { lerToken } from '../api/client'
import { useAutenticacao, NOME_PERFIL } from '../contexto/Autenticacao'
import { CabecalhoPagina } from '../componentes/Layout'
import {
  Painel, Indicador, Botao, Etiqueta, LinhaDado, Aviso, Detalhes,
  Carregando, Erro, formatar,
} from '../componentes/ui'
import { PERFIS, OPERACOES, podeNoPerfil } from '../lib/permissoes'
import { LIMITE_PALITO_PADRAO, DESCONTO_POR_PONTO } from '../lib/calculo'

export default function Configuracoes() {
  const { usuario, sair } = useAutenticacao()
  const token = lerConteudoDoToken(lerToken())
  const ehAdmin = usuario?.perfil === 'ADMINISTRATIVO'

  return (
    <>
      <CabecalhoPagina
        titulo="Configurações"
        subtitulo="Quem pode fazer o quê, e com que regra o sistema calcula"
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          <MatrizDePermissoes perfilAtual={usuario?.perfil} />
          <ParametrosDoCalculo />
        </div>

        <div className="flex flex-col gap-3">
          <MinhaConta usuario={usuario} token={token} aoSair={sair} ehAdmin={ehAdmin} />
          {/* O estado do sistema é diagnóstico de infraestrutura: importa a
              quem administra, e é ruído para o operador de balança, que só
              quer saber se a tela abriu. */}
          {ehAdmin && <EstadoDoSistema />}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Minha conta e a sessão
// ---------------------------------------------------------------------------

function MinhaConta({ usuario, token, aoSair, ehAdmin }) {
  const [agora, setAgora] = useState(() => Date.now())

  // O relógio anda sozinho para que o tempo restante da sessão não fique
  // congelado no valor de quando a tela abriu.
  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 30000)
    return () => clearInterval(relogio)
  }, [])

  const expiraEm = token?.exp ? token.exp * 1000 : null
  const restaMs = expiraEm ? expiraEm - agora : null
  const expirado = restaMs !== null && restaMs <= 0

  return (
    <Painel titulo="Minha conta">
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[3px] bg-mate-100 text-sm font-bold text-mate-700">
            {(usuario?.nome || '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-tinta">{usuario?.nome}</p>
            <p className="text-[10.5px] text-cinza-600">{NOME_PERFIL[usuario?.perfil] || usuario?.perfil}</p>
          </div>
        </div>

        {/* O nome do perfil já aparece acima do avatar. Repeti-lo aqui, e
            ainda no formato cru do banco (ANALISTA_QUALIDADE), era informação
            para quem programa, não para quem trabalha. */}
        <LinhaDado rotulo="Usuário" valor={usuario?.usuario} />

        {expirado && (
          <Aviso tom="alerta">
            A sessão venceu. Encerre e entre de novo para continuar gravando.
          </Aviso>
        )}

        {/* Recolhido, e só para quem administra: o prazo do token e a
            explicação do JWT são verdadeiros e úteis — uma vez por mês, para
            uma pessoa. Deixá-los abertos faz o operador de balança pagar todo
            dia o custo de rolar por eles. */}
        {ehAdmin && (
          <Detalhes titulo="Detalhes da sessão">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <LinhaDado rotulo="Perfil no banco" valor={usuario?.perfil} />
              <LinhaDado rotulo="Iniciada" valor={token?.iat ? formatar.dataHora(token.iat * 1000) : null} />
              <LinhaDado
                rotulo="Expira"
                valor={expiraEm ? (
                  <span className={expirado ? 'text-perigo' : ''}>
                    {formatar.dataHora(expiraEm)}
                    {!expirado && restaMs !== null && (
                      <span className="ml-1 font-normal text-cinza-400">({tempoRestante(restaMs)})</span>
                    )}
                  </span>
                ) : null}
              />
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-cinza-600">
              Perfil e prazo vêm do próprio token, assinado pelo servidor. Alterá-los
              no navegador invalida a assinatura e a API recusa a requisição — por
              isso a permissão pode ser lida aqui sem ser decidida aqui.
            </p>
          </Detalhes>
        )}

        <Botao variante="perigo" onClick={aoSair} className="justify-center">
          Encerrar sessão
        </Botao>
      </div>
    </Painel>
  )
}

// ---------------------------------------------------------------------------
// Matriz de perfis por operação
// ---------------------------------------------------------------------------

function MatrizDePermissoes({ perfilAtual }) {
  return (
    <Painel
      titulo="Perfis e permissões"
      acao={perfilAtual ? `seu perfil: ${NOME_PERFIL[perfilAtual] || perfilAtual}` : null}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-borda bg-cabecalho">
              <th className="px-4 py-2.5 text-[9px] font-semibold uppercase tracking-wide text-cinza-400">
                Operação
              </th>
              {PERFIS.map((p) => (
                <th
                  key={p.id}
                  className={`px-2 py-2.5 text-center text-[9px] font-semibold uppercase tracking-wide ${
                    p.id === perfilAtual ? 'bg-mate-100 text-mate-700' : 'text-cinza-400'
                  }`}
                  style={{ width: '96px' }}
                >
                  {p.curto}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {OPERACOES.map((grupo) => (
              <GrupoDeOperacoes key={grupo.grupo} grupo={grupo} perfilAtual={perfilAtual} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-borda px-4 py-2.5">
        <p className="text-[10px] leading-relaxed text-cinza-400">
          O perfil Administrativo passa em todas as operações — está escrito assim no
          <span className="font-medium text-cinza-600"> permitir() </span>
          do servidor, que sempre acrescenta ADMINISTRATIVO à lista de autorizados.
          Esconder um botão na interface é conveniência de navegação; quem recusa a
          operação de fato é o middleware, antes de a rota chegar ao controlador.
        </p>
      </div>
    </Painel>
  )
}

function GrupoDeOperacoes({ grupo, perfilAtual }) {
  return (
    <>
      <tr>
        <td colSpan={PERFIS.length + 1} className="border-b border-borda bg-zebra px-4 pb-1.5 pt-3">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-cinza-400">
            {grupo.grupo}
          </span>
        </td>
      </tr>
      {grupo.itens.map((item, i) => (
        <tr key={item.rota + i} className={`border-b border-borda ${i % 2 ? 'bg-zebra' : 'bg-white'}`}>
          <td className="px-4 py-2.5">
            <p className="text-[11.5px] font-medium text-tinta">{item.nome}</p>
            <p className="mt-0.5 font-mono text-[9.5px] text-cinza-400">{item.rota}</p>
          </td>
          {PERFIS.map((p) => {
            const pode = podeNoPerfil(p.id, item.perfis)
            return (
              <td key={p.id} className={`px-2 py-2.5 text-center ${p.id === perfilAtual ? 'bg-mate-100' : ''}`}>
                {pode ? (
                  <span className="inline-block h-[9px] w-[9px] rounded-[1px] bg-mate-500" title="permitido" />
                ) : (
                  <span className="inline-block h-[2px] w-[9px] bg-borda" title="não permitido" />
                )}
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Parâmetros do cálculo de pagamento
// ---------------------------------------------------------------------------

function ParametrosDoCalculo() {
  // Exemplo com números redondos: serve para o usuário conferir a regra sem
  // precisar abrir uma carga real.
  const exemplo = { peso: 10000, preco: 5, palito: 34 }
  const excedente = Math.max(0, exemplo.palito - LIMITE_PALITO_PADRAO)
  const desconto = excedente * DESCONTO_POR_PONTO
  const precoAjustado = exemplo.preco * (1 - desconto / 100)

  return (
    <Painel titulo="Parâmetros do cálculo de pagamento" acao="somente leitura">
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex flex-wrap gap-2 xl:gap-3">
          <Indicador rotulo="Limite de palito aceito" valor={formatar.porcento(LIMITE_PALITO_PADRAO, 0)}
                     apoio="acima disso, começa o desconto" cor="text-mate-700" />
          <Indicador rotulo="Desconto por ponto excedente" valor={formatar.porcento(DESCONTO_POR_PONTO, 0)}
                     apoio="sobre o preço combinado" cor="text-mate-700" />
        </div>

        <div className="rounded-[3px] border border-borda">
          <p className="border-b border-borda bg-cabecalho px-3 py-2 text-[9px] font-semibold uppercase tracking-wide text-cinza-400">
            Exemplo · carga de {formatar.kg(exemplo.peso)} a {formatar.reais(exemplo.preco)}/kg com {formatar.porcento(exemplo.palito, 0)} de palito
          </p>
          {[
            ['Excedente de palito', `${formatar.numero(excedente)} pontos percentuais acima do limite`],
            ['Desconto aplicado', `−${formatar.porcento(desconto, 0)} sobre o preço`],
            ['Preço ajustado', `${formatar.reais(precoAjustado)}/kg`],
          ].map(([r, v], i) => (
            <div key={r} className={`flex items-center gap-2 px-3 py-2 ${i < 2 ? 'border-b border-borda' : ''}`}>
              <span className="flex-1 text-[11px] text-cinza-600">{r}</span>
              <span className="text-[11.5px] font-semibold tabular text-tinta">{v}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 bg-mate-100 px-3 py-3">
            <span className="flex-1 text-[9px] font-semibold uppercase tracking-wide text-mate-700">
              Valor total do exemplo
            </span>
            <span className="text-lg font-bold tabular text-mate-700">
              {formatar.reais(exemplo.peso * precoAjustado)}
            </span>
          </div>
        </div>

        <Aviso tom="alerta">
          Estes dois valores são <strong>provisórios</strong>. A fórmula definitiva
          ainda será confirmada com a ervateira. Enquanto isso, eles ficam isolados
          em um lugar só no servidor — <span className="font-mono">cargas.service.js</span> —
          e espelhados em <span className="font-mono">web/src/lib/calculo.js</span> apenas
          para a pré-visualização enquanto o analista digita. Quando a regra oficial
          chegar, muda-se o serviço: nenhuma tela precisa ser reescrita.
        </Aviso>
      </div>
    </Painel>
  )
}

// ---------------------------------------------------------------------------
// Estado do sistema
// ---------------------------------------------------------------------------
// /health confirma duas coisas de uma vez: que a API responde e que ela
// consegue falar com o PostgreSQL (a rota executa um SELECT 1). /api/auth/eu
// confirma a terceira: que o token guardado neste navegador ainda é aceito.

function EstadoDoSistema() {
  const [saude, setSaude] = useState(null)
  const [sessaoValida, setSessaoValida] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [verificadoEm, setVerificadoEm] = useState(null)

  const verificar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const s = await sistema.saude()
      setSaude(s)
      // Se o token tiver vencido, o cliente HTTP já derruba a sessão sozinho;
      // aqui só registramos o resultado para exibir.
      try {
        await auth.eu()
        setSessaoValida(true)
      } catch {
        setSessaoValida(false)
      }
      setVerificadoEm(new Date())
    } catch (e) {
      setSaude(null)
      setErro(e)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { verificar() }, [verificar])

  return (
    <Painel
      titulo="Estado do sistema"
      acao={
        <button onClick={verificar} disabled={carregando} className="font-semibold hover:underline disabled:opacity-50">
          {carregando ? 'verificando...' : 'verificar novamente'}
        </button>
      }
    >
      {carregando && !saude ? (
        <Carregando texto="Consultando a API..." />
      ) : (
        <div className="flex flex-col gap-3 px-4 py-4">
          {erro ? (
            <>
              <Erro erro={erro} />
              <p className="text-[10.5px] text-cinza-600">
                A API não respondeu. Confira se o servidor está no ar na porta 3000
                (<span className="font-mono">npm run dev</span> na pasta do projeto).
              </p>
            </>
          ) : (
            <>
              {[
                ['API', saude?.status === 'ok', saude?.status === 'ok' ? 'respondendo' : 'sem resposta'],
                ['Banco de dados', saude?.banco === 'conectado', saude?.banco || 'desconhecido'],
                ['Sessão', sessaoValida === true, sessaoValida ? 'token aceito pelo servidor' : 'token recusado'],
              ].map(([rotulo, ok, texto]) => (
                <div key={rotulo} className="flex items-center gap-2.5">
                  <span className={`h-[9px] w-[9px] rounded-[1px] ${ok ? 'bg-mate-500' : 'bg-perigo'}`} />
                  <span className="flex-1 text-[11.5px] font-medium text-tinta">{rotulo}</span>
                  <span className="text-[10.5px] text-cinza-600">{texto}</span>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-borda pt-3">
                <LinhaDado rotulo="Hora do servidor" valor={saude?.horario ? formatar.dataHora(saude.horario) : null} />
                <LinhaDado rotulo="Verificado em" valor={verificadoEm ? formatar.dataHora(verificadoEm) : null} />
                <LinhaDado rotulo="Endereço da API" valor={<span className="font-mono text-[10.5px]">/api</span>} />
                <LinhaDado rotulo="Versão" valor={<Etiqueta tom="verde">MATECH v0.4 · base local</Etiqueta>} />
              </div>
            </>
          )}
        </div>
      )}
    </Painel>
  )
}

// ---------------------------------------------------------------------------
// Leitura do token
// ---------------------------------------------------------------------------
// O JWT tem três partes separadas por ponto: cabeçalho, conteúdo e assinatura.
// O conteúdo vai em base64 e QUALQUER UM consegue lê-lo — é por isso que ele
// nunca carrega senha nem dado sensível. O que protege o token não é o sigilo
// do conteúdo, é a assinatura: alterar o perfil aqui dentro invalidaria a
// assinatura e a API recusaria a requisição.

function lerConteudoDoToken(token) {
  if (!token) return null
  try {
    const parte = token.split('.')[1]
    if (!parte) return null
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

function tempoRestante(ms) {
  const minutos = Math.floor(ms / 60000)
  if (minutos < 1) return 'menos de um minuto'
  if (minutos < 60) return `faltam ${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return `faltam ${horas}h${resto ? ` ${resto}min` : ''}`
}
