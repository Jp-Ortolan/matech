import { useEffect, useState, useCallback } from 'react'
import {
  cargas as apiCargas,
  produtores as apiProdutores,
  motoristas as apiMotoristas,
} from '../api/recursos'
import { useAutenticacao } from '../contexto/Autenticacao'
import { CabecalhoPagina } from '../componentes/Layout'
import TicketPesagem from '../componentes/TicketPesagem'
import FichaDaCarga from '../componentes/FichaDaCarga'
import {
  Painel, Filtros, Tabela, Paginacao, Campo, Selecao, Botao, Janela,
  Carregando, Erro, Aviso, LinhaDado
} from '../componentes/ui'
import { mascararPlaca, mascararDocumento, erroNoCpf, erroNaPlaca } from '../lib/documentos'
import { formatar, contagem } from '../lib/formatar'
import { ICONE_DA_ACAO, SITUACAO, SITUACOES_DA_CARGA } from '../lib/icones'
import { colunasDeCargas } from '../componentes/tabelas'
import { resumirFiltros, nomeNaLista } from '../lib/filtros'

export default function Recebimento() {
  const { podeFazer } = useAutenticacao()
  const veDinheiro = podeFazer('ADMINISTRATIVO')

  const [filtros, setFiltros] = useState({ busca: '', de: '', ate: '', produtorId: '', situacao: '' })
  const [pagina, setPagina] = useState(1)
  const [dados, setDados] = useState(null)
  const [listaProdutores, setListaProdutores] = useState([])
  const [listaMotoristas, setListaMotoristas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [erroProdutores, setErroProdutores] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [confirmacao, setConfirmacao] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [fichaId, setFichaId] = useState(null)
  const [fila, setFila] = useState([])
  const [erroFila, setErroFila] = useState(null)

  const buscar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      setDados(await apiCargas.listar({ ...filtros, pagina }))
    } catch (e) {
      setErro(e)
    } finally {
      setCarregando(false)
    }
  }, [filtros, pagina])

  useEffect(() => { buscar() }, [buscar])

  const buscarFila = useCallback(async () => {
    try {
      const r = await apiCargas.listar({ situacao: 'AGUARDANDO_TARA', porPagina: 100 })
      setFila(r.cargas)
      setErroFila(null)
    } catch (e) {
      setErroFila(e)
    }
  }, [])

  useEffect(() => { buscarFila() }, [buscarFila])

  useEffect(() => {
    apiProdutores
      .listar()
      .then((r) => { setListaProdutores(r.produtores); setErroProdutores(null) })
      .catch(setErroProdutores)
  }, [])

  const carregarMotoristas = useCallback(async () => {
    try {
      const r = await apiMotoristas.listar()
      setListaMotoristas(r.motoristas)
    } catch {
      setListaMotoristas([])
    }
  }, [])

  useEffect(() => { carregarMotoristas() }, [carregarMotoristas])

  function alterar(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
    setPagina(1)
  }

  return (
    <>
      <CabecalhoPagina titulo="Pesagem">
        {podeFazer('OPERADOR_BALANCA') && (
          <Botao
            variante="primario"
            onClick={() => { setConfirmacao(null); setMostrarForm((v) => !v) }}
            icone={mostrarForm ? ICONE_DA_ACAO.limpar : ICONE_DA_ACAO.registrar}
          >
            {mostrarForm ? 'Fechar' : 'Registrar entrada'}
          </Botao>
        )}
      </CabecalhoPagina>

      {confirmacao && (
        <Painel
          className="mb-6"
          titulo={confirmacao.pesoLiquidoKg == null ? 'Entrada registrada' : 'Pesagem fechada'}
          acao={
            <span className="flex flex-wrap gap-2 xl:gap-3">
              {confirmacao.pesoLiquidoKg != null && (
                <button
                  onClick={() => setTicket(confirmacao)}
                  className="font-semibold text-mate-700 hover:underline"
                >
                  imprimir ticket
                </button>
              )}
              <button onClick={() => setConfirmacao(null)} className="font-semibold hover:underline">
                fechar
              </button>
            </span>
          }
        >
          <div className="flex flex-wrap items-center gap-5 bg-mate-100 px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold text-mate-700">
                {confirmacao.pesoLiquidoKg == null ? 'Carga' : 'Número do ticket'}
              </p>
              <p className="text-2xl font-bold tabular text-mate-700">{confirmacao.numeroTicket}</p>
            </div>
            <span className="h-9 w-px bg-mate-300" />
            <LinhaDado rotulo="Produtor" valor={confirmacao.produtor?.nome} />
            <LinhaDado rotulo="Matéria-prima" valor={formatar.materiaPrima(confirmacao.tipoMateriaPrima)} />
            {confirmacao.pesoLiquidoKg == null ? (
              <>
                <LinhaDado rotulo="Peso bruto" valor={formatar.kg(confirmacao.pesoBrutoKg)} />
                <LinhaDado rotulo="Falta" valor="pesar o caminhão vazio" />
              </>
            ) : (
              <LinhaDado rotulo="Peso líquido" valor={formatar.kg(confirmacao.pesoLiquidoKg)} />
            )}
          </div>
        </Painel>
      )}

      {mostrarForm && (
        <FormularioEntrada
          produtores={listaProdutores}
          motoristas={listaMotoristas}
          aoCadastrarMotorista={carregarMotoristas}
          aoRegistrar={(criada) => {
            setMostrarForm(false)
            setConfirmacao(criada)
            buscar()
            buscarFila()
          }}
        />
      )}

      <FilaDeTara
        cargas={fila}
        erro={erroFila}
        podeFechar={podeFazer('OPERADOR_BALANCA')}
        aoFechar={(fechada) => { setConfirmacao(fechada); buscar(); buscarFila() }}
      />

      <Filtros
        busca={(
          <Campo
            rotulo="Ticket ou produtor" className="min-w-[220px] flex-1 max-w-[340px]"
            placeholder="PES-2026-01184 ou José"
            value={filtros.busca} onChange={(e) => alterar('busca', e.target.value)}
          />
        )}
        ativos={resumirFiltros(filtros, {
          de: (v) => `De ${formatar.data(v)}`,
          ate: (v) => `Até ${formatar.data(v)}`,
          produtorId: (v) => nomeNaLista(listaProdutores, v),
          situacao: (v) => SITUACAO[v]?.rotulo ?? v,
        })}
        aoRemover={(chave) => alterar(chave, '')}
        aoLimpar={() => setFiltros({ busca: filtros.busca, de: '', ate: '', produtorId: '', situacao: '' })}
      >
        <Campo rotulo="De" type="date" className="flex-1" value={filtros.de} onChange={(e) => alterar('de', e.target.value)} />
        <Campo rotulo="Até" type="date" className="flex-1" value={filtros.ate} onChange={(e) => alterar('ate', e.target.value)} />
        <Selecao rotulo="Produtor" className="flex-[2]" value={filtros.produtorId} onChange={(e) => alterar('produtorId', e.target.value)}>
          <option value="">Todos os produtores</option>
          {listaProdutores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Selecao>
        <Selecao rotulo="Situação" className="flex-1" value={filtros.situacao} onChange={(e) => alterar('situacao', e.target.value)}>
          <option value="">Todas</option>
          {SITUACOES_DA_CARGA.map((s) => (
            <option key={s} value={s}>{SITUACAO[s].rotulo}</option>
          ))}
        </Selecao>
      </Filtros>

      <Erro erro={erro} />

      {erroProdutores && (
        <div className="mb-3">
          <Aviso tom="alerta">
            Não foi possível carregar a lista de produtores ({erroProdutores.message}).
            O filtro e o formulário de pesagem estão sem opções.
          </Aviso>
        </div>
      )}

      <Painel titulo="Cargas recebidas" acao={carregando ? 'buscando...' : `${formatar.numero(dados?.total ?? 0)} no total`}>
        {carregando ? (
          <Carregando />
        ) : (
          <>
          <Tabela
            colunas={colunasDeCargas({ veDinheiro })}
            dados={dados?.cargas ?? []}
            aoClicarLinha={(c) => setFichaId(c.id)}
            linhaAtiva={fichaId}
            vazio="Nenhuma carga encontrada com esses filtros."
          />
          <Paginacao
            pagina={dados?.pagina ?? 1}
            porPagina={dados?.porPagina ?? 20}
            total={dados?.total ?? 0}
            aoTrocar={setPagina}
          />
          </>
        )}
      </Painel>

      {fichaId && (
        <Janela
          titulo="Ficha da carga"
          subtitulo="Pesagem, análise de qualidade e pagamento"
          aoFechar={() => setFichaId(null)}
        >
          <FichaDaCarga
            key={fichaId}
            cargaId={fichaId}
            veDinheiro={veDinheiro}
            aoImprimirTicket={(carga) => { setFichaId(null); setTicket(carga) }}
          />
        </Janela>
      )}

      {ticket && <TicketPesagem carga={ticket} aoFechar={() => setTicket(null)} />}
    </>
  )
}

