// ---------------------------------------------------------------------------
// PÁGINA · recebimento
// ---------------------------------------------------------------------------
// Duas coisas numa tela só:
//   · consulta do histórico com filtro por data e por produtor  (RF12 a RF14)
//   · registro de uma nova pesagem                              (RF06 a RF09)
//
// O botão de registrar só aparece para quem pode — mas quem garante mesmo é o
// back-end. Esconder na interface é conveniência; a segurança está na API.
//
// TRÊS CORREÇÕES VINDAS DA AUDITORIA FUNCIONAL:
//
//   1. O número do ticket agora é confirmado na tela. O POST devolve a carga
//      criada, com o número que o servidor gerou, e antes esse retorno era
//      descartado — o operador tinha que caçar a linha na tabela para descobrir
//      o número que precisa ditar para o motorista.
//
//   2. Os campos numéricos ganharam limite inferior. Sem min, o navegador
//      aceitava preço negativo, e o servidor gravava.
//
//   3. A falha ao carregar produtores deixou de ser engolida por um
//      .catch(() => {}). Quando a API cai, o campo fica vazio — e vazio, sem
//      aviso, se lê como "não há produtor cadastrado".

import { useEffect, useState, useCallback } from 'react'
import {
  cargas as apiCargas,
  produtores as apiProdutores,
  motoristas as apiMotoristas,
} from '../api/recursos'
import { useAutenticacao } from '../contexto/Autenticacao'
import { CabecalhoPagina } from '../componentes/Layout'
import TicketPesagem from '../componentes/TicketPesagem'
import {
  Painel, Filtros, Tabela, Paginacao, Campo, Selecao, Botao,
  Carregando, Erro, Aviso, LinhaDado
} from '../componentes/ui'
import { mascararPlaca, mascararDocumento, erroNoCpf, erroNaPlaca } from '../lib/documentos'
import { formatar } from '../lib/formatar'
import { ICONE_DA_ACAO, SITUACAO } from '../lib/icones'
import { colunasDeCargas } from '../componentes/tabelas'
import { resumirFiltros, nomeNaLista } from '../lib/filtros'

