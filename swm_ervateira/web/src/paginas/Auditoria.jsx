import { useCallback, useEffect, useState } from 'react'
import { auditoria } from '../api/recursos'
import { CabecalhoPagina } from '../componentes/Layout'
import {
  FaixaDeIndicadores, Painel, Filtros, Tabela, Indicador, Campo, Selecao, Botao,
  Etiqueta, Carregando, Erro,
} from '../componentes/ui'
import { formatar, contagem } from '../lib/formatar'
import { NOME_PERFIL } from '../lib/permissoes'
import { ICONE_DA_ACAO, ICONE_DA_GRANDEZA } from '../lib/icones'
import { resumirFiltros, nomeNaLista } from '../lib/filtros'

const ACOES = [
  { id: 'USUARIO_CRIADO', rotulo: 'Conta criada', tom: 'verde' },
  { id: 'USUARIO_ALTERADO', rotulo: 'Conta alterada', tom: 'neutro' },
  { id: 'SENHA_REDEFINIDA', rotulo: 'Senha redefinida', tom: 'alerta' },
]
const ACAO = Object.fromEntries(ACOES.map((a) => [a.id, a]))

const ROTULO_CAMPO = {
  nome: 'Nome',
  usuario: 'Login',
  perfil: 'Perfil',
  ativo: 'Situação',
}

function valorLegivel(campo, valor) {
  if (campo === 'ativo') return valor ? 'Ativa' : 'Inativa'
  if (campo === 'perfil') return NOME_PERFIL[valor] ?? valor
  if (valor === null || valor === undefined || valor === '') return '—'
  return String(valor)
}

function MudancasDoRegistro({ registro }) {
  const depois = registro.depois || {}
  const antes = registro.antes || {}
  const campos = Object.keys(depois)

  if (!campos.length) {
    return <span className="text-cinza-400">sem valores registrados</span>
  }

  return (
    <span className="flex flex-col gap-0.5">
      {campos.map((campo) => (
        <span key={campo} className="flex flex-wrap items-baseline gap-1">
          <span className="text-cinza-400">{ROTULO_CAMPO[campo] ?? campo}:</span>
          <span className="text-cinza-600 line-through decoration-cinza-400">
            {valorLegivel(campo, antes[campo])}
          </span>
          <span className="text-cinza-400">→</span>
          <span className="font-semibold text-tinta">{valorLegivel(campo, depois[campo])}</span>
        </span>
      ))}
    </span>
  )
}

