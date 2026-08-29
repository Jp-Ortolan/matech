// ---------------------------------------------------------------------------
// TELA · sincronização
// ---------------------------------------------------------------------------
// A tela que torna o diferencial do trabalho VISÍVEL. Sem ela, a fila é uma
// abstração: o avaliador não teria como saber o que já está a salvo e o que
// ainda mora só no bolso dele — e "sincroniza sozinho" viraria um ato de fé.
//
// Ela mostra o mesmo indicador que o servidor calcula em
// GET /api/sincronizacao/resumo (a taxa do Quadro 7), só que do lado do
// aparelho. As duas contas batendo é, aliás, a melhor evidência de que a
// sincronização está correta — e uma demonstração possível para a banca.
//
// O VOCABULÁRIO DAS QUATRO SITUAÇÕES é escolhido para ser lido por quem não
// programa, porque quem lê esta tela é o avaliador:
//
//   No aparelho   ainda não subiu. É o estado normal no meio do erval.
//   Aguardando    depende de algo que ainda não chegou lá. Resolve sozinho.
//   No servidor   confirmado, nominalmente, pelo servidor.
//   Recusado      o servidor disse não. Insistir não conserta — precisa de
//                 uma pessoa.

import 'package:flutter/material.dart';

import '../dados/fila_dao.dart';
import '../modelos/operacao_pendente.dart';
import '../servicos/sessao.dart';
import '../servicos/sincronizador.dart';
import '../widgets/comuns.dart';

class TelaSincronizacao extends StatefulWidget {
  const TelaSincronizacao({super.key});

  @override
  State<TelaSincronizacao> createState() => _TelaSincronizacaoState();
}

class _TelaSincronizacaoState extends State<TelaSincronizacao> {
  List<OperacaoPendente> _operacoes = const [];

  @override
  void initState() {
    super.initState();
    _carregar();
    sincronizador.addListener(_carregar);
  }

  @override
  void dispose() {
    sincronizador.removeListener(_carregar);
    super.dispose();
  }

  Future<void> _carregar() async {
    final lista = await FilaDao.todas();
    if (mounted) setState(() => _operacoes = lista);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: sincronizador,
      builder:
          (context, _) => RefreshIndicator(
            onRefresh: () async {
              await sincronizador.sincronizar();
              await _carregar();
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                const _Placar(),
                const SizedBox(height: 16),

                FilledButton.icon(
                  onPressed:
                      sincronizador.rodando
                          ? null
                          : () => sincronizador.sincronizar(),
                  icon:
                      sincronizador.rodando
                          ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                          : const Icon(Icons.cloud_upload_outlined),
                  label: Text(
                    sincronizador.rodando ? 'Enviando...' : 'Sincronizar agora',
                  ),
                ),

                // Só aparece quando há o que reativar. Um botão de "tentar todas"
                // permanentemente visível convidaria a apertá-lo sem motivo.
                if (sincronizador.comErro > 0) ...[
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed:
                        sincronizador.rodando
                            ? null
                            : () => sincronizador.tentarTodasDeNovo(),
                    icon: const Icon(Icons.replay),
                    label: Text(
                      'Tentar de novo as ${sincronizador.comErro} recusadas',
                    ),
                  ),
                ],

                if (sincronizador.ultimaMensagem != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.04),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.info_outline,
                          size: 18,
                          color: Colors.black45,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            sincronizador.ultimaMensagem!,
                            style: const TextStyle(fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 12),

                // A promessa "sobe sozinho" precisa ser verificável. Sem esta
                // linha, o avaliador teria que acreditar; com ela, ele vê a hora.
                if (sincronizador.proximoDespertar != null)
                  Row(
                    children: [
                      const Icon(
                        Icons.schedule,
                        size: 14,
                        color: Colors.black38,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Próxima tentativa automática às '
                          '${_hora(sincronizador.proximoDespertar!)}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.black54,
                          ),
                        ),
                      ),
                    ],
                  )
                else if (sincronizador.pendentes == 0 &&
                    sincronizador.comErro == 0)
                  const Row(
                    children: [
                      Icon(
                        Icons.check_circle_outline,
                        size: 14,
                        color: Colors.black38,
                      ),
                      SizedBox(width: 6),
                      Text(
                        'Tudo que foi coletado já está no servidor.',
                        style: TextStyle(fontSize: 12, color: Colors.black54),
                      ),
                    ],
                  ),