function FilaDeTara({ cargas, erro, podeFechar, aoFechar }) {
  const [taras, setTaras] = useState({})
  const [enviandoId, setEnviandoId] = useState(null)
  const [erroDaLinha, setErroDaLinha] = useState(null)

  if (erro) {
    return (
      <div className="mb-6">
        <Aviso tom="alerta">
          Não foi possível ler a fila da segunda pesagem ({erro.message}). Pode haver
          caminhão esperando sem aparecer aqui.
        </Aviso>
      </div>
    )
  }

  if (!cargas.length) return null

  async function fechar(carga) {
    const tara = taras[carga.id]
    setErroDaLinha(null)
    setEnviandoId(carga.id)
    try {
      const fechada = await apiCargas.fecharTara(carga.id, Number(tara))
      setTaras((t) => ({ ...t, [carga.id]: '' }))
      aoFechar(fechada)
    } catch (e) {
      setErroDaLinha(e)
    } finally {
      setEnviandoId(null)
    }
  }

  return (
    <Painel
      className="mb-6"
      titulo="Aguardando tara"
      acao={contagem(cargas.length, 'caminhão na área', 'caminhões na área')}
    >
      <div className="px-4 pt-3">
        <Erro erro={erroDaLinha} />
      </div>
      <Tabela
        colunas={[
          { chave: 'numeroTicket', titulo: 'Carga', forte: true },
          {
            chave: 'produtor', titulo: 'Produtor', forte: true, truncar: 200,
            render: (c) => (
              <>
                {c.produtor?.nome}
                <span className="block text-[10.5px] font-normal text-cinza-600">
                  {formatar.materiaPrima(c.tipoMateriaPrima)}
                  {c.veiculo?.placa ? ` · ${c.veiculo.placa}` : ''}
                </span>
              </>
            ),
          },
          { chave: 'entrada', titulo: 'Entrada', render: (c) => formatar.dataHora(c.dataHora) },
          {
            chave: 'bruto', titulo: 'Peso bruto', alinhar: 'direita', forte: true,
            render: (c) => formatar.kg(c.pesoBrutoKg),
          },
          {
            chave: 'tara', titulo: 'Tara (kg)', largura: '150px', fixar: podeFechar ? undefined : 'direita',
            render: (c) => (
              podeFechar ? (
                <input
                  type="number" step="0.01" min="0"
                  value={taras[c.id] ?? ''}
                  onChange={(e) => setTaras((t) => ({ ...t, [c.id]: e.target.value }))}
                  onClick={(e) => e.stopPropagation()}
                  className="w-[130px] rounded-[3px] border border-borda bg-white px-2 py-1 text-right text-[11.5px] tabular text-tinta outline-none focus:border-mate-500"
                  placeholder="caminhão vazio"
                />
              ) : <span className="text-cinza-400">—</span>
            ),
          },
          ...(podeFechar ? [{
            chave: 'acao', titulo: '', fixar: 'direita',
            render: (c) => {
              const tara = Number(taras[c.id])
              const valida = Number.isFinite(tara) && tara > 0 && tara < Number(c.pesoBrutoKg)
              return (
                <Botao
                  variante="primario"
                  disabled={!valida || enviandoId === c.id}
                  onClick={(e) => { e.stopPropagation(); fechar(c) }}
                  title={
                    taras[c.id] && !valida
                      ? 'A tara precisa ser maior que zero e menor que o peso bruto.'
                      : undefined
                  }
                >
                  {enviandoId === c.id ? 'Fechando...' : 'Fechar pesagem'}
                </Botao>
              )
            },
          }] : []),
        ]}
        dados={cargas}
        vazio="Nenhum caminhão aguardando a segunda pesagem."
      />
    </Painel>
  )
}

