export default function Marca({
  className = '',
  estilo,
  sobreEscuro = false,
  paraImpressao = false,
  girando = false,
  titulo = 'MATECH',
}) {
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

export function MarcaEscrita({ tamanho = 56, className = '', girando = false, sobreEscuro = false }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
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