                const SizedBox(height: 8),
                Text(
                  'Aparelho ${sessao.dispositivoId}'
                  '${sincronizador.ultimaTentativa == null ? "" : " · última tentativa às ${_hora(sincronizador.ultimaTentativa!)}"}',
                  style: const TextStyle(fontSize: 11, color: Colors.black38),
                ),

                const SizedBox(height: 24),
                const Text(
                  'FILA',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                    color: Colors.black45,
                  ),
                ),
                const SizedBox(height: 8),

                if (_operacoes.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Vazio(
                      icone: Icons.inbox_outlined,
                      titulo: 'Fila vazia',
                      descricao: 'Nada foi coletado neste aparelho ainda.',
                    ),
                  )
                else
                  ..._operacoes.map(
                    (o) => _LinhaDaFila(
                      operacao: o,
                      aoReativar: () async {
                        await FilaDao.reativar(o.clientId);
                        await sincronizador.sincronizar();
                      },
                    ),
                  ),
              ],
            ),
          ),
    );
  }

  static String _hora(DateTime d) =>
      '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

class _Placar extends StatelessWidget {
  const _Placar();

  @override
  Widget build(BuildContext context) {
    final taxa = sincronizador.taxaSincronizacao;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _Numero(
                  '${sincronizador.pendentes}',
                  'na fila',
                  Colors.orange.shade800,
                ),
                _Numero(
                  '${sincronizador.enviadas}',
                  'no servidor',
                  Colors.green.shade700,
                ),
                _Numero(
                  '${sincronizador.comErro}',
                  'recusados',
                  Colors.red.shade700,
                ),
              ],
            ),
            if (taxa != null) ...[
              const Divider(height: 32),
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Taxa de sincronização',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                  Text(
                    '${taxa.toStringAsFixed(1)}%',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: taxa / 100,
                  minHeight: 8,
                  backgroundColor: Colors.black12,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'confirmados ÷ coletados',
                style: TextStyle(fontSize: 11, color: Colors.black45),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Numero extends StatelessWidget {
  final String valor;
  final String rotulo;
  final Color cor;
  const _Numero(this.valor, this.rotulo, this.cor);

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(
        valor,
        style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: cor),
      ),
      Text(rotulo, style: const TextStyle(fontSize: 12, color: Colors.black54)),
    ],
  );
}

class _LinhaDaFila extends StatelessWidget {
  final OperacaoPendente operacao;
  final VoidCallback aoReativar;
  const _LinhaDaFila({required this.operacao, required this.aoReativar});

  static const _rotuloEntidade = {
    'Produtor': 'Produtor',
    'Erval': 'Área de colheita',
    'Avaliacao': 'Avaliação',
    'FotoErval': 'Foto',
  };

  @override
  Widget build(BuildContext context) {
    final recusada = operacao.situacao == OperacaoPendente.erro;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    _rotuloEntidade[operacao.entidade] ?? operacao.entidade,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                EtiquetaSincronizacao(operacao.situacao),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Criado em ${formatarDataHora(operacao.criadoEmOrigem)}'
              '${operacao.tentativas > 0 ? " · ${operacao.tentativas} ${operacao.tentativas == 1 ? "tentativa" : "tentativas"}" : ""}',
              style: const TextStyle(fontSize: 12, color: Colors.black54),
            ),
            if (operacao.ultimoErro != null) ...[
              const SizedBox(height: 8),
              Text(
                operacao.ultimoErro!,
                style: TextStyle(
                  fontSize: 12,
                  color:
                      recusada ? Colors.red.shade800 : Colors.orange.shade900,
                ),
              ),
            ],
            if (recusada) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: aoReativar,
                  icon: const Icon(Icons.refresh, size: 18),
                  label: const Text('Tentar de novo'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
