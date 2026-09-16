import {
  Scale, FlaskConical, Sprout, Users, Package, Banknote,
  FileBarChart, ShieldUser, History, Settings,
  Wallet, TrendingUp, Clock, Download, Printer, PlusCircle, RefreshCw,
  Filter, Search, X, ChevronRight, ArrowRight, Pencil, Check,
  Truck, CloudOff, Camera, Gauge,
  CheckCircle2, FileCheck, BanknoteCheck, XCircle, AlertTriangle, Ban, Hourglass,
} from 'lucide-react'

export const TAMANHO = {
  menu: 16,
  tabela: 16,
  botao: 18,
  indicador: 18,
  selo: 14,
}

export const ICONE_DA_TELA = {
  '/pesagem': Scale,
  '/avaliacoes': FlaskConical,
  '/campo': Sprout,
  '/produtores': Users,
  '/pagamentos': Banknote,
  '/relatorios': FileBarChart,
  '/usuarios': ShieldUser,
  '/auditoria': History,
  '/configuracoes': Settings,
}

export const ICONE_DA_ACAO = {
  baixar: Download,
  imprimir: Printer,
  registrar: PlusCircle,
  atualizar: RefreshCw,
  filtrar: Filter,
  buscar: Search,
  limpar: X,
  abrir: ChevronRight,
  seguir: ArrowRight,
  editar: Pencil,
  confirmar: Check,
  cancelar: Ban,
}

export const ICONE_DA_GRANDEZA = {
  dinheiro: Wallet,
  preco: TrendingUp,
  peso: Scale,
  espera: Clock,
  cargas: Truck,
  materiaPrima: Package,
  produtores: Users,
  qualidade: FlaskConical,
  limite: Gauge,
  alerta: AlertTriangle,
  offline: CloudOff,
  foto: Camera,
  sincronia: RefreshCw,
  quitado: BanknoteCheck,
}

export const SITUACAO = {
  AGUARDANDO_TARA: { icone: Hourglass, rotulo: 'Aguardando tara', tom: 'espera' },
  AGUARDANDO_ANALISE: { icone: Clock, rotulo: 'Em avaliação', tom: 'espera' },
  ANALISADA: { icone: CheckCircle2, rotulo: 'Analisada', tom: 'analise' },
  EM_ORDEM_PAGAMENTO: { icone: FileCheck, rotulo: 'Em ordem', tom: 'ordem' },
  PAGA: { icone: BanknoteCheck, rotulo: 'Paga', tom: 'paga' },
  REPROVADA: { icone: XCircle, rotulo: 'Reprovada', tom: 'reprovada' },
  PENDENTE: { icone: Clock, rotulo: 'Aguardando', tom: 'ordem' },
  CANCELADA: { icone: Ban, rotulo: 'Cancelada', tom: 'espera' },
  FORA_DO_PADRAO: { icone: AlertTriangle, rotulo: 'Fora do padrão', tom: 'ordem' },
}

export const SITUACOES_DA_CARGA = [
  'AGUARDANDO_TARA',
  'AGUARDANDO_ANALISE',
  'ANALISADA',
  'EM_ORDEM_PAGAMENTO',
  'PAGA',
  'REPROVADA',
]
