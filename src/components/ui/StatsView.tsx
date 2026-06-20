import { useState } from 'react';
import { useStats } from '../../utils/useStats';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Flame, Trophy, TrendingUp, CheckCircle2, Target, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTodayStr } from '../../utils/date';

export function StatsView() {
  const today = getTodayStr();
  const [referenceDate, setReferenceDate] = useState(today);
  const isCurrentWeek = referenceDate === today;

  const { currentStreak, bestStreak, weekData, weeklyPct, totalCompletedAllTime, todayTotal, todayCompleted } = useStats(referenceDate);

  const handlePrev = () => setReferenceDate(format(subDays(parseISO(referenceDate), 7), 'yyyy-MM-dd'));
  const handleNext = () => {
    const next = format(addDays(parseISO(referenceDate), 7), 'yyyy-MM-dd');
    if (next <= today) setReferenceDate(next);
  };

  const weekStart = format(subDays(parseISO(referenceDate), 6), "d MMM", { locale: ptBR });
  const weekEnd = format(parseISO(referenceDate), "d MMM", { locale: ptBR });
  const todayLabel = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 pb-12">
      <div>
        <h2 className="text-3xl font-bold font-title mb-1">Estatísticas</h2>
        <p className="text-text-secondary capitalize">{todayLabel}</p>
      </div>

      {/* Streak cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-secondary border border-border-base rounded-xl p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-text-tertiary">
            <Flame size={15} />
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Streak atual</span>
          </div>
          <p className="text-4xl font-bold text-text-primary leading-none mt-1">{currentStreak}</p>
          <p className="text-xs text-text-tertiary">dias seguidos</p>
        </div>

        <div className="bg-bg-secondary border border-border-base rounded-xl p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-text-tertiary">
            <Trophy size={15} />
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Melhor streak</span>
          </div>
          <p className="text-4xl font-bold text-text-primary leading-none mt-1">{bestStreak}</p>
          <p className="text-xs text-text-tertiary">dias seguidos</p>
        </div>
      </div>

      {/* Weekly bar chart */}
      <div className="bg-bg-secondary border border-border-base rounded-xl p-4">
        {/* Nav de semana */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-text-secondary">
            <TrendingUp size={15} />
            <span className="text-xs font-bold uppercase tracking-wider">7 dias</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrev} className="p-1 rounded hover:bg-elements text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-text-secondary font-medium w-24 text-center">{weekStart} – {weekEnd}</span>
            <button
              onClick={handleNext}
              disabled={isCurrentWeek}
              className="p-1 rounded hover:bg-elements text-text-tertiary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
            >
              <ChevronRight size={16} />
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

        <div className="flex items-center justify-end mb-3">
          <span className="text-sm font-bold text-text-primary">{weeklyPct}% média</span>
        </div>

        <div className="flex items-end gap-1.5 h-20">
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
                <span className="text-[9px] text-text-tertiary font-medium h-3 flex items-center">
                  {day.total > 0 && day.pct > 0 ? `${day.pct}%` : ''}
                </span>
                <div className="w-full h-12 flex items-end">
                  <div
                    className={`w-full rounded-sm transition-all duration-500 ${barColor} ${isToday ? 'ring-1 ring-white/20' : ''}`}
                    style={{ height: day.total === 0 ? '4px' : `${barPct}%` }}
                  />
                </div>
                <span className={`text-[10px] font-semibold uppercase ${isToday ? 'text-text-primary' : 'text-text-tertiary'}`}>
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-bg-secondary border border-border-base rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1 text-text-tertiary mb-0.5">
            <CheckCircle2 size={12} />
            <span className="text-[9px] font-bold uppercase tracking-wider">Hoje</span>
          </div>
          <p className="text-2xl font-bold leading-none">
            {todayCompleted}<span className="text-xs text-text-tertiary font-normal">/{todayTotal}</span>
          </p>
          <p className="text-[10px] text-text-tertiary">concluídas</p>
        </div>

        <div className="bg-bg-secondary border border-border-base rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1 text-text-tertiary mb-0.5">
            <Target size={12} />
            <span className="text-[9px] font-bold uppercase tracking-wider">Semana</span>
          </div>
          <p className="text-2xl font-bold leading-none">
            {weeklyPct}<span className="text-xs text-text-tertiary font-normal">%</span>
          </p>
          <p className="text-[10px] text-text-tertiary">conclusão</p>
        </div>

        <div className="bg-bg-secondary border border-border-base rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1 text-text-tertiary mb-0.5">
            <Trophy size={12} />
            <span className="text-[9px] font-bold uppercase tracking-wider">Total</span>
          </div>
          <p className="text-2xl font-bold leading-none">{totalCompletedAllTime}</p>
          <p className="text-[10px] text-text-tertiary">feitas</p>
        </div>
      </div>
    </div>
  );
}
