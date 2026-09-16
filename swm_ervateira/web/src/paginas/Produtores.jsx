import { useEffect, useState, useCallback } from 'react'
import { produtores as apiProdutores, cargas as apiCargas } from '../api/recursos'
import { consultarCep, consultarCnpj } from '../lib/consultas'
import { LIMITES } from '../lib/textos'
import {
  apenasDigitos, erroNoDocumento,
  mascararDocumento, mascararCep, mascararTelefone,
} from '../lib/documentos'
import { useAutenticacao } from '../contexto/Autenticacao'
import { CabecalhoPagina } from '../componentes/Layout'
import {
  Painel, Filtros, Tabela, Janela, Situacao, Campo, Selecao, Botao,
  Carregando, Erro, Sucesso, Vazio, Etiqueta, LinhaDado, Aviso
} from '../componentes/ui'
import { formatar } from '../lib/formatar'
import { ICONE_DA_ACAO } from '../lib/icones'

export default function Produtores() {
  const { podeFazer } = useAutenticacao()
  const podeCadastrar = podeFazer('COMPRADOR_AVALIADOR')

  const [busca, setBusca] = useState('')
  const [lista, setLista] = useState([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [aviso, setAviso] = useState('')

  const [selecionadoId, setSelecionadoId] = useState(null)
  const [formulario, setFormulario] = useState(null)   // null | 'novo' | produtor em edição

  const buscar = useCallback(async (termo) => {
    setCarregando(true)
    setErro(null)
    try {
      const r = await apiProdutores.listar(termo)
      setLista(r.produtores)
      setTotal(r.total)
      setSelecionadoId((atual) =>
        r.produtores.some((p) => p.id === atual) ? atual : r.produtores[0]?.id ?? null
      )
    } catch (e) {
      setErro(e)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    const relogio = setTimeout(() => buscar(busca), 350)
    return () => clearTimeout(relogio)
  }, [busca, buscar])

  function aoSalvar(mensagem) {
    setFormulario(null)
    setAviso(mensagem)
    buscar(busca)
  }

  return (
    <>
      <CabecalhoPagina titulo="Produtores">
        {podeCadastrar && (
          <Botao
            variante="primario"
            onClick={() => { setAviso(''); setFormulario((f) => (f === 'novo' ? null : 'novo')) }}
            icone={formulario === 'novo' ? ICONE_DA_ACAO.limpar : ICONE_DA_ACAO.registrar}
          >
            {formulario === 'novo' ? 'Fechar' : 'Novo produtor'}
          </Botao>
        )}
      </CabecalhoPagina>

      <Filtros
        busca={(
          <Campo
            rotulo="Buscar por nome ou CPF/CNPJ"
            className="min-w-[240px] flex-1 max-w-[360px]"
            placeholder="José Fontana ou 012.345.678-90"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        )}
      />

      {formulario && (
        <FormularioProdutor
          key={formulario === 'novo' ? 'novo' : formulario.id}
          produtor={formulario === 'novo' ? null : formulario}
          aoSalvar={aoSalvar}
          aoCancelar={() => setFormulario(null)}
        />
      )}

      {aviso && <div className="mb-3"><Sucesso texto={aviso} /></div>}
      <Erro erro={erro} />

      <Painel
          titulo="Produtores"
          acao={carregando ? 'buscando...' : `${lista.length} de ${total}`}
        >
          {carregando ? (
            <Carregando />
          ) : (
            <Tabela
              colunas={[
                {
                  chave: 'nome', titulo: 'Produtor', forte: true,
                  render: (p) => (
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 max-w-[220px] truncate" title={p.nome}>{p.nome}</span>
                      {p.criadoOffline && <Etiqueta tom="verde">cadastrado em campo</Etiqueta>}
                    </span>
                  ),
                },
                {
                  chave: 'cpfCnpj', titulo: 'CPF / CNPJ',
                  render: (p) => <span className="tabular">{formatar.documento(p.cpfCnpj)}</span>,
                },
                { chave: 'municipio', titulo: 'Município', truncar: 150, oculta: 'lg', render: (p) => (p.municipio ? `${p.municipio}${p.uf ? `/${p.uf}` : ''}` : '—') },
                { chave: 'cargas', titulo: 'Cargas', alinhar: 'direita', forte: true, render: (p) => p._count?.cargas ?? 0 },
              ]}
              dados={lista}
              aoClicarLinha={(p) => { setSelecionadoId(p.id); setAviso('') }}
              linhaAtiva={selecionadoId}
              vazio={busca ? `Nenhum produtor encontrado para "${busca}".` : 'Nenhum produtor cadastrado ainda.'}
            />
          )}
      </Painel>

      {selecionadoId && (
        <Janela
          titulo={lista.find((p) => p.id === selecionadoId)?.nome || 'Ficha do produtor'}
          subtitulo="Cadastro, dados de pagamento, ervais e últimas cargas"
          aoFechar={() => setSelecionadoId(null)}
        >
          <FichaDoProdutor
            key={selecionadoId}
            produtorId={selecionadoId}
            podeEditar={podeCadastrar}
            aoEditar={(p) => { setAviso(''); setSelecionadoId(null); setFormulario(p) }}
          />
        </Janela>
      )}
    </>
  )
}

function FichaDoProdutor({ produtorId, podeEditar, aoEditar }) {
  const [produtor, setProdutor] = useState(null)
  const [cargas, setCargas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro(null)

    Promise.all([
      apiProdutores.buscar(produtorId),
      apiCargas.listar({ produtorId, porPagina: 5 }),
    ])
      .then(([p, c]) => {
        if (!ativo) return
        setProdutor(p)
        setCargas(c.cargas)
      })
      .catch((e) => { if (ativo) setErro(e) })
      .finally(() => { if (ativo) setCarregando(false) })

    return () => { ativo = false }
  }, [produtorId])

  if (carregando) return <Painel titulo="Ficha do produtor"><Carregando /></Painel>
  if (erro) return <Painel titulo="Ficha do produtor"><div className="px-4 py-4"><Erro erro={erro} /></div></Painel>
  if (!produtor) return <Painel titulo="Ficha do produtor"><Vazio /></Painel>

  const pix = produtor.formaPagamento === 'PIX'
  const conta = produtor.formaPagamento === 'CONTA_BANCARIA'

  return (
    <Painel
      titulo={produtor.nome}
      acao={podeEditar ? (
        <button onClick={() => aoEditar(produtor)} className="font-semibold hover:underline">
          editar cadastro
        </button>
      ) : 'somente leitura'}
    >
      <div className="flex flex-col gap-4 px-4 py-4">
        {produtor.criadoOffline && (
          <div className="flex items-center gap-2 rounded-[3px] bg-mate-100 px-3 py-2">
            <Etiqueta tom="verde">cadastrado em campo</Etiqueta>
            <span className="text-[10.5px] text-mate-700">
              enviado pelo aplicativo em {formatar.dataHora(produtor.sincronizadoEm)}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <LinhaDado rotulo="CPF / CNPJ" valor={formatar.documento(produtor.cpfCnpj)} />
          <LinhaDado rotulo="Telefone" valor={produtor.telefone} />
          <LinhaDado rotulo="Município" valor={produtor.municipio ? `${produtor.municipio}${produtor.uf ? `/${produtor.uf}` : ''}` : null} />
          <LinhaDado rotulo="Cadastrado em" valor={formatar.data(produtor.criadoEm)} />
          <LinhaDado rotulo="Endereço" valor={[produtor.endereco, produtor.bairro].filter(Boolean).join(' · ') || null} className="col-span-2" />
        </div>

        <div className="rounded-[3px] border border-borda">
          <p className="border-b border-borda bg-cabecalho px-3 py-2 text-[11px] font-semibold text-cinza-600">
            Dados de pagamento
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-3 py-3">
            <LinhaDado rotulo="Forma" valor={formatar.formaPagamento(produtor.formaPagamento)} />
            <LinhaDado rotulo="Titular" valor={produtor.titularConta} />
            {pix && (
              <>
                <LinhaDado rotulo="Tipo da chave" valor={formatar.chavePix(produtor.tipoChavePix)} />
                <LinhaDado rotulo="Chave Pix" valor={produtor.chavePix} />
              </>
            )}
            {conta && (
              <>
                <LinhaDado rotulo="Banco" valor={produtor.banco} />
                <LinhaDado rotulo="Tipo de conta" valor={formatar.tipoConta(produtor.tipoConta)} />
                <LinhaDado rotulo="Agência / conta" valor={produtor.agencia || produtor.conta ? `${produtor.agencia || '—'} / ${produtor.conta || '—'}` : null} className="col-span-2" />
              </>
            )}
            {!pix && !conta && (
              <p className="col-span-2 text-[10.5px] text-cinza-600">
                Sem destino bancário guardado.
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold text-cinza-600">
            Ervais · {produtor.ervais?.length ?? 0}
          </p>
          {produtor.ervais?.length ? (
            <div className="flex flex-col gap-2">
              {produtor.ervais.map((e) => (
                <div key={e.id} className="rounded-[3px] border border-borda px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-[11.5px] font-semibold text-tinta">{e.identificacao}</span>
                    <Etiqueta>{formatar.tipoErva(e.tipoErva)}</Etiqueta>
                  </div>
                  <p className="mt-1 text-[10.5px] text-cinza-600">
                    {formatar.kg(e.quantidadeEstimadaKg)} estimados
                    {e.idadeAnos ? ` · erval de ${e.idadeAnos} anos` : ''}
                    {e.latitude && e.longitude
                      ? ` · ${Number(e.latitude).toFixed(4)}, ${Number(e.longitude).toFixed(4)}`
                      : ' · sem coordenada registrada'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-[3px] border border-dashed border-borda px-3 py-3 text-center text-[11px] text-cinza-400">
              Nenhum erval vinculado.
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold text-cinza-600">
            Últimas cargas
          </p>
          {cargas.length ? (
            <div className="rounded-[3px] border border-borda">
              {cargas.map((c, i) => (
                <div key={c.id} className={`flex items-center gap-2 px-3 py-2 ${i ? 'border-t border-borda' : ''}`}>
                  <span className="w-[92px] shrink-0 text-[11px] font-semibold text-tinta">{c.numeroTicket}</span>
                  <span className="min-w-0 flex-1 truncate text-[10.5px] text-cinza-600">
                    {formatar.data(c.dataHora)} · {formatar.materiaPrima(c.tipoMateriaPrima)}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular text-tinta">
                    {formatar.kg(c.pesoLiquidoKg)}
                  </span>
                  <span className="w-[104px] shrink-0 text-right"><Situacao valor={c.situacao} /></span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-[3px] border border-dashed border-borda px-3 py-4 text-center text-[11px] text-cinza-400">
              Nenhuma carga entregue.
            </p>
          )}
        </div>

        {produtor.ordensPagamento && (
        <div>
          <p className="mb-2 text-[11px] font-semibold text-cinza-600">
            Últimas ordens de pagamento
          </p>
          {produtor.ordensPagamento.length ? (
            <div className="rounded-[3px] border border-borda">
              {produtor.ordensPagamento.map((o, i) => (
                <div key={o.id} className={`flex items-center gap-2 px-3 py-2 ${i ? 'border-t border-borda' : ''}`}>
                  <span className="w-[92px] shrink-0 text-[11px] font-semibold text-tinta">{o.numero}</span>
                  <span className="min-w-0 flex-1 truncate text-[10.5px] text-cinza-600">
                    {formatar.data(o.periodoInicio)} a {formatar.data(o.periodoFim)}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular text-tinta">
                    {formatar.reais(o.valorTotal)}
                  </span>
                  <span className="w-[104px] shrink-0 text-right"><Situacao valor={o.situacao} /></span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-[3px] border border-dashed border-borda px-3 py-4 text-center text-[11px] text-cinza-400">
              Nenhuma ordem emitida.
            </p>
          )}
        </div>
        )}
      </div>
    </Painel>
  )
}

const FORM_VAZIO = {
  nome: '', cpfCnpj: '', telefone: '',
  cep: '', endereco: '', bairro: '', municipio: '', uf: '',
  formaPagamento: 'PIX', tipoChavePix: 'CPF', chavePix: '', titularConta: '',
  banco: '', agencia: '', conta: '', tipoConta: 'CORRENTE',
}

const FORMAS_DE_PAGAMENTO = [
  { valor: 'PIX', rotulo: 'Pix' },
  { valor: 'CONTA_BANCARIA', rotulo: 'Conta bancária' },
  { valor: 'DINHEIRO', rotulo: 'Dinheiro' },
]

const TIPOS_DE_CHAVE = [
  { valor: 'CPF', rotulo: 'CPF' },
  { valor: 'TELEFONE', rotulo: 'Telefone' },
  { valor: 'EMAIL', rotulo: 'E-mail' },
  { valor: 'ALEATORIA', rotulo: 'Chave aleatória' },
]

function FormularioProdutor({ produtor, aoSalvar, aoCancelar }) {
  const editando = Boolean(produtor)

  const [form, setForm] = useState(() =>
    produtor
      ? Object.fromEntries(
          Object.keys(FORM_VAZIO).map((c) => [c, produtor[c] ?? FORM_VAZIO[c]])
        )
      : FORM_VAZIO
  )
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [buscando, setBuscando] = useState(null)   // 'cep' | 'cnpj' | null
  const [achado, setAchado] = useState(null)       // aviso do que foi preenchido

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function buscarCep() {
    const digitos = apenasDigitos(form.cep)
    if (digitos.length !== 8) return

    setBuscando('cep')
    const dados = await consultarCep(digitos)
    setBuscando(null)

    if (!dados) {
      setAchado({ tom: 'alerta', texto: 'CEP não encontrado. Preencha o endereço à mão.' })
      return
    }
    setForm((f) => ({
      ...f,
      endereco: dados.endereco || f.endereco,
      bairro: dados.bairro || f.bairro,
      municipio: dados.municipio || f.municipio,
      uf: dados.uf || f.uf,
    }))
    setAchado({ tom: 'verde', texto: `Endereço preenchido: ${dados.municipio} · ${dados.uf}` })
  }

  async function buscarCnpj() {
    const digitos = apenasDigitos(form.cpfCnpj)
    if (digitos.length !== 14) return

    setBuscando('cnpj')
    const dados = await consultarCnpj(digitos)
    setBuscando(null)

    if (!dados) {
      setAchado({ tom: 'alerta', texto: 'CNPJ não encontrado na Receita. Preencha à mão.' })
      return
    }
    setForm((f) => ({
      ...f,
      nome: f.nome || dados.nome,
      telefone: f.telefone || dados.telefone,
      cep: f.cep || dados.cep,
      endereco: f.endereco || dados.endereco,
      bairro: f.bairro || dados.bairro,
      municipio: f.municipio || dados.municipio,
      uf: f.uf || dados.uf,
    }))
    setAchado({
      tom: dados.situacao && dados.situacao !== 'ATIVA' ? 'alerta' : 'verde',
      texto: `${dados.razaoSocial}${dados.situacao ? ` · situação ${dados.situacao.toLowerCase()}` : ''}`,
    })
  }

  async function enviar(e) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const ehPix = form.formaPagamento === 'PIX'
      const ehConta = form.formaPagamento === 'CONTA_BANCARIA'

      const dados = {
        ...form,
        cpfCnpj: apenasDigitos(form.cpfCnpj),
        cep: apenasDigitos(form.cep),
        telefone: form.telefone,
        uf: form.uf ? form.uf.toUpperCase().slice(0, 2) : '',
        tipoChavePix: ehPix ? form.tipoChavePix : '',
        chavePix: ehPix ? form.chavePix : '',
        banco: ehConta ? form.banco : '',
        agencia: ehConta ? form.agencia : '',
        conta: ehConta ? form.conta : '',
        tipoConta: ehConta ? form.tipoConta : '',
      }

      if (editando) {
        await apiProdutores.atualizar(produtor.id, dados)
        aoSalvar(`Cadastro de ${form.nome} atualizado.`)
      } else {
        await apiProdutores.criar(dados)
        aoSalvar(`Produtor ${form.nome} cadastrado.`)
      }
    } catch (e) {
      setErro(e)
    } finally {
      setEnviando(false)
    }
  }

  const ehPix = form.formaPagamento === 'PIX'
  const ehConta = form.formaPagamento === 'CONTA_BANCARIA'
  const ehDinheiro = form.formaPagamento === 'DINHEIRO'
  const ehCnpj = apenasDigitos(form.cpfCnpj).length === 14

  const digitos = apenasDigitos(form.cpfCnpj).length
  const erroDocumento = digitos === 11 || digitos === 14 ? erroNoDocumento(form.cpfCnpj) : null

  return (
    <Painel
      titulo={editando ? `Editar · ${produtor.nome}` : 'Novo produtor'}
      className="mb-6"
    >
      <form onSubmit={enviar} className="flex flex-col gap-3 px-4 py-4">
        <Erro erro={erro} />

        <Secao titulo="Identificação" />

        <div className="flex flex-wrap items-end gap-2 xl:gap-3">
          <Campo
            rotulo="CPF / CNPJ *"
            className="flex-1"
            inputMode="numeric"
            required
            value={mascararDocumento(form.cpfCnpj)}
            onChange={(e) => alterar('cpfCnpj', e.target.value)}
            onBlur={ehCnpj ? buscarCnpj : undefined}
          />
          {ehCnpj && (
            <Botao type="button" onClick={buscarCnpj} disabled={buscando === 'cnpj'} icone={ICONE_DA_ACAO.buscar}>
              {buscando === 'cnpj' ? 'Buscando...' : 'Buscar na Receita'}
            </Botao>
          )}
          <Campo rotulo="Nome *" className="flex-[2]" required maxLength={LIMITES.nome} value={form.nome} onChange={(e) => alterar('nome', e.target.value)} />
          <Campo
            rotulo="Telefone"
            className="flex-1"
            inputMode="numeric"
            maxLength={LIMITES.telefone}
            value={mascararTelefone(form.telefone)}
            onChange={(e) => alterar('telefone', e.target.value)}
          />
        </div>

        {erroDocumento && (
          <p className="text-[10.5px] font-medium text-perigo">{erroDocumento}</p>
        )}

        <Secao titulo="Endereço" />

        <div className="flex flex-wrap items-end gap-2 xl:gap-3">
          <Campo
            rotulo="CEP"
            className="min-w-[110px] max-w-[140px] flex-1"
            inputMode="numeric"
            value={mascararCep(form.cep)}
            onChange={(e) => alterar('cep', e.target.value)}
            onBlur={buscarCep}
          />
          <Botao type="button" onClick={buscarCep} disabled={buscando === 'cep' || apenasDigitos(form.cep).length !== 8} icone={ICONE_DA_ACAO.buscar}>
            {buscando === 'cep' ? 'Buscando...' : 'Buscar CEP'}
          </Botao>
          <Campo rotulo="Endereço" className="flex-[2]" maxLength={LIMITES.endereco} value={form.endereco} onChange={(e) => alterar('endereco', e.target.value)} />
          <Campo rotulo="Bairro" className="flex-1" maxLength={LIMITES.bairro} value={form.bairro} onChange={(e) => alterar('bairro', e.target.value)} />
          <Campo rotulo="Município" className="flex-1" maxLength={LIMITES.municipio} value={form.municipio} onChange={(e) => alterar('municipio', e.target.value)} />
          <Campo rotulo="UF" className="min-w-[76px] max-w-[96px] flex-1" maxLength={2} value={form.uf} onChange={(e) => alterar('uf', e.target.value)} />
        </div>

        {achado && <Aviso tom={achado.tom}>{achado.texto}</Aviso>}

        <Secao titulo="Como este produtor recebe" />

        <div className="flex flex-wrap gap-1.5">
          {FORMAS_DE_PAGAMENTO.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => alterar('formaPagamento', f.valor)}
              className={`rounded-[2px] border px-3 py-1.5 text-[11px] font-semibold ${
                form.formaPagamento === f.valor
                  ? 'border-mate-700 bg-mate-700 text-white'
                  : 'border-borda bg-white text-cinza-600 hover:border-mate-500'
              }`}
            >
              {f.rotulo}
            </button>
          ))}
        </div>

        {ehPix && (
          <div className="flex flex-wrap gap-2 xl:gap-3">
            <Selecao rotulo="Tipo da chave" className="flex-1" value={form.tipoChavePix} onChange={(e) => alterar('tipoChavePix', e.target.value)}>
              {TIPOS_DE_CHAVE.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
            </Selecao>
            <Campo
              rotulo="Chave Pix *"
              className="flex-[2]"
              maxLength={LIMITES.chavePix}
              value={form.chavePix}
              onChange={(e) => alterar('chavePix', e.target.value)}
              placeholder={
                { CPF: 'Só os números do CPF', TELEFONE: 'Com DDD', EMAIL: 'nome@dominio.com', ALEATORIA: 'A chave gerada pelo banco' }[form.tipoChavePix]
              }
            />
            <Campo rotulo="Titular da chave" className="flex-[2]" maxLength={LIMITES.titularConta} value={form.titularConta} onChange={(e) => alterar('titularConta', e.target.value)} />
          </div>
        )}

        {ehConta && (
          <div className="flex flex-wrap gap-2 xl:gap-3">
            <Campo rotulo="Banco *" className="flex-1" maxLength={LIMITES.banco} value={form.banco} onChange={(e) => alterar('banco', e.target.value)} />
            <Campo rotulo="Agência *" className="flex-1" inputMode="numeric" maxLength={LIMITES.agencia} value={form.agencia} onChange={(e) => alterar('agencia', e.target.value)} />
            <Campo rotulo="Conta *" className="flex-1" inputMode="numeric" maxLength={LIMITES.conta} value={form.conta} onChange={(e) => alterar('conta', e.target.value)} />
            <Selecao rotulo="Tipo de conta *" className="flex-1" value={form.tipoConta} onChange={(e) => alterar('tipoConta', e.target.value)}>
              <option value="CORRENTE">Corrente</option>
              <option value="POUPANCA">Poupança</option>
            </Selecao>
            <Campo rotulo="Titular da conta" className="flex-[2]" maxLength={LIMITES.titularConta} value={form.titularConta} onChange={(e) => alterar('titularConta', e.target.value)} />
          </div>
        )}

        {ehDinheiro && (
          <Aviso tom="alerta">
            Pagamento em espécie: a ordem sai sem destino bancário.
          </Aviso>
        )}

        <div className="flex items-center justify-end gap-2">
          <Botao type="button" onClick={aoCancelar}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={enviando || Boolean(erroDocumento)}>
            {enviando ? 'Gravando...' : editando ? 'Salvar alterações' : 'Cadastrar produtor'}
          </Botao>
        </div>
      </form>
    </Painel>
  )
}

function Secao({ titulo }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="text-[11px] font-semiboldr text-cinza-400">
        {titulo}
      </span>
      <span className="h-px flex-1 bg-borda" />
    </div>
  )
}