export default function Recebimento() {
  const { podeFazer } = useAutenticacao()
  // O servidor não manda preço nem valor para quem não é do administrativo.
  // A coluna some junto: uma coluna inteira de travessões não informa nada e
  // ainda sugere que o dado está faltando, e não que não é seu.
  const veDinheiro = podeFazer('ADMINISTRATIVO')

  const [filtros, setFiltros] = useState({ busca: '', de: '', ate: '', produtorId: '', situacao: '' })
  // A página fica FORA de `filtros` de propósito: mudar um filtro tem de
  // voltar para a primeira página, e mudar de página não pode reabrir a busca
  // do zero. Guardados juntos, um mexeria no outro sem querer — e o caso
  // clássico é filtrar estando na página 7 e receber uma tabela vazia, porque
  // o resultado novo tem duas páginas.
  const [pagina, setPagina] = useState(1)
  const [dados, setDados] = useState(null)
  const [listaProdutores, setListaProdutores] = useState([])
  const [listaMotoristas, setListaMotoristas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [erroProdutores, setErroProdutores] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [confirmacao, setConfirmacao] = useState(null)
  // A carga cujo ticket está aberto para impressão. Separado da confirmação
  // porque o ticket também é reimpresso a partir do histórico, dias depois —
  // motorista perde papel, e a via tem que poder sair de novo.
  const [ticket, setTicket] = useState(null)

  // useCallback evita recriar a função a cada renderização
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

  // A lista de produtores alimenta o filtro e o formulário de pesagem.
  useEffect(() => {
    apiProdutores
      .listar()
      .then((r) => { setListaProdutores(r.produtores); setErroProdutores(null) })
      .catch(setErroProdutores)
  }, [])

  const carregarMotoristas = useCallback(async () => {
    // Aqui o silêncio no erro é aceitável, e a diferença em relação aos
    // produtores é real: sem produtor não há pesagem, e sem motorista há —
    // o campo é opcional. Uma lista vazia significa "cadastre agora", que é
    // exatamente o que o botão ao lado oferece.
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
            {mostrarForm ? 'Fechar' : 'Registrar pesagem'}
          </Botao>
        )}
      </CabecalhoPagina>

      {/* ------------------- confirmação da pesagem gravada ------------------- */}
      {/* O número do ticket é o que o motorista leva. Ele precisa ser lido em voz
          alta, conferido e anotado — então tem de estar grande e sozinho, não
          diluído numa linha de tabela. */}
      {confirmacao && (
        <Painel
          className="mb-6"
          titulo="Pesagem registrada"
          acao={
            <span className="flex flex-wrap gap-2 xl:gap-3">
              <button
                onClick={() => setTicket(confirmacao)}
                className="font-semibold text-mate-700 hover:underline"
              >
                imprimir ticket
              </button>
              <button onClick={() => setConfirmacao(null)} className="font-semibold hover:underline">
                fechar
              </button>
            </span>
          }
        >
          <div className="flex flex-wrap items-center gap-5 bg-mate-100 px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold text-mate-700">
                Número do ticket
              </p>
              <p className="text-2xl font-bold tabular text-mate-700">{confirmacao.numeroTicket}</p>
            </div>
            <span className="h-9 w-px bg-mate-300" />
            <LinhaDado rotulo="Produtor" valor={confirmacao.produtor?.nome} />
            <LinhaDado rotulo="Peso líquido" valor={formatar.kg(confirmacao.pesoLiquidoKg)} />
            <LinhaDado rotulo="Matéria-prima" valor={formatar.materiaPrima(confirmacao.tipoMateriaPrima)} />
          </div>
        </Painel>
      )}

      {mostrarForm && (
        <FormularioPesagem
          produtores={listaProdutores}
          motoristas={listaMotoristas}
          aoCadastrarMotorista={carregarMotoristas}
          aoRegistrar={(criada) => { setMostrarForm(false); setConfirmacao(criada); buscar() }}
        />
      )}

      {/* barra de filtros — RF13 e RF14 */}
      <Filtros
        /* A busca fica FORA do painel, sempre na tela. Alguém liga
           perguntando por uma carga com o papel do ticket na mão; obrigar a
           abrir um painel antes de digitar seria um clique cobrado em toda
           ligação. Filtro se abre, busca se usa. */
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
          <option value="AGUARDANDO_ANALISE">Aguardando avaliação</option>
          <option value="ANALISADA">Analisada</option>
          <option value="EM_ORDEM_PAGAMENTO">Em ordem de pagamento</option>
          <option value="PAGA">Paga</option>
          <option value="REPROVADA">Reprovada</option>
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
            // A linha inteira abre a via do motorista. Antes havia uma coluna
            // só para isso, com a palavra "ticket" repetida em toda linha —
            // largura gasta para dizer, trinta vezes, a única coisa que dá
            // para fazer com uma linha desta tabela.
            aoClicarLinha={(c) => setTicket(c)}
            linhaAtiva={ticket?.id}
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

      {ticket && <TicketPesagem carga={ticket} aoFechar={() => setTicket(null)} />}
    </>
  )
}

// ---------------------------------------------------------------------------
// Formulário de pesagem
// ---------------------------------------------------------------------------
// O peso líquido aparece calculado enquanto o operador digita — mas quem
// calcula de verdade, e vale, é o servidor. A conta aqui é só conferência
// visual, para o operador perceber um erro de digitação antes de gravar.
//
// Os limites (min) nos campos numéricos são a primeira barreira, não a única:
// o servidor valida de novo, porque nada que chega pela rede é confiável.
// A diferença é que a barreira do navegador avisa na hora, antes do envio.

