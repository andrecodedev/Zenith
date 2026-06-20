import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { generateCalendarWeek, isTaskDueToday } from '../../utils/date';
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, AlertCircle, Clock } from 'lucide-react';
import { computeTaskStatus } from '../../utils/status';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getCategoryStyles } from '../../utils/colors';
import { RoutineDetailsModal } from './RoutineDetailsModal';
import type { Routine } from '../../types';

interface CalendarViewProps {
  selectedDate: string;
  onNavigate: (amount: number) => void;
  onSelectDate: (dateStr: string) => void;
}

export function CalendarView({ selectedDate, onNavigate }: CalendarViewProps) {
  const { routines, categories, taskInstances, toggleTask } = useStore();
  
  const [selectedRoutine, setSelectedRoutine] = useState<{ routine: Routine, dateStr: string } | null>(null);

  const weekDays = generateCalendarWeek(selectedDate);

  useEffect(() => {
    setTimeout(() => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const el = document.getElementById(`cal-day-${todayStr}`) || document.getElementById(`cal-day-${selectedDate}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 100);
  }, [selectedDate]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-title mb-1 md:mb-2">Visão Geral</h2>
          <p className="text-text-secondary">Suas tarefas da semana</p>
        </div>
        <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto bg-bg-secondary/30 md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none">
          <span className="text-lg font-medium capitalize">
            {format(parseISO(selectedDate), "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <div className="flex bg-bg-secondary rounded-md border border-border-base p-1 gap-1 shrink-0">
            <button onClick={() => onNavigate(-7)} className="cursor-pointer p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-elements-hover transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => onNavigate(7)} className="cursor-pointer p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-elements-hover transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-x-auto gap-4 min-h-0 snap-x snap-mandatory pb-4 hide-scrollbar">
        {weekDays.map(({ dateStr, dayName, dayNumber }) => {
          const isTodayStr = dateStr === format(new Date(), 'yyyy-MM-dd');
          const dayRoutines = routines.filter(r => isTaskDueToday(r, dateStr));
          
          return (
            <div key={dateStr} id={`cal-day-${dateStr}`} className="flex-shrink-0 w-[280px] md:w-auto md:flex-1 flex flex-col h-full bg-bg-secondary/30 rounded-xl border border-border-base/50 overflow-hidden snap-center">
              <div className={`p-4 text-center border-b border-border-base/50 shrink-0 ${isTodayStr ? 'bg-elements/50' : ''}`}>
                <div className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-1">{dayName}</div>
                <div className={`text-2xl font-bold font-title ${isTodayStr ? 'text-text-primary' : 'text-text-primary'}`}>{dayNumber}</div>
              </div>
              
              <div className="p-3 flex-1 overflow-y-auto space-y-2 pr-2">
                {dayRoutines.map(routine => {
                  const category = categories.find(c => c.id === routine.categoryId);
                  const instance = taskInstances.find(t => t.routineId === routine.id && t.date === dateStr);
                  const status = computeTaskStatus(routine, dateStr, instance);
                  const isCompleted = status === 'completed';
                  const isLate = status === 'late';

                  return (
                    <div 
                      key={routine.id}
                      onClick={() => setSelectedRoutine({ routine, dateStr })}
                      className={`p-3 rounded-lg border text-sm cursor-pointer transition-all ${
                        status === 'completed' 
                          ? 'bg-bg-secondary/50 border-border-base/50 opacity-50' 
                          : 'bg-bg-secondary border-border-gray hover:border-neutral-500'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button className="mt-0.5 flex-shrink-0 transition-colors">
                          {status === 'completed' && <CheckCircle2 size={16} className="text-emerald-500" />}
                          {status === 'in_progress' && <Clock size={16} className="text-yellow-500" />}
                          {status === 'late' && <AlertCircle size={16} className="text-red-500" />}
                          {status === 'pending' && <Circle size={16} className="text-text-tertiary" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${isCompleted ? 'line-through text-text-tertiary' : 'text-text-primary'}`}>
                            {routine.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded inline-block truncate max-w-full ${getCategoryStyles(category?.color)}`}>
                              {category?.name}
                            </span>
                            {routine.time && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded inline-block bg-elements text-text-secondary border border-border-gray">
                                {routine.time}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <RoutineDetailsModal 
        isOpen={selectedRoutine !== null}
        routine={selectedRoutine?.routine || null}
        dateStr={selectedRoutine?.dateStr || null}
        onClose={() => setSelectedRoutine(null)}
      />
    </div>
  );
}
