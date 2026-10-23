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

// tudo que entra no registro, separado pela área do sistema
const ACOES = [
  { id: 'PRODUTOR_CADASTRADO', rotulo: 'Produtor cadastrado', tom: 'verde', area: 'Cadastros' },
  { id: 'PRODUTOR_ALTERADO', rotulo: 'Produtor alterado', tom: 'neutro', area: 'Cadastros' },
  { id: 'MOTORISTA_CADASTRADO', rotulo: 'Motorista cadastrado', tom: 'verde', area: 'Cadastros' },
  { id: 'MOTORISTA_ALTERADO', rotulo: 'Motorista alterado', tom: 'neutro', area: 'Cadastros' },
  { id: 'VEICULO_CADASTRADO', rotulo: 'Veículo cadastrado', tom: 'verde', area: 'Cadastros' },
  { id: 'ENTRADA_REGISTRADA', rotulo: 'Entrada na balança', tom: 'verde', area: 'Pesagem e qualidade' },
  { id: 'PESAGEM_FECHADA', rotulo: 'Pesagem fechada', tom: 'neutro', area: 'Pesagem e qualidade' },
  { id: 'ANALISE_LANCADA', rotulo: 'Análise lançada', tom: 'neutro', area: 'Pesagem e qualidade' },
  { id: 'ORDEM_EMITIDA', rotulo: 'Ordem emitida', tom: 'alerta', area: 'Pagamentos' },
  { id: 'ORDEM_PAGA', rotulo: 'Baixa de pagamento', tom: 'verde', area: 'Pagamentos' },
  { id: 'SINCRONIZACAO_RECEBIDA', rotulo: 'Dados do app de campo', tom: 'neutro', area: 'App de campo' },
  { id: 'USUARIO_CRIADO', rotulo: 'Conta criada', tom: 'verde', area: 'Contas de acesso' },
  { id: 'USUARIO_ALTERADO', rotulo: 'Conta alterada', tom: 'neutro', area: 'Contas de acesso' },
  { id: 'SENHA_REDEFINIDA', rotulo: 'Senha redefinida', tom: 'alerta', area: 'Contas de acesso' },
  { id: 'SENHA_TROCADA', rotulo: 'Senha trocada', tom: 'neutro', area: 'Contas de acesso' },
]
const ACAO = Object.fromEntries(ACOES.map((a) => [a.id, a]))
const AREAS = [...new Set(ACOES.map((a) => a.area))]

const ROTULO_CAMPO = {
  nome: 'Nome', usuario: 'Login', perfil: 'Perfil', ativo: 'Situação',
  cpfCnpj: 'CPF/CNPJ', cpf: 'CPF', telefone: 'Telefone', cep: 'CEP', endereco: 'Endereço',
  bairro: 'Bairro', municipio: 'Município', uf: 'UF',
  formaPagamento: 'Pagamento', tipoChavePix: 'Tipo da chave', chavePix: 'Chave Pix',
  titularConta: 'Titular', banco: 'Banco', agencia: 'Agência', conta: 'Conta', tipoConta: 'Tipo de conta',
  cnhCategoria: 'CNH', cnhValidade: 'Validade da CNH', placa: 'Placa', tipo: 'Veículo',
  tipoMateriaPrima: 'Matéria-prima', pesoBrutoKg: 'Peso bruto', taraKg: 'Tara', pesoLiquidoKg: 'Peso líquido',
  aprovada: 'Resultado', palitoPercentual: 'Palito', umidadePercentual: 'Umidade', folhaPercentual: 'Folha',
  motivoReprovacao: 'Motivo', periodoInicio: 'De', periodoFim: 'Até', cargas: 'Cargas',
  valorTotal: 'Valor', situacao: 'Situação',
  // o que chega do app de campo
  Produtor: 'Produtores', Erval: 'Ervais', Avaliacao: 'Avaliações',
}

const ORDEM_DOS_CAMPOS = Object.keys(ROTULO_CAMPO)
const posicaoDoCampo = (c) => (ORDEM_DOS_CAMPOS.includes(c) ? ORDEM_DOS_CAMPOS.indexOf(c) : 999)

const SITUACAO_DA_ORDEM = { PENDENTE: 'Em aberto', PAGA: 'Paga', CANCELADA: 'Cancelada' }

