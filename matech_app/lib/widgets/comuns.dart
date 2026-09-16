import 'package:flutter/material.dart';

import '../modelos/operacao_pendente.dart';
import 'tema.dart';

class EtiquetaSincronizacao extends StatelessWidget {
  final String? situacao;
  const EtiquetaSincronizacao(this.situacao, {super.key});

  @override
  Widget build(BuildContext context) {
    final (texto, cor, icone) = switch (situacao) {
      OperacaoPendente.enviada => (
        'Sincronizada',
        Cores.mate700,
        Icons.cloud_done_outlined,
      ),
      OperacaoPendente.erro => (
        'Recusada',
        Cores.perigo,
        Icons.error_outline,
      ),
      OperacaoPendente.dependencia => (
        'Aguardando',
        Cores.alerta,
        Icons.hourglass_empty,
      ),
      _ => ('Pendente', Cores.cinza600, Icons.smartphone),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: cor.withValues(alpha: 0.10),
        borderRadius: raioPadrao,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icone, size: 14, color: cor),
          const SizedBox(width: 4),
          Text(
            texto,
            style: TextStyle(
              fontSize: 12,
              color: cor,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class Vazio extends StatelessWidget {
  final IconData icone;
  final String titulo;
  final String descricao;
  final Widget? acao;

  const Vazio({
    super.key,
    required this.icone,
    required this.titulo,
    required this.descricao,
    this.acao,
  });

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icone, size: 56, color: Cores.cinza400),
          const SizedBox(height: 16),
          Text(
            titulo,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            descricao,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Cores.cinza600, height: 1.4),
          ),
          if (acao != null) ...[const SizedBox(height: 24), acao!],
        ],
      ),
    ),
  );
}

class LinhaDado extends StatelessWidget {
  final String rotulo;
  final String valor;
  const LinhaDado(this.rotulo, this.valor, {super.key});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 130,
          child: Text(rotulo, style: const TextStyle(color: Cores.cinza600)),
        ),
        Expanded(
          child: Text(
            valor,
            style: const TextStyle(fontWeight: FontWeight.w500),
          ),
        ),
      ],
    ),
  );
}

void avisar(BuildContext context, String mensagem, {bool erro = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(mensagem),
        backgroundColor: erro ? Cores.perigo : null,
        behavior: SnackBarBehavior.floating,
      ),
    );
}

String formatarData(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

String formatarDataHora(DateTime d) =>
    '${formatarData(d)} às ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

String formatarKg(double? kg) =>
    kg == null
        ? '—'
        : '${kg.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]}.')} kg';

String formatarReais(double? v) =>
    v == null ? '—' : 'R\$ ${v.toStringAsFixed(2).replaceAll('.', ',')}';
