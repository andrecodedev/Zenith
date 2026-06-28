import React from 'react';
import { LayoutDashboard, Calendar, BarChart2, FileText, Mountain, Landmark, PieChart } from 'lucide-react';

export type AppView = 'hero' | 'sobre' | 'dashboard' | 'calendar' | 'stats' | 'notes' | 'finance' | 'investments' | 'hub';

interface HubViewProps {
  onNavigate: (view: AppView) => void;
}

export function HubView({ onNavigate }: HubViewProps) {
  const options = [
    {
      id: 'dashboard',
      title: 'Meu Dia',
      description: 'Acompanhe sua rotina e tarefas de hoje',
      icon: <LayoutDashboard size={32} />,
      color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
    },
    {
      id: 'calendar',
      title: 'Calendário',
      description: 'Planeje sua semana e eventos futuros',
      icon: <Calendar size={32} />,
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    },
    {
      id: 'stats',
      title: 'Estatísticas',
      description: 'Análise de produtividade e evolução',
      icon: <BarChart2 size={32} />,
      color: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    },
    {
      id: 'notes',
      title: 'Notas e Estudos',
      description: 'Gerencie anotações, cursos e flashcards',
      icon: <FileText size={32} />,
      color: 'bg-pink-500/10 text-pink-400 border-pink-500/20'
    },
    {
      id: 'finance',
      title: 'Controle Financeiro',
      description: 'Gestão de despesas, orçamentos e receitas',
      icon: <Landmark size={32} />,
      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    },
    {
      id: 'investments',
      title: 'Investimentos',
      description: 'Acompanhamento da sua carteira e metas',
      icon: <PieChart size={32} />,
      color: 'bg-violet-500/10 text-violet-400 border-violet-500/20'
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl mx-auto space-y-12 py-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-bg-secondary border border-border-base mb-2">
            <Mountain size={32} className="text-text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-text-primary">Zenith</h1>
          <p className="text-text-secondary text-sm sm:text-base max-w-md mx-auto">
            Onde você gostaria de ir? Escolha um módulo abaixo para começar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onNavigate(opt.id as AppView)}
              className="flex flex-col text-left p-6 rounded-2xl border border-border-base bg-bg-secondary hover:border-border-gray hover:bg-elements/5 transition-all group cursor-pointer"
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 border ${opt.color} group-hover:scale-110 transition-transform`}>
                {opt.icon}
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-2 group-hover:text-text-primary transition-colors">
                {opt.title}
              </h2>
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
