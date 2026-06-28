import { useState } from 'react';
import { useStats } from '../../utils/useStats';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trophy, TrendingUp, CheckCircle2, Target, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import { getTodayStr } from '../../utils/date';

export function StatsView() {
  const today = getTodayStr();
  const [referenceDate, setReferenceDate] = useState(today);
  const isCurrentWeek = referenceDate === today;

  const { weekData, weeklyPct, totalCompletedAllTime, todayTotal, todayCompleted } = useStats(referenceDate);

  const handlePrev = () => setReferenceDate(format(subDays(parseISO(referenceDate), 7), 'yyyy-MM-dd'));
  const handleNext = () => {
    const next = format(addDays(parseISO(referenceDate), 7), 'yyyy-MM-dd');
    if (next <= today) setReferenceDate(next);
  };

  const weekStart = format(subDays(parseISO(referenceDate), 6), "d MMM", { locale: ptBR });
  const weekEnd = format(parseISO(referenceDate), "d MMM", { locale: ptBR });
  const todayLabel = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="w-full space-y-6 pb-12">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold font-title text-text-primary flex items-center gap-3 mb-2">
          <BarChart2 size={32} className="text-brand-pink" />
          Estatísticas
        </h1>
        <p className="text-sm sm:text-base text-text-secondary capitalize">Análise de produtividade e evolução • {todayLabel}</p>
      </div>


      {/* Weekly bar chart */}
      <div className="bg-bg-secondary border border-border-base rounded-xl p-6">
        {/* Nav de semana */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4">
          <div className="flex items-center gap-2 text-text-secondary">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">7 dias</span>
          </div>
          <div className="flex items-center justify-end gap-1 sm:gap-2">
            <button onClick={handlePrev} className="p-1 sm:p-1.5 rounded hover:bg-elements text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <span className="text-xs sm:text-sm text-text-secondary font-medium w-24 sm:w-28 text-center">{weekStart} – {weekEnd}</span>
            <button
              onClick={handleNext}
              disabled={isCurrentWeek}
              className="p-1.5 rounded hover:bg-elements text-text-tertiary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            {!isCurrentWeek && (
              <button
                onClick={() => setReferenceDate(today)}
                className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary hover:text-text-primary border border-border-base hover:border-border-gray px-2 py-1 rounded transition-colors cursor-pointer"
              >
                Hoje
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end mb-4">
          <span className="text-sm sm:text-lg font-bold text-text-primary">{weeklyPct}% média</span>
        </div>

        <div className="flex items-end gap-1.5 sm:gap-2 h-32 sm:h-40">
          {weekData.map(day => {
            const isToday = day.dateStr === today;
            const barPct = day.total === 0 ? 0 : Math.max(6, day.pct);
            const barColor =
              day.total === 0 ? 'bg-border-base/40' :
              day.pct === 100 ? 'bg-emerald-500' :
              day.pct >= 50 ? 'bg-yellow-500' :
              day.pct > 0 ? 'bg-red-500/70' :
              'bg-border-base/40';

            return (
              <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[9px] sm:text-[10px] text-text-tertiary font-medium h-3 sm:h-4 flex items-center">
                  {day.total > 0 && day.pct > 0 ? `${day.pct}%` : ''}
                </span>
                <div className="w-full h-24 sm:h-32 flex items-end">
                  <div
                    className={`w-full rounded-sm transition-all duration-500 ${barColor} ${isToday ? 'ring-1 ring-white/20' : ''}`}
                    style={{ height: day.total === 0 ? '4px' : `${barPct}%` }}
                  />
                </div>
                <span className={`text-[10px] sm:text-xs mt-1 font-semibold uppercase ${isToday ? 'text-text-primary' : 'text-text-tertiary'}`}>
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-bg-secondary border border-border-base rounded-xl p-3 sm:p-6 flex flex-col gap-1">
          <div className="flex items-center gap-1 sm:gap-1.5 text-text-tertiary mb-0.5 sm:mb-1">
            <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="text-[9px] sm:text-xs font-bold uppercase tracking-wider">Hoje</span>
          </div>
          <p className="text-2xl sm:text-4xl font-bold leading-none mt-1 sm:mt-2">
            {todayCompleted}<span className="text-[10px] sm:text-sm text-text-tertiary font-normal">/{todayTotal}</span>
          </p>
          <p className="text-[9px] sm:text-xs text-text-tertiary mt-0.5 sm:mt-1">concluídas</p>
        </div>

        <div className="bg-bg-secondary border border-border-base rounded-xl p-3 sm:p-6 flex flex-col gap-1">
          <div className="flex items-center gap-1 sm:gap-1.5 text-text-tertiary mb-0.5 sm:mb-1">
            <Target className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="text-[9px] sm:text-xs font-bold uppercase tracking-wider">Semana</span>
          </div>
          <p className="text-2xl sm:text-4xl font-bold leading-none mt-1 sm:mt-2">
            {weeklyPct}<span className="text-[10px] sm:text-sm text-text-tertiary font-normal">%</span>
          </p>
          <p className="text-[9px] sm:text-xs text-text-tertiary mt-0.5 sm:mt-1">conclusão</p>
        </div>

        <div className="bg-bg-secondary border border-border-base rounded-xl p-3 sm:p-6 flex flex-col gap-1">
          <div className="flex items-center gap-1 sm:gap-1.5 text-text-tertiary mb-0.5 sm:mb-1">
            <Trophy className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="text-[9px] sm:text-xs font-bold uppercase tracking-wider">Total</span>
          </div>
          <p className="text-2xl sm:text-4xl font-bold leading-none mt-1 sm:mt-2">{totalCompletedAllTime}</p>
          <p className="text-[9px] sm:text-xs text-text-tertiary mt-0.5 sm:mt-1">feitas</p>
        </div>
      </div>
    </div>
  );
}
