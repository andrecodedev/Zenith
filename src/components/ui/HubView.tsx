import { LayoutDashboard, Calendar, BarChart2, FileText, Landmark, PieChart, Music, Bot, Mic } from 'lucide-react';
import { useStore } from '../../store/useStore';

export type AppView = 'hero' | 'sobre' | 'dashboard' | 'calendar' | 'stats' | 'notes' | 'finance' | 'investments' | 'hub' | 'music' | 'chat';

interface HubViewProps {
  onNavigate: (view: AppView) => void;
}

export function HubView({ onNavigate }: HubViewProps) {
  const options = [
    {
      id: 'dashboard',
      title: 'Meu Dia',
      description: 'Acompanhe sua rotina e tarefas de hoje',
      icon: <LayoutDashboard size={20} />,
      color: 'bg-elements/10 text-text-primary border-border-base'
    },
    {
      id: 'calendar',
      title: 'Calendário',
      description: 'Planeje sua semana e eventos futuros',
      icon: <Calendar size={20} />,
      color: 'bg-elements/10 text-text-primary border-border-base'
    },
    {
      id: 'stats',
      title: 'Estatísticas',
      description: 'Análise de produtividade e evolução',
      icon: <BarChart2 size={20} />,
      color: 'bg-elements/10 text-text-primary border-border-base'
    },
    {
      id: 'notes',
      title: 'Notas e Estudos',
      description: 'Gerencie anotações, cursos e flashcards',
      icon: <FileText size={20} />,
      color: 'bg-elements/10 text-text-primary border-border-base'
    },
    {
      id: 'finance',
      title: 'Controle Financeiro',
      description: 'Gestão de despesas, orçamentos e receitas',
      icon: <Landmark size={20} />,
      color: 'bg-elements/10 text-text-primary border-border-base'
    },
    {
      id: 'investments',
      title: 'Investimentos',
      description: 'Acompanhamento da sua carteira e metas',
      icon: <PieChart size={20} />,
      color: 'bg-elements/10 text-text-primary border-border-base'
    },
    {
      id: 'music',
      title: 'Zenith Music',
      description: 'Busque e baixe músicas do YouTube',
      icon: <Music size={20} />,
      color: 'bg-elements/10 text-text-primary border-border-base'
    },
    {
      id: 'chat',
      title: 'Zenith AI',
      description: 'Assistente pessoal nativo pronto para ajudar',
      icon: <Bot size={20} className="text-brand-pink" />,
      color: 'bg-elements/10 text-text-primary border-border-base'
    },
    {
      id: 'audio_history',
      title: 'Histórico de Áudios',
      description: 'Acesse suas transcrições salvas automaticamente',
      icon: <Mic size={20} />,
      color: 'bg-elements/10 text-text-primary border-border-base'
    }
  ];

  const { playingVideo, isPlayerExpanded, isPlayerMinimized } = useStore();

  return (
    <div className="flex-1 w-full flex flex-col items-center relative min-h-[80vh] pt-4 sm:pt-10 md:pt-16 pb-4">
      {/* Logo background watermark */}
      <div className={`pointer-events-none select-none fixed right-0 w-[480px] h-[480px] opacity-[0.04] [html.light_&]:opacity-[0.06] translate-x-1/4 translate-y-1/4 z-0 transition-all duration-300 ${
        playingVideo ? (isPlayerExpanded ? 'bottom-[85vh]' : isPlayerMinimized ? 'bottom-[110px]' : 'bottom-[140px]') : 'bottom-0'
      }`}>
        <img src="/logo.png" alt="" className="w-full h-full object-contain [html.light_&]:invert" />
      </div>

      <div className="w-full space-y-8 relative z-10">
        <div className="text-center space-y-4 mb-10">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-2">
            <div className="w-14 h-14 sm:w-16 sm:h-16">
              <img src="/logo.png" alt="Zenith Logo" className="w-full h-full object-contain [html.light_&]:invert drop-shadow-md" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-black font-title tracking-wider text-text-primary uppercase">Zenith</h1>
          </div>
          <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto">
            Onde você gostaria de ir? Escolha um módulo abaixo para começar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 w-full max-w-6xl mx-auto">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onNavigate(opt.id as AppView)}
              className="flex flex-col text-left p-5 rounded-2xl border border-border-base/50 bg-bg-secondary/30 backdrop-blur-md hover:border-text-tertiary/60 hover:bg-bg-secondary/60 hover:shadow-lg transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center border bg-bg-primary/50 border-border-gray text-text-primary group-hover:border-text-tertiary group-hover:scale-105 transition-all`}>
                  {opt.icon}
                </div>
                <h2 className="text-lg font-bold text-text-primary group-hover:text-text-primary transition-colors">
                  {opt.title}
                </h2>
              </div>
              <p className="text-sm text-text-tertiary">
                {opt.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
