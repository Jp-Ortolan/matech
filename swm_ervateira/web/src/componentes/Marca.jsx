// ---------------------------------------------------------------------------
// MARCA · o símbolo do MATECH
// ---------------------------------------------------------------------------
// A engrenagem com a coroa de folhas, o anel de corda e o M ao centro.
//
// DUAS PEÇAS, E NÃO UMA IMAGEM SÓ
//
// A marca chegou como um PNG único. Girar aquele arquivo giraria o M junto,
// que é o contrário do que se quer: engrenagem gira, letra não. Então o
// arquivo foi cortado em dois, num raio medido na própria corda:
//
//   matech-anel-*.png   engrenagem, coroa de folhas e corda   → gira
//   matech-miolo-*.png  o M e a folha central                 → fica parado
//
// O corte é invisível porque o miolo do anel já era transparente no original:
// não há emenda para aparecer. As duas peças são quadradas e do mesmo tamanho,
// então basta empilhá-las na mesma caixa para a marca se remontar sozinha.
//
// QUANDO GIRA, E POR QUÊ NÃO GIRA SEMPRE
//
// No login gira devagar o tempo todo: é tela de espera, e ali o movimento é
// bem-vindo. No resto do sistema gira só enquanto uma tela carrega — e aí o
// movimento passa a QUERER DIZER alguma coisa: engrenagem girando é o sistema
// trabalhando, engrenagem parada é o sistema pronto.
//
// Movimento periférico constante numa tela de operação cansa quem passa oito
// horas ali, e é a primeira coisa que a pessoa pede para desligar.
//
// SOBRE FUNDO ESCURO
//
// A marca perdeu a herança de cor que o símbolo geométrico anterior tinha. O
// corpo da engrenagem é verde-escuro, quase o mesmo #0e2418 do menu — sobre
// aquele fundo a engrenagem e o M somem, e sobram as folhas soltas no escuro.
// Daí a placa clara do `sobreEscuro`, no verde-lavado da própria paleta.
//
// A placa é REDONDA, e isso foi decidido comparando as duas sobre o fundo do
// menu: a quadrada lê como um adesivo colado atrás da marca, porque discorda
// da geometria dela. A redonda acompanha a engrenagem e desaparece como forma
// — fica só o clareamento, que é para o que ela serve.
//
// SOBRE O TAMANHO
//
// 24 pixels não bastam: a coroa tem dezesseis folhas e o miolo tem uma letra.
// Abaixo de uns 30 pixels tudo isso vira uma mancha verde.

export default function Marca({
  className = '',
  estilo,
  sobreEscuro = false,
  paraImpressao = false,
  girando = false,
  titulo = 'MATECH',
}) {
  // O arquivo grande só no papel. Na tela ele seria 71 KB para desenhar 34
  // pixels — e a impressão é o único lugar onde a diferença aparece.
  const tamanho = paraImpressao ? 1024 : 512

  const desenho = (
    <span className="relative block h-full w-full" role="img" aria-label={titulo}>
      <img
        src={`/matech-anel-${tamanho}.png`}
        alt=""
        aria-hidden="true"
        draggable="false"
        className={`absolute inset-0 h-full w-full ${girando ? 'marca-girando' : ''}`}
      />
      <img
        src={`/matech-miolo-${tamanho}.png`}
        alt=""
        aria-hidden="true"
        draggable="false"
        className="absolute inset-0 h-full w-full"
      />
    </span>
  )

  if (!sobreEscuro) {
    return <span className={`block shrink-0 ${className}`} style={estilo}>{desenho}</span>
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-mate-100 p-[2px] ${className}`}
      style={estilo}
    >
      {desenho}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Lockup: a marca no lugar da letra M
// ---------------------------------------------------------------------------
// A marca JÁ TEM um M dentro. Escrever "MATECH" ao lado dela repete a letra
// duas vezes, a um centímetro de distância. O lockup resolve lendo a marca
// como o M da palavra: o símbolo, e depois "atech".
//
// O alinhamento é pela linha de base do texto, e não pelo centro da caixa: a
// marca é um círculo, e círculo alinhado pelo centro parece estar subindo ao
// lado de letras minúsculas. O `translate-y` é o ajuste óptico disso.

export function MarcaEscrita({ tamanho = 56, className = '', girando = false, sobreEscuro = false }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      {/* A caixa da marca vem por estilo, e não por classe do Tailwind, para o
          lockup funcionar em qualquer tamanho sem precisar de uma classe nova
          a cada uso. */}
      <Marca
        girando={girando}
        sobreEscuro={sobreEscuro}
        estilo={{ width: tamanho, height: tamanho }}
      />
      <span
        aria-hidden="true"
        style={{ fontSize: tamanho * 0.55, marginLeft: tamanho * 0.09 }}
        className="font-bold leading-none tracking-[0.06em]"
      >
        atech
      </span>
    </span>
  )
}
