import { ArrowLeft, Shield, BookOpen, Clock, BarChart2, Bell, StickyNote, ArrowRight, Landmark, Music } from 'lucide-react';

interface SobreViewProps {
  onBack: () => void;
  onStart: () => void;
  isLoggedIn?: boolean;
}

type Feature = {
  icon: React.ElementType;
  title: string;
  desc: string;
  soon?: boolean;
};

const features: Feature[] = [
  {
    icon: Clock,
    title: 'Tarefas e Rotinas',
    desc: 'Crie tarefas únicas ou recorrentes com horário. Defina dias da semana, múltiplos horários e acompanhe tudo em um só lugar.',
  },
  {
    icon: BookOpen,
    title: 'Quebrador de Cursos IA',
    desc: 'Cole a ementa de qualquer curso e a IA quebra em aulas, agenda automaticamente no seu calendário sem conflito com suas tarefas.',
  },
  {
    icon: Music,
    title: 'Zenith Music',
    desc: 'Busque e baixe músicas diretamente do YouTube. Ouça offline ou deixe tocando em segundo plano enquanto você estuda e se organiza.',
  },
  {
    icon: Bell,
    title: 'Push Notifications Reais',
    desc: 'Receba alertas no celular mesmo com o app fechado. Sem depender de outro app. Funciona em Android e iOS (PWA).',
  },
  {
    icon: BarChart2,
    title: 'Estatísticas e Streaks',
    desc: 'Acompanhe seu progresso diário, sequências de dias concluídos e desempenho semanal em gráficos claros.',
  },
  {
    icon: Shield,
    title: 'Seus Dados São Seus',
    desc: 'Nenhum dado é vendido ou compartilhado. Tudo fica no seu banco de dados. Zero rastreamento.',
  },
  {
    icon: StickyNote,
    title: 'Notas Integradas',
    desc: 'Crie anotações rápidas com suporte a Markdown, blocos de código e links direto no Zenith. Sem precisar de outro app.',
  },
  {
    icon: Landmark,
    title: 'Controle Financeiro',
    desc: 'Gerencie receitas, despesas e investimentos. Crie parcelamentos recorrentes com alertas automáticos no dia do vencimento.',
  },
];

export function SobreView({ onBack, onStart, isLoggedIn }: SobreViewProps) {
  return (
    <div className="relative min-h-screen w-full pt-8 flex flex-col px-4">

      {/* Logo background watermark */}
      <div className="pointer-events-none select-none fixed bottom-0 right-0 w-[480px] h-[480px] opacity-[0.04] [html.light_&]:opacity-[0.06] translate-x-1/4 translate-y-1/4">
        <img src="/logo.png" alt="" className="w-full h-full object-contain [html.light_&]:invert" />
      </div>

      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-text-tertiary hover:text-text-primary transition-colors text-sm mb-12 cursor-pointer group w-fit"
      >
        <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
        {isLoggedIn ? 'Menu Principal' : 'Voltar'}
      </button>

      {/* Manifesto */}
      <div className="max-w-2xl mb-16 md:mb-20">
        <p className="text-[10px] md:text-xs uppercase tracking-[0.3em] text-text-tertiary mb-3 md:mb-4">Por que o Zenith existe</p>
        <h1 className="font-title font-bold text-3xl sm:text-4xl md:text-5xl text-text-primary leading-tight mb-6 md:mb-8">
          Cansado de instalar<br />
          <span className="text-transparent bg-clip-text bg-linear-to-r from-white via-neutral-300 to-neutral-500 [html.light_&]:from-neutral-900 [html.light_&]:via-neutral-600 [html.light_&]:to-neutral-400">
            cinco apps pra fazer uma coisa.
          </span>
        </h1>

        <div className="space-y-4 md:space-y-5 text-text-secondary text-sm md:text-base leading-relaxed">
          <p>
            Agenda aqui. Notas ali. Cursos em outro lugar. Notificação de um lado, calendário de outro,
            e no meio disso tudo, <strong className="text-text-primary">propagandas, planos Premium e promessas de "gratuito"
            que não entregam nada do que você precisa.</strong>
          </p>
          <p>
            O Zenith foi criado para dar um soco na cara disso. Um sistema pessoal completo,
            direto ao ponto, sem frescura, feito para quem tem muito para fazer e não tem tempo
            pra ficar configurando ferramentas de produtividade.
          </p>
          <p>
            Aqui você organiza suas tarefas, seus cursos, seus horários.{' '}
            <strong className="text-text-primary">E seus dados são seus. Só seus. Nada mais.</strong>
          </p>
        </div>
      </div>

      {/* Divider com logo */}
      <div className="flex items-center gap-4 mb-16">
        <div className="flex-1 h-px bg-border-base" />
        <img
          src="/logo.png"
          alt="Zenith"
          className="w-5 h-5 object-contain opacity-40 [html.light_&]:invert"
        />
        <div className="flex-1 h-px bg-border-base" />
      </div>

      {/* Features */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-text-tertiary mb-8">O que tem dentro</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          {features.map(({ icon: Icon, title, desc, soon }) => (
            <div
              key={title}
              className={`relative p-5 rounded-xl border transition-colors ${
                soon
                  ? 'border-border-base bg-bg-secondary/30 opacity-60'
                  : 'border-border-base bg-bg-secondary/60 hover:border-neutral-500'
              }`}
            >
              {soon && (
                <span className="absolute top-3 right-3 text-[9px] uppercase tracking-widest text-text-tertiary border border-border-base rounded px-1.5 py-0.5">
                  Em breve
                </span>
              )}
              <Icon size={20} className="text-text-tertiary mb-3" />
              <h3 className="text-text-primary font-semibold text-sm mb-1.5">{title}</h3>
              <p className="text-text-secondary text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

                        {/* CTA */}
      <div className="border border-border-base rounded-2xl p-6 sm:p-8 md:p-12 text-center bg-bg-secondary/30 mb-8">
        <p className="text-text-tertiary text-[10px] md:text-xs uppercase tracking-widest mb-3 md:mb-4">Pronto para começar</p>
        <h2 className="font-title font-bold text-2xl md:text-3xl text-text-primary mb-3">
          Domine o seu tempo.
        </h2>
        <p className="text-text-secondary text-xs sm:text-sm mb-6 md:mb-8 max-w-md mx-auto leading-relaxed">
          Por enquanto, <strong className="text-text-primary">100% grátis.</strong> No futuro,
          um valor simbólico - transparente, proporcional ao custo real de servidor e banco de dados.
          Sem abuso. Sem plano premium que trava o básico. Esse é o diferencial do Zenith.
        </p>
        <button
          onClick={onStart}
          className="group pointer-events-auto cursor-pointer border border-white/30 hover:border-white/80 hover:bg-white hover:text-black text-white px-7 py-2.5 text-xs font-bold uppercase tracking-[0.25em] flex items-center gap-3 transition-all duration-500 active:scale-95 mx-auto [html.light_&]:text-neutral-900 [html.light_&]:border-neutral-900/30 [html.light_&]:hover:border-neutral-900 [html.light_&]:hover:bg-neutral-900 [html.light_&]:hover:text-white"
        >
          Acessar Dashboard
          <ArrowRight size={14} className="transition-transform duration-500 group-hover:translate-x-1.5" />
        </button>
      </div>
      </div>
    </div>
  );
}