export default function Auditoria() {
  const [filtros, setFiltros] = useState({ acao: '', usuarioId: '', de: '', ate: '' })
  const [dados, setDados] = useState(null)
  const [autores, setAutores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      setDados(await auditoria.listar(filtros))
    } catch (e) {
      setErro(e)
    } finally {
      setCarregando(false)
    }
  }, [filtros])

  useEffect(() => { buscar() }, [buscar])

  useEffect(() => {
    auditoria.autores().then((r) => setAutores(r.autores)).catch(() => {})
  }, [])

  const registros = dados?.registros ?? []
  const contarAcao = (id) => registros.filter((r) => r.acao === id).length

  if (erro) return <Erro erro={erro} />

  return (
    <>
      <CabecalhoPagina titulo="Registro de alterações">
        <Botao onClick={buscar} disabled={carregando} icone={ICONE_DA_ACAO.atualizar}>
          {carregando ? 'Atualizando...' : 'Atualizar'}
        </Botao>
      </CabecalhoPagina>

      <Filtros
        ativos={resumirFiltros(filtros, {
          acao: (v) => ACOES.find((a) => a.id === v)?.rotulo ?? v,
          usuarioId: (v) => nomeNaLista(autores, v),
          de: (v) => `De ${formatar.data(v)}`,
          ate: (v) => `Até ${formatar.data(v)}`,
        })}
        aoRemover={(chave) => setFiltros({ ...filtros, [chave]: '' })}
        aoLimpar={() => setFiltros({ acao: '', usuarioId: '', de: '', ate: '' })}
      >
        <Selecao
          rotulo="O que aconteceu"
          className="flex-[2]"
          value={filtros.acao}
          onChange={(e) => setFiltros({ ...filtros, acao: e.target.value })}
        >
          <option value="">Todas as alterações</option>
          {ACOES.map((a) => (
            <option key={a.id} value={a.id}>{a.rotulo}</option>
          ))}
        </Selecao>
        <Selecao
          rotulo="Quem fez"
          className="flex-[2]"
          value={filtros.usuarioId}
          onChange={(e) => setFiltros({ ...filtros, usuarioId: e.target.value })}
        >
          <option value="">Qualquer pessoa</option>
          {autores.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}{a.contaAtiva ? '' : ' · conta removida'}
            </option>
          ))}
        </Selecao>
        <Campo
          rotulo="De"
          type="date"
          className="flex-1"
          value={filtros.de}
          onChange={(e) => setFiltros({ ...filtros, de: e.target.value })}
        />
        <Campo
          rotulo="Até"
          type="date"
          className="flex-1"
          value={filtros.ate}
          onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })}
        />
      </Filtros>

      <FaixaDeIndicadores>
        <Indicador
          rotulo="Alterações registradas" icone={ICONE_DA_GRANDEZA.sincronia}
          valor={dados?.total ?? '—'}
          apoio={dados && dados.exibindo < dados.total ? `mostrando as ${dados.exibindo} mais recentes` : 'no filtro atual'}
        />
        <Indicador rotulo="Contas criadas" icone={ICONE_DA_GRANDEZA.produtores} valor={contarAcao('USUARIO_CRIADO')} apoio="novos acessos ao sistema" />
        <Indicador rotulo="Contas alteradas" icone={ICONE_DA_GRANDEZA.produtores} valor={contarAcao('USUARIO_ALTERADO')} apoio="nome, perfil ou situação" />
        <Indicador
          rotulo="Senhas redefinidas" icone={ICONE_DA_GRANDEZA.limite}
          valor={contarAcao('SENHA_REDEFINIDA')}
          apoio="redefinidas por um administrador"
          cor={contarAcao('SENHA_REDEFINIDA') > 0 ? 'text-alerta' : 'text-tinta'}
        />
      </FaixaDeIndicadores>

      <Painel
        titulo="O que foi alterado"
        acao={registros.length ? contagem(registros.length, 'registro', 'registros') : null}
      >
        {carregando ? (
          <Carregando />
        ) : (
          <Tabela
            colunas={[
              {
                chave: 'criadoEm',
                titulo: 'Quando',
                largura: '132px',
                render: (r) => formatar.dataHora(r.criadoEm),
              },
              {
                chave: 'quem',
                titulo: 'Quem fez',
                forte: true,
                truncar: 170,
                render: (r) => (
                  <span className="flex flex-col">
                    <span>{r.usuarioNome}</span>
                    <span className="text-[10px] font-normal text-cinza-400">
                      {NOME_PERFIL[r.usuarioPerfil] ?? r.usuarioPerfil}
                    </span>
                  </span>
                ),
              },
              {
                chave: 'acao',
                titulo: 'O que aconteceu',
                largura: '190px',
                render: (r) => (
                  <Etiqueta tom={ACAO[r.acao]?.tom ?? 'neutro'}>
                    {ACAO[r.acao]?.rotulo ?? r.acao}
                  </Etiqueta>
                ),
              },
              { chave: 'alvo', titulo: 'Sobre quem', truncar: 200, render: (r) => r.alvo || '—' },
              { chave: 'mudanca', titulo: 'De → para', render: (r) => <MudancasDoRegistro registro={r} /> },
            ]}
            dados={registros}
            vazio="Nenhuma alteração registrada com esses filtros. O registro começa na primeira conta criada ou na primeira alteração de acesso."
          />
        )}
      </Painel>

      <p className="mt-3 max-w-[760px] text-[10px] leading-relaxed text-cinza-400">
        O registro é somente leitura: não há como editar nem apagar uma linha pelo sistema.
        Senha nunca aparece aqui — o que fica gravado é que ela foi redefinida, por quem e
        para qual conta, jamais qual era ou qual passou a ser. Pesagem e análise não entram
        nesta lista porque já guardam o autor na própria carga.
      </p>
    </>
  )
}
