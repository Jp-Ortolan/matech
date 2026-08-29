// ---------------------------------------------------------------------------
// GLOSSÁRIO · o vocabulário da ervateira
// ---------------------------------------------------------------------------
// As palavras que aparecem nas telas e que ninguém de fora entende de primeira:
// palito, tara, preço ajustado. Elas não são jargão de programador — são o
// vocabulário de quem trabalha no recebimento, e o sistema usa exatamente os
// mesmos termos de propósito. Traduzi-los para "categoria A" e "valor 1" faria
// o operador ter de aprender uma segunda língua para usar o próprio trabalho.
//
// Fica num arquivo de dados, e não escrito na tela, porque a mesma definição
// há de servir a mais de um lugar quando as dicas de campo chegarem.
//
// ATENÇÃO ao editar: nenhum texto daqui cita número. Os limites são
// configuráveis na régua de qualidade, logo acima nesta mesma tela, e mudam de
// ervateira para ervateira — um glossário que dissesse "30%" ficaria mentindo
// no dia em que alguém trocasse o valor.

export const GLOSSARIO = [
  {
    grupo: 'A carga',
    termos: [
      {
        termo: 'Peso bruto',
        texto: 'O que a balança marca com o caminhão carregado: veículo mais matéria-prima.',
      },
      {
        termo: 'Tara',
        texto: 'O peso do veículo vazio. É descontado do bruto porque a ervateira compra erva-mate, não caminhão.',
      },
      {
        termo: 'Peso líquido',
        texto: 'Bruto menos tara. É o peso que vale para o pagamento, e o que aparece em todos os relatórios.',
      },
      {
        termo: 'Ticket',
        texto: 'O número da pesagem, no formato PES-ano-sequência. É o que o motorista leva no papel e o que identifica a carga do começo ao fim.',
      },
      {
        termo: 'Estimativa de campo',
        texto: 'Quanto o avaliador achou que o erval renderia, antes de a carga chegar. Comparada com o peso real, ela mede se a avaliação em campo está calibrada.',
      },
    ],
  },
  {
    grupo: 'A análise',
    termos: [
      {
        termo: 'Palito',
        texto: 'A parte lenhosa que vem junto com a folha. Quanto mais palito, menos erva aproveitável na mesma carga — por isso ele gera desconto.',
      },
      {
        termo: 'Limite de palito',
        texto: 'O percentual acima do qual começa o desconto. Quem define é a ervateira, na régua de qualidade — e o valor que valia no dia fica gravado em cada análise.',
      },
      {
        termo: 'Desconto por qualidade',
        texto: 'Cada ponto percentual de palito acima do limite tira do preço a fração definida na régua. Com limite de 30% e um ponto por ponto, palito de 34% dá 4% de desconto.',
      },
      {
        termo: 'Aprovada e reprovada',
        texto: 'A decisão do laboratório sobre aceitar a carga. O sistema confere os limites da régua e avisa, mas quem decide é quem tem a amostra na mão — e quando a decisão contraria a régua, o motivo fica registrado. Reprovada não vira pagamento.',
      },
    ],
  },
  {
    grupo: 'O pagamento',
    termos: [
      {
        termo: 'Preço base',
        texto: 'O valor por quilo acordado com o produtor, antes do desconto. Ele é informado na emissão da ordem, e não na balança — quem negocia é o administrativo.',
      },
      {
        termo: 'Preço ajustado',
        texto: 'O preço base já com o desconto por qualidade aplicado. É por ele que a carga é efetivamente paga.',
      },
      {
        termo: 'Ordem de pagamento',
        texto: 'Agrupa as cargas analisadas de um produtor num período e fecha o valor a transferir. Uma carga só entra em uma ordem.',
      },
      {
        termo: 'Em aberto',
        texto: 'Ordem já emitida e ainda não paga. É o que a ervateira deve aos produtores neste momento.',
      },
    ],
  },
  {
    grupo: 'Onde a carga está',
    termos: [
      { termo: 'Em avaliação', texto: 'Pesada, esperando o laboratório.' },
      { termo: 'Analisada', texto: 'Já tem análise e está liberada para entrar numa ordem de pagamento.' },
      { termo: 'Em ordem', texto: 'Entrou numa ordem emitida, aguardando a transferência.' },
      { termo: 'Paga', texto: 'A ordem foi quitada. Fim do ciclo da carga.' },
      { termo: 'Reprovada', texto: 'Ficou fora do padrão na análise e não gera pagamento.' },
    ],
  },
]