function FormularioEntrada({ produtores, motoristas, aoCadastrarMotorista, aoRegistrar }) {
  const [form, setForm] = useState({
    produtorId: '', tipoMateriaPrima: 'ERVA_MATE_NATIVA',
    motoristaId: '', veiculoId: '',
    pesoBrutoKg: '', pesoEstimadoCampoKg: '', metragemM3: '',
  })
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [cadastrandoMotorista, setCadastrandoMotorista] = useState(false)
  const [fichaMotorista, setFichaMotorista] = useState(null)

  const motorista = motoristas.find((m) => m.id === form.motoristaId)
  const veiculos = motorista?.veiculos ?? []

  const bruto = Number(form.pesoBrutoKg || 0)
  const ehLenha = form.tipoMateriaPrima === 'LENHA'

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function escolherMotorista(id) {
    const novo = motoristas.find((m) => m.id === id)
    const principal = novo?.veiculos?.[0]
    setForm((f) => ({
      ...f,
      motoristaId: id,
      veiculoId: principal?.id ?? '',
    }))
  }

  function escolherVeiculo(id) {
    setForm((f) => ({ ...f, veiculoId: id }))
  }

  async function enviar(e) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const criada = await apiCargas.registrar({
        ...form,
        motoristaId: form.motoristaId || null,
        veiculoId: form.veiculoId || null,
        pesoBrutoKg: Number(form.pesoBrutoKg),
        pesoEstimadoCampoKg: form.pesoEstimadoCampoKg ? Number(form.pesoEstimadoCampoKg) : null,
        metragemM3: ehLenha && form.metragemM3 ? Number(form.metragemM3) : null,
      })
      aoRegistrar(criada)
    } catch (e) {
      setErro(e)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Painel titulo="Entrada do veículo" className="mb-6">
      <form onSubmit={enviar} className="flex flex-col gap-3 px-4 py-4">
        <Erro erro={erro} />

        <div className="flex flex-wrap gap-2 xl:gap-3">
          <Selecao rotulo="Produtor" className="flex-1" required value={form.produtorId} onChange={(e) => alterar('produtorId', e.target.value)}>
            <option value="">Selecione o produtor</option>
            {produtores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Selecao>
          <Selecao rotulo="Matéria-prima" className="flex-1" value={form.tipoMateriaPrima} onChange={(e) => alterar('tipoMateriaPrima', e.target.value)}>
            <option value="ERVA_MATE_NATIVA">Erva-mate in natura nativa</option>
            <option value="ERVA_MATE_PLANTADA">Erva-mate in natura plantada</option>
            <option value="PALITO">Apenas palito</option>
            <option value="LENHA">Lenha</option>
          </Selecao>
        </div>

        <div className="flex flex-wrap gap-2 xl:gap-3">
          <Selecao
            rotulo="Motorista"
            className="flex-1"
            value={form.motoristaId}
            onChange={(e) => escolherMotorista(e.target.value)}
          >
            <option value="">Sem motorista informado</option>
            {motoristas.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </Selecao>

          <Selecao
            rotulo="Veículo"
            className="flex-1"
            value={form.veiculoId}
            onChange={(e) => escolherVeiculo(e.target.value)}
            disabled={!form.motoristaId}
          >
            <option value="">
              {form.motoristaId ? 'Sem veículo informado' : 'Escolha o motorista antes'}
            </option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa}{v.tipo ? ` · ${v.tipo}` : ''}
              </option>
            ))}
          </Selecao>

          <div className="flex items-end gap-2">
            {motorista && (
              <button
                type="button"
                onClick={() => setFichaMotorista(motorista)}
                className="whitespace-nowrap rounded-[2px] border border-borda px-2.5 py-2 text-[11px] font-semibold text-cinza-600 hover:border-mate-500 hover:text-mate-700"
              >
                Ver ficha
              </button>
            )}
            <button
              type="button"
              onClick={() => setCadastrandoMotorista((v) => !v)}
              className="whitespace-nowrap rounded-[2px] border border-borda px-2.5 py-2 text-[11px] font-semibold text-cinza-600 hover:border-mate-500 hover:text-mate-700"
            >
              {cadastrandoMotorista ? 'Cancelar' : '+ Motorista'}
            </button>
          </div>
        </div>

        {cadastrandoMotorista && (
          <NovoMotorista
            aoCriar={async (criado) => {
              await aoCadastrarMotorista()
              setCadastrandoMotorista(false)
              setForm((f) => ({
                ...f,
                motoristaId: criado.id,
                veiculoId: criado.veiculos?.[0]?.id ?? '',
              }))
            }}
            aoCancelar={() => setCadastrandoMotorista(false)}
          />
        )}

        <div className="flex flex-wrap gap-2 xl:gap-3">
          <Campo rotulo="Peso bruto (kg)" type="number" step="0.01" min="0.01" className="flex-1" required value={form.pesoBrutoKg} onChange={(e) => alterar('pesoBrutoKg', e.target.value)} />
          <Campo rotulo="Estimado em campo (kg)" type="number" step="0.01" min="0.01" className="flex-1" value={form.pesoEstimadoCampoKg} onChange={(e) => alterar('pesoEstimadoCampoKg', e.target.value)} />
          {ehLenha && (
            <Campo rotulo="Metragem (m³)" type="number" step="0.01" min="0.01" max="500" className="flex-1"
                   value={form.metragemM3} onChange={(e) => alterar('metragemM3', e.target.value)} />
          )}
        </div>

        <div className="flex items-center gap-4 rounded-[3px] bg-mate-100 px-4 py-3">
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-mate-700">Peso bruto na balança</p>
            <p className="text-xl font-bold tabular text-mate-700">
              {bruto > 0 ? formatar.kg(bruto) : '—'}
            </p>
            <p className="mt-0.5 text-[10.5px] text-mate-700">
              A tara é pesada quando o caminhão voltar vazio. O ticket sai lá.
            </p>
          </div>
          <Botao variante="primario" type="submit" disabled={enviando || !(bruto > 0)}>
            {enviando ? 'Gravando...' : 'Registrar entrada'}
          </Botao>
        </div>
      </form>

      {fichaMotorista && (
        <Janela
          titulo={fichaMotorista.nome}
          subtitulo="Motorista e veículos cadastrados"
          largura={560}
          aoFechar={() => setFichaMotorista(null)}
        >
          <FichaDoMotorista motorista={fichaMotorista} />
        </Janela>
      )}
    </Painel>
  )
}

