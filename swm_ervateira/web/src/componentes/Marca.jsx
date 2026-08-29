// ---------------------------------------------------------------------------
// MARCA · o símbolo do MATECH
// ---------------------------------------------------------------------------
// A engrenagem com a coroa de folhas, o anel de corda e o M ao centro. É o
// arquivo de marca do projeto, em public/matech-marca-512.png para tela e
// public/matech-marca-1024.png para papel.
//
// POR QUE DEIXOU DE SER UM SVG DESENHADO NO CÓDIGO:
//
// A versão anterior era um traçado geométrico que herdava a cor do texto —
// branco no menu escuro, verde no ticket. Prático, e limitado a isso: uma
// marca de uma cor só. A marca de verdade tem sombra nas folhas, gradiente na
// corda e um M vazado, e nada disso se escreve como `fill="currentColor"`.
//
// O QUE ISSO CUSTOU, e como está resolvido:
//
// Perdeu-se a herança de cor, e ela existia por um motivo real. O corpo da
// engrenagem é verde-escuro, quase o mesmo #0e2418 do menu — sobre aquele
// fundo, a engrenagem e o M somem, e sobram as folhas soltas no escuro.
//
// Daí o `sobreEscuro`: em fundo escuro a marca vai sobre uma placa clara, no
// verde-lavado da própria paleta. Não é o retângulo branco que o SVG antigo
// evitava; é a mesma cor que o sistema já usa como fundo de destaque, com
// canto arredondado, e serve para o M aparecer. Em fundo claro a marca vai
// nua, que é como ela foi desenhada.
//
// SOBRE O TAMANHO: 24 pixels não bastam para este desenho. A coroa tem
// dezesseis folhas e o miolo tem uma letra; abaixo de uns 30 pixels tudo isso
// vira uma mancha verde. Por isso o menu passou a reservar 34.

export default function Marca({
  className = '',
  sobreEscuro = false,
  paraImpressao = false,
  titulo = 'MATECH',
}) {
  // O arquivo grande só no papel. Na tela ele seria 87 KB para desenhar 34
  // pixels — e a impressão é o único lugar onde a diferença aparece.
  const arquivo = paraImpressao ? '/matech-marca-1024.png' : '/matech-marca-512.png'

  const marca = (
    <img
      src={arquivo}
      alt={titulo}
      className={sobreEscuro ? 'h-full w-full' : className}
      draggable="false"
    />
  )

  if (!sobreEscuro) return marca

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[4px] bg-mate-100 p-[3px] ${className}`}
    >
      {marca}
    </span>
  )
}
