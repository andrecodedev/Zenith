import React from 'react';
import { useStore } from '../../store/useStore';
import { generateCalendarWeek, isTaskDueToday } from '../../utils/date';
import { CheckCircle2, Circle, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalendarViewProps {
  selectedDate: string;
  onNavigate: (amount: number) => void;
  onSelectDate: (dateStr: string) => void;
}

export function CalendarView({ selectedDate, onNavigate, onSelectDate }: CalendarViewProps) {
  const { routines, categories, taskInstances, toggleTask } = useStore();
  
  const weekDays = generateCalendarWeek(selectedDate);

  return (
    <div className="flex flex-col h-full">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-2">Visão Geral</h2>
          <p className="text-neutral-400">Suas tarefas da semana</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-lg font-medium">
            {format(parseISO(selectedDate), "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <div className="flex bg-neutral-900 rounded-lg border border-neutral-800 p-1">
            <button onClick={() => onNavigate(-7)} className="p-2 text-neutral-400 hover:text-white transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => onNavigate(7)} className="p-2 text-neutral-400 hover:text-white transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-7 gap-4">
        {weekDays.map(({ dateStr, dayName, dayNumber }) => {
          const isTodayStr = dateStr === format(new Date(), 'yyyy-MM-dd');
          const dayRoutines = routines.filter(r => isTaskDueToday(r, dateStr));
          
          return (
            <div key={dateStr} className="flex flex-col h-full bg-neutral-900/30 rounded-2xl border border-neutral-800/50 overflow-hidden">
              <div className={`p-4 text-center border-b border-neutral-800/50 ${isTodayStr ? 'bg-indigo-600/10' : ''}`}>
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">{dayName}</div>
                <div className={`text-2xl font-bold ${isTodayStr ? 'text-indigo-400' : 'text-white'}`}>{dayNumber}</div>
              </div>
              
              <div className="p-3 flex-1 overflow-y-auto space-y-2 hide-scrollbar">
                {dayRoutines.map(routine => {
                  const category = categories.find(c => c.id === routine.categoryId);
                  const isCompleted = taskInstances.find(t => t.routineId === routine.id && t.date === dateStr)?.completed;

                  return (
                    <div 
                      key={routine.id}
                      onClick={() => toggleTask(routine.id, dateStr)}
                      className={`p-3 rounded-xl border text-sm cursor-pointer transition-all ${
                        isCompleted 
                          ? 'bg-neutral-900/50 border-neutral-800/50 opacity-50' 
                          : 'bg-neutral-900 border-neutral-700 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button className={`mt-0.5 flex-shrink-0 transition-colors ${isCompleted ? 'text-indigo-500' : 'text-neutral-500'}`}>
                          {isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${isCompleted ? 'line-through text-neutral-500' : 'text-neutral-200'}`}>
                            {routine.title}
                          </p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded mt-1.5 inline-block ${category?.color} bg-opacity-20 text-white/80 truncate max-w-full`}>
                            {category?.name}
                          </span>
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
    </div>
  );
}