function FormularioPesagem({ produtores, motoristas, aoCadastrarMotorista, aoRegistrar }) {
  const [form, setForm] = useState({
    produtorId: '', tipoMateriaPrima: 'ERVA_MATE_NATIVA',
    motoristaId: '', veiculoId: '',
    pesoBrutoKg: '', taraKg: '', pesoEstimadoCampoKg: '',
  })
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [cadastrandoMotorista, setCadastrandoMotorista] = useState(false)

  const motorista = motoristas.find((m) => m.id === form.motoristaId)
  const veiculos = motorista?.veiculos ?? []

  const bruto = Number(form.pesoBrutoKg || 0)
  const tara = Number(form.taraKg || 0)
  const liquido = bruto - tara

  // Avisos que aparecem ANTES do envio, enquanto o operador ainda está no campo.
  // Sem isto ele descobria o problema só depois de clicar em gravar.
  const taraInvalida = form.pesoBrutoKg !== '' && form.taraKg !== '' && tara >= bruto

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  /**
   * Trocar de motorista zera o veículo e escolhe o principal dele.
   *
   * Sem isso, o operador poderia deixar selecionada a carreta do motorista
   * anterior — e a carga sairia registrada com a placa errada, que é
   * justamente o dado que a rastreabilidade promete.
   */
  function escolherMotorista(id) {
    const novo = motoristas.find((m) => m.id === id)
    const principal = novo?.veiculos?.[0]
    // A tara NÃO é preenchida a partir do cadastro do veículo: ela é medida na
    // balança, a cada entrega. Um caminhão chega com estepe, ferramenta, o
    // motorista dentro ou não — a tara guardada seria um número plausível e
    // errado, e errado num campo que multiplica direto o valor a pagar.
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
      // O 201 devolve a carga criada, com o número do ticket que o servidor
      // gerou. Este retorno sobe para a página e vira a confirmação na tela.
      const criada = await apiCargas.registrar({
        ...form,
        // Campos opcionais viajam como null e não como string vazia: o Prisma
        // recusaria "" onde espera um identificador.
        motoristaId: form.motoristaId || null,
        veiculoId: form.veiculoId || null,
        pesoBrutoKg: Number(form.pesoBrutoKg),
        taraKg: Number(form.taraKg),
        pesoEstimadoCampoKg: form.pesoEstimadoCampoKg ? Number(form.pesoEstimadoCampoKg) : null,
      })
      aoRegistrar(criada)
    } catch (e) {
      setErro(e)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Painel titulo="Nova pesagem" className="mb-6">
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

          <div className="flex items-end">
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
          <Campo rotulo="Tara (kg)" type="number" step="0.01" min="0" className="flex-1" required value={form.taraKg} onChange={(e) => alterar('taraKg', e.target.value)} />
          <Campo rotulo="Estimado em campo (kg)" type="number" step="0.01" min="0.01" className="flex-1" value={form.pesoEstimadoCampoKg} onChange={(e) => alterar('pesoEstimadoCampoKg', e.target.value)} />
        </div>

        {taraInvalida && (
          <Aviso tom="alerta">
            Tara ({formatar.kg(tara)}) maior ou igual ao peso bruto ({formatar.kg(bruto)}).
          </Aviso>
        )}

        <div className="flex items-center gap-4 rounded-[3px] bg-mate-100 px-4 py-3">
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-mate-700">Peso líquido</p>
            <p className="text-xl font-bold tabular text-mate-700">
              {liquido > 0 ? formatar.kg(liquido) : '—'}
            </p>
          </div>
          <Botao variante="primario" type="submit" disabled={enviando || taraInvalida}>
            {enviando ? 'Gravando...' : 'Registrar carga'}
          </Botao>
        </div>
      </form>
    </Painel>
  )
}

// ---------------------------------------------------------------------------
// Cadastro rápido de motorista, sem sair da balança
// ---------------------------------------------------------------------------
// Aparece DENTRO do formulário de pesagem, e isso é a decisão que importa:
// o motorista novo chega junto com a carga, com o caminhão em cima da balança
// e a fila atrás. Mandar o operador para uma tela de cadastro, e depois voltar
// e recomeçar a pesagem, é o tipo de caminho que faz as pessoas anotarem no
// papel "resolver depois" — e o depois não vem.
//
// Só três campos são pedidos, e um deles é opcional. O resto do cadastro
// (CNH, telefone) pode ser completado no escritório, sem ninguém esperando.

function NovoMotorista({ aoCriar, aoCancelar }) {
  const [dados, setDados] = useState({ nome: '', cpf: '', placa: '', tipo: '' })
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)

  // Validação enquanto digita, mas a mensagem só aparece depois que o campo
  // tem conteúdo: acusar "CPF inválido" na primeira tecla é hostil.
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