function FichaDoMotorista({ motorista }) {
  const veiculos = motorista.veiculos ?? []

  return (
    <Painel titulo={motorista.nome} acao={contagem(veiculos.length, 'veículo', 'veículos')}>
      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <LinhaDado rotulo="Nome" valor={motorista.nome} />
          <LinhaDado rotulo="CPF" valor={motorista.cpf ? mascararDocumento(motorista.cpf) : null} />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold text-cinza-600">Veículos</p>
          {veiculos.length ? (
            <div className="flex flex-col gap-1.5">
              {veiculos.map((v) => (
                <div key={v.id} className="flex items-baseline gap-3 rounded-[3px] border border-borda px-3 py-2">
                  <span className="text-[12.5px] font-bold tabular text-tinta">{v.placa}</span>
                  <span className="flex-1 text-[11px] text-cinza-600">{v.tipo || 'tipo não informado'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-cinza-400">
              Nenhum veículo cadastrado para este motorista.
            </p>
          )}
        </div>
      </div>
    </Painel>
  )
}

function NovoMotorista({ aoCriar, aoCancelar }) {
  const [dados, setDados] = useState({ nome: '', cpf: '', placa: '', tipo: '' })
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const erroCpf = dados.cpf ? erroNoCpf(dados.cpf) : null
  const erroPlaca = erroNaPlaca(dados.placa)
  const podeSalvar = dados.nome.trim().length >= 3 && !erroCpf && dados.cpf && !erroPlaca

  function alterar(campo, valor) {
    setDados((d) => ({ ...d, [campo]: valor }))
  }

  async function salvar() {
    setErro(null)
    setSalvando(true)
    try {
      const criado = await apiMotoristas.criar({
        nome: dados.nome,
        cpf: dados.cpf,
        veiculo: dados.placa ? { placa: dados.placa, tipo: dados.tipo } : undefined,
      })
      await aoCriar(criado)
    } catch (e) {
      setErro(e)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="rounded-[3px] border border-mate-300 bg-mate-100 px-3 py-3">
      <p className="mb-2 text-[11px] font-semibold text-mate-700">
        Motorista novo
      </p>

      <Erro erro={erro} />

      <div className="flex flex-wrap gap-2">
        <Campo
          rotulo="Nome *"
          className="flex-[2]"
          value={dados.nome}
          onChange={(e) => alterar('nome', e.target.value)}
        />
        <Campo
          rotulo="CPF *"
          className="flex-1"
          inputMode="numeric"
          value={mascararDocumento(dados.cpf)}
          onChange={(e) => alterar('cpf', e.target.value)}
        />
        <Campo
          rotulo="Placa"
          className="flex-1"
          value={mascararPlaca(dados.placa)}
          onChange={(e) => alterar('placa', e.target.value)}
        />
      </div>

      {(erroCpf || erroPlaca) && (
        <p className="mt-2 text-[10.5px] font-medium text-perigo">{erroCpf || erroPlaca}</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Botao variante="primario" type="button" disabled={!podeSalvar || salvando} onClick={salvar}>
          {salvando ? 'Salvando...' : 'Salvar e usar nesta carga'}
        </Botao>
        <Botao type="button" onClick={aoCancelar}>Cancelar</Botao>
      </div>
    </div>
  )
}
