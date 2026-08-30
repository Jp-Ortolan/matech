// ---------------------------------------------------------------------------
// TEXTOS · limites de tamanho dos campos cadastrais
// ---------------------------------------------------------------------------
// Os mesmos números de src/lib/textos.js, no servidor, e de
// matech_app/lib/servicos/faixas.dart, no aplicativo. Três cópias porque os
// três rodam em linguagens diferentes — e cada uma cita as outras duas para
// que quem mexer numa saiba onde estão as irmãs.
//
// O maxLength do input NÃO é a garantia. Ele é o aviso que chega enquanto a
// pessoa ainda está digitando; a recusa de verdade é a do servidor, que vale
// para qualquer cliente, inclusive um que não passe por esta tela.

export const LIMITES = {
  nome: 120,
  telefone: 20,
  endereco: 160,
  bairro: 60,
  municipio: 60,
  chavePix: 77,
  titularConta: 120,
  banco: 60,
  agencia: 10,
  conta: 20,
  identificacao: 80,
  observacoes: 1000,
  motivo: 300,
}