// mostra cada valor do jeito que aparece no resto do sistema
function valorLegivel(campo, valor) {
  if (valor === null || valor === undefined || valor === '') return '—'
  switch (campo) {
    case 'ativo': return valor ? 'Ativa' : 'Inativa'
    case 'aprovada': return valor ? 'Aprovada' : 'Reprovada'
    case 'perfil': return NOME_PERFIL[valor] ?? valor
    case 'cpfCnpj': case 'cpf': return formatar.documento(valor)
    case 'cep': return formatar.cep(valor)
    case 'formaPagamento': return formatar.formaPagamento(valor)
    case 'tipoConta': return formatar.tipoConta(valor)
    case 'tipoMateriaPrima': return formatar.materiaPrima(valor)
    case 'pesoBrutoKg': case 'taraKg': case 'pesoLiquidoKg': return formatar.kg(valor)
    case 'palitoPercentual': case 'umidadePercentual': case 'folhaPercentual': return formatar.porcento(valor)
    case 'valorTotal': return formatar.reais(valor)
    case 'cnhValidade': case 'periodoInicio': case 'periodoFim': return formatar.data(valor)
    case 'situacao': return SITUACAO_DA_ORDEM[valor] ?? valor
    default: return String(valor)
  }
}

const CAMPOS_VISIVEIS = 5   // cadastro grande mostra só os primeiros campos

function MudancasDoRegistro({ registro }) {
  const depois = registro.depois || {}
  const antes = registro.antes || {}
  // o banco reordena as chaves ao gravar: aqui voltam para a ordem natural
  const campos = Object.keys(depois).sort((a, b) => posicaoDoCampo(a) - posicaoDoCampo(b))
  // cadastro novo não tem "antes": mostra só o valor, sem o "— →"
  const ehNovo = Object.keys(antes).length === 0

  if (!campos.length) {
    return <span className="text-cinza-400">—</span>
  }

  const visiveis = campos.slice(0, CAMPOS_VISIVEIS)
  const restantes = campos.length - visiveis.length

  return (
    <span className="flex flex-col gap-0.5">
      {visiveis.map((campo) => (
        <span key={campo} className="flex flex-wrap items-baseline gap-1">
          <span className="text-cinza-400">{ROTULO_CAMPO[campo] ?? campo}:</span>
          {!ehNovo && (
            <>
              <span className="text-cinza-600 line-through decoration-cinza-400">
                {valorLegivel(campo, antes[campo])}
              </span>
              <span className="text-cinza-400">→</span>
            </>
          )}
          <span className="font-semibold text-tinta">{valorLegivel(campo, depois[campo])}</span>
        </span>
      ))}
      {restantes > 0 && (
        <span
          className="text-[0.75rem] text-cinza-400"
          title={campos.slice(CAMPOS_VISIVEIS).map((c) => `${ROTULO_CAMPO[c] ?? c}: ${valorLegivel(c, depois[c])}`).join('\n')}
        >
          {contagem(restantes, 'outro campo', 'outros campos')}
        </span>
      )}
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
  const contarArea = (area) => registros.filter((r) => ACAO[r.acao]?.area === area).length

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
          {AREAS.map((area) => (
            <optgroup key={area} label={area}>
              {ACOES.filter((a) => a.area === area).map((a) => (
                <option key={a.id} value={a.id}>{a.rotulo}</option>
              ))}
            </optgroup>
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
          apoio={dados && dados.exibindo < dados.total ? `Mostrando as ${dados.exibindo} mais recentes` : 'No filtro atual'}
        />
        <Indicador rotulo="Cadastros" icone={ICONE_DA_GRANDEZA.produtores} valor={contarArea('Cadastros')} apoio="Produtores, motoristas e veículos" />
        <Indicador rotulo="Pesagem e qualidade" icone={ICONE_DA_GRANDEZA.cargas} valor={contarArea('Pesagem e qualidade')} apoio="Entradas, pesagens e análises" />
        <Indicador rotulo="Pagamentos" icone={ICONE_DA_GRANDEZA.dinheiro} valor={contarArea('Pagamentos')} apoio="Ordens emitidas e baixas" />
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
                    <span className="text-[0.75rem] font-normal text-cinza-400">
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
              { chave: 'alvo', titulo: 'Sobre o quê', truncar: 220, render: (r) => r.alvo || '—' },
              { chave: 'mudanca', titulo: 'De → para', render: (r) => <MudancasDoRegistro registro={r} /> },
            ]}
            dados={registros}
            vazio="Nenhuma alteração registrada com esses filtros."
          />
        )}
      </Painel>

      <p className="mt-3 max-w-[760px] text-[0.75rem] leading-relaxed text-cinza-400">
        O registro é somente leitura: não há como editar nem apagar uma linha pelo sistema.
        Entram aqui os cadastros, a balança, as análises, os pagamentos, os dados que chegam
        do app de campo e as contas de acesso. Senha nunca aparece: fica gravado só que ela
        foi trocada ou redefinida, por quem e quando.
      </p>
    </>
  )
}
