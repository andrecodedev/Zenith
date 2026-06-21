import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { generateCalendarWeek, isTaskDueToday } from '../../utils/date';
import { ChevronLeft, ChevronRight, ChevronDown, Calendar } from 'lucide-react';
import { computeTaskStatus } from '../../utils/status';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getCategoryStyles } from '../../utils/colors';
import { RoutineDetailsModal } from './RoutineDetailsModal';
import type { TaskStatus } from '../../types';

interface CalendarViewProps {
  selectedDate: string;
  onNavigate: (amount: number) => void;
  onSelectDate: (dateStr: string) => void;
}

const getStatusColor = (status: TaskStatus) => {
  switch(status) {
    case 'completed': return 'bg-emerald-500';
    case 'in_progress': return 'bg-yellow-500';
    case 'late': return 'bg-red-500';
    case 'canceled': return 'bg-purple-500';
    default: return 'bg-neutral-500';
  }
};

const HOUR_HEIGHT = 60; // 60px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function CalendarView({ selectedDate, onNavigate, onSelectDate }: CalendarViewProps) {
  const { routines, categories, taskInstances } = useStore();
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [selectedRoutineId, setSelectedRoutineId] = useState<{ id: string, dateStr: string } | null>(null);
  
  const selectedRoutine = selectedRoutineId 
    ? routines.find(r => r.id === selectedRoutineId.id)
    : null;

  const [currentTime, setCurrentTime] = useState(new Date());
  const gridRef = useRef<HTMLDivElement>(null);

  const weekDays = generateCalendarWeek(selectedDate);
  const dayDays = [{
    dateStr: selectedDate,
    dayName: format(parseISO(selectedDate), 'eee', { locale: ptBR }),
    dayNumber: format(parseISO(selectedDate), 'dd')
  }];

  const currentDays = viewMode === 'day' ? dayDays : weekDays;

  // Gerar dias do mês
  const monthStart = startOfMonth(parseISO(selectedDate));
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const monthDays = eachDayOfInterval({ start: startDate, end: endDate });

  // Update current time line every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to current time on mount
  useEffect(() => {
    if (gridRef.current) {
      const hours = currentTime.getHours();
      gridRef.current.scrollTop = Math.max(0, (hours * 60) - 100);
    }
  }, []);

  const getTitle = () => {
    if (viewMode === 'day') return 'Visão Diária';
    if (viewMode === 'month') return 'Visão Mensal';
    return 'Visão Semanal';
  };

  const parseTimeToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg-primary">
      <header className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-bold font-title mb-1">{getTitle()}</h2>
          <div className="relative inline-block mt-1">
            <input 
              type="month"
              value={selectedDate.slice(0, 7)}
              onChange={(e) => {
                if (e.target.value) {
                  onSelectDate(`${e.target.value}-01`);
                }
              }}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10 [color-scheme:dark] [html.light_&]:[color-scheme:light]"
            />
            <div className="flex items-center gap-2 pl-3 pr-4 py-2 rounded-lg bg-elements text-text-secondary hover:text-text-primary hover:bg-elements-hover transition-all cursor-pointer border border-border-gray">
              <Calendar size={16} />
              <span className="capitalize text-sm font-medium">
                {format(parseISO(selectedDate), "MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              <ChevronDown size={14} className="shrink-0 opacity-70 ml-1" />
            </div>
          </div>
        </div>
        <div className="flex items-center bg-bg-secondary rounded-md border border-border-base p-1 gap-1 shrink-0 h-[42px]">
          <div className="relative border-r border-border-base/50 mr-1 pr-1 h-full flex items-center">
            <button 
              onClick={() => onSelectDate(format(new Date(), 'yyyy-MM-dd'))}
              className="bg-transparent hover:bg-elements text-text-primary px-3 py-1.5 rounded-md text-sm font-bold transition-all cursor-pointer h-full flex items-center"
            >
              Hoje
            </button>
          </div>
          <div className="relative border-r border-border-base/50 mr-1 pr-1 h-full flex items-center">
            <button 
              onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
              className="flex items-center gap-2 bg-transparent text-sm font-bold text-text-primary pl-3 pr-4 py-1.5 cursor-pointer hover:bg-elements-hover rounded-md transition-colors h-full"
            >
              <span className="capitalize">{viewMode === 'day' ? 'Dia' : viewMode === 'week' ? 'Semana' : 'Mês'}</span>
              <ChevronDown size={14} className={`shrink-0 transition-transform ${isViewDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isViewDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsViewDropdownOpen(false)} />
                <div className="absolute top-[calc(100%+4px)] left-0 w-32 bg-bg-secondary border border-border-base rounded-md shadow-lg overflow-hidden z-50">
                  {(['day', 'week', 'month'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => {
                        setViewMode(mode);
                        setIsViewDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${
                        viewMode === mode 
                          ? 'bg-elements text-text-primary font-bold' 
                          : 'text-text-secondary hover:text-text-primary hover:bg-elements-hover'
                      }`}
                    >
                      {mode === 'day' ? 'Dia' : mode === 'week' ? 'Semana' : 'Mês'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={() => onNavigate(viewMode === 'day' ? -1 : viewMode === 'week' ? -7 : -30)} className="cursor-pointer p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-elements-hover transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => onNavigate(viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 30)} className="cursor-pointer p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-elements-hover transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0 overflow-x-auto hide-scrollbar">
        {viewMode === 'month' ? (
          <div className="flex-1 flex flex-col min-w-[700px]">
            {/* Cabecalho dos dias da semana (Mês) */}
            <div className="grid grid-cols-7 border-b border-border-base shrink-0">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="py-2 text-center text-xs font-bold uppercase tracking-wider text-text-tertiary border-r border-border-base last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            {/* Grid do Mês */}
            <div className="flex-1 grid grid-cols-7 grid-rows-5 overflow-y-auto">
              {monthDays.map((date, i) => {
                const dStr = format(date, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(date, monthStart);
                const dayRoutines = routines.filter(r => isTaskDueToday(r, dStr));
                const isTodaysDate = isToday(date);
                
                return (
                  <div key={i} className={`border-r border-b border-border-base last:border-r-0 p-1 flex flex-col min-h-[100px] ${isCurrentMonth ? 'bg-bg-primary' : 'bg-bg-secondary/30'}`}>
                    <div className="flex justify-between items-center px-1 mb-1">
                      <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isTodaysDate ? 'bg-btn-bg text-text-primary' : isCurrentMonth ? 'text-text-primary' : 'text-text-tertiary'}`}>
                        {format(date, 'd')}
                      </span>
                      <span className="text-[10px] text-text-tertiary font-medium">{dayRoutines.length > 0 ? `${dayRoutines.length} t.` : ''}</span>
                    </div>
                    <div className="flex-1 flex flex-col gap-1 overflow-y-auto hide-scrollbar">
                      {dayRoutines.slice(0, 4).map(routine => {
                        const instance = taskInstances.find(t => t.routineId === routine.id && t.date === dStr);
                        const status = computeTaskStatus(routine, dStr, instance);
                        const isCompleted = status === 'completed' || status === 'canceled';
                        return (
                          <div 
                            key={routine.id}
                            onClick={() => setSelectedRoutineId({ id: routine.id, dateStr: dStr })}
                            className={`px-1.5 py-0.5 text-[10px] rounded truncate cursor-pointer transition-transform hover:scale-[1.02] flex items-center gap-1 ${isCompleted ? 'opacity-50 line-through bg-bg-secondary' : 'bg-bg-secondary border border-border-base/50'}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusColor(status)}`} />
                            {routine.time && <span className="font-bold">{routine.time}</span>}
                            <span>{routine.title}</span>
                          </div>
                        );
                      })}
                      {dayRoutines.length > 4 && (
                        <div className="text-[10px] text-text-tertiary text-center cursor-pointer hover:text-text-primary mt-1">
                          + {dayRoutines.length - 4} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Grid Header (Days) */}
            <div className={`flex border-b border-border-base shrink-0 ml-16 ${viewMode === 'day' ? 'w-full' : 'w-full min-w-[840px]'}`}>
          {currentDays.map(({ dateStr, dayName, dayNumber }) => {
          const isTodaysDate = dateStr === format(new Date(), 'yyyy-MM-dd');
          return (
            <div key={dateStr} className="flex-1 text-center py-3 border-r border-border-base last:border-r-0 min-w-[120px]">
              <div className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-1">{dayName}</div>
              <div className={`text-2xl font-bold font-title inline-flex items-center justify-center w-10 h-10 rounded-full ${isTodaysDate ? 'bg-btn-bg text-text-primary' : 'text-text-primary'}`}>
                {dayNumber}
              </div>
            </div>
          );
        })}
        </div>

        {/* All Day Section (Optional feature space, hidden for now unless we have tasks without time) */}
        {currentDays.some(({ dateStr }) => routines.some(r => isTaskDueToday(r, dateStr) && !r.time)) && (
          <div className={`flex border-b border-border-base shrink-0 ml-16 ${viewMode === 'day' ? 'w-full' : 'w-full min-w-[840px]'}`}>
            {currentDays.map(({ dateStr }) => {
            const allDayRoutines = routines.filter(r => isTaskDueToday(r, dateStr) && !r.time);
            return (
              <div key={dateStr} className="flex-1 p-1 border-r border-border-base last:border-r-0 min-h-[40px] flex flex-col gap-1 min-w-[120px]">
                {allDayRoutines.map(routine => {
                  const category = categories.find(c => c.id === routine.categoryId);
                  const instance = taskInstances.find(t => t.routineId === routine.id && t.date === dateStr);
                  const status = computeTaskStatus(routine, dateStr, instance);
                  
                  return (
                    <div
                      key={routine.id}
                      onClick={() => setSelectedRoutineId({ id: routine.id, dateStr })}
                      className={`px-2 py-1 text-xs rounded truncate cursor-pointer ${getCategoryStyles(category?.color)} ${(status === 'completed' || status === 'canceled') ? 'opacity-50 line-through' : ''}`}
                    >
                      {routine.title}
                    </div>
                  );
                })}
              </div>
            );
          })}
          </div>
        )}

        {/* Scrollable Timeline Grid */}
        <div className={`flex-1 overflow-y-auto relative hide-scrollbar ${viewMode === 'day' ? 'w-full' : 'w-full min-w-[840px]'}`} ref={gridRef}>
          <div className="flex h-[1440px]"> {/* 24 hours * 60px */}
            
            {/* Time Labels (Y-axis) */}
            <div className="w-16 shrink-0 border-r border-border-base flex flex-col relative z-20 bg-bg-primary sticky left-0">
              {HOURS.map(hour => (
                <div key={hour} className="relative text-xs text-text-tertiary text-right pr-2" style={{ height: HOUR_HEIGHT }}>
                  <span className={`block ${hour === 0 ? 'mt-1' : 'relative -translate-y-1/2'}`}>{`${hour.toString().padStart(2, '0')}:00`}</span>
                </div>
              ))}
            </div>

          {/* Grid Background & Columns */}
          <div className="flex-1 flex relative">
            {/* Horizontal Grid Lines */}
            <div className="absolute inset-0 flex flex-col pointer-events-none">
              {HOURS.map(hour => (
                <div key={hour} className="border-b border-border-base/50" style={{ height: HOUR_HEIGHT }} />
              ))}
            </div>

            {/* Current Time Indicator */}
            {currentDays.some(d => d.dateStr === format(currentTime, 'yyyy-MM-dd')) && (
              <div 
                className="absolute left-0 right-0 border-t-2 border-red-500 z-30 pointer-events-none flex items-center"
                style={{ top: `${(currentTime.getHours() * 60) + currentTime.getMinutes()}px` }}
              >
                <div className="absolute -left-2 w-2 h-2 rounded-full bg-red-500" />
              </div>
            )}

            {/* Day Columns */}
            {currentDays.map(({ dateStr }) => {
              const timedRoutines = routines.filter(r => isTaskDueToday(r, dateStr) && r.time);
              
              return (
                <div key={dateStr} className="flex-1 relative border-r border-border-base/30 last:border-r-0 min-w-[120px]">
                  {timedRoutines.map(routine => {
                    const instance = taskInstances.find(t => t.routineId === routine.id && t.date === dateStr);
                    const status = computeTaskStatus(routine, dateStr, instance);
                        const isCompleted = status === 'completed' || status === 'canceled';
                    
                    const startMinutes = parseTimeToMinutes(routine.time!);
                    const endMinutes = routine.endTime ? parseTimeToMinutes(routine.endTime) : startMinutes + 60; // default 1h
                    const duration = Math.max(endMinutes - startMinutes, 30); // min 30px height

                    return (
                      <div
                        key={routine.id}
                        onClick={() => setSelectedRoutineId({ id: routine.id, dateStr })}
                        className={`absolute left-1 right-1 rounded-md py-1 px-2 overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] border shadow-sm z-10 flex flex-col justify-start ${
                          isCompleted ? 'bg-bg-secondary/80 border-border-base/50' : 'bg-bg-secondary border-border-gray hover:border-neutral-500'
                        }`}
                        style={{ 
                          top: `${startMinutes}px`,
                          height: `${duration}px`
                        }}
                      >
                        <div className="flex items-start gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${getStatusColor(status)}`} />
                          <div className="flex-1 min-w-0">
                            {duration <= 30 ? (
                              <p className={`text-xs font-bold leading-tight truncate ${isCompleted ? 'line-through text-text-tertiary' : 'text-text-primary'}`}>
                                {routine.time} <span className="font-normal opacity-80 ml-1">{routine.title}</span>
                              </p>
                            ) : (
                              <>
                                <p className={`text-xs font-bold leading-tight truncate ${isCompleted ? 'line-through text-text-tertiary' : 'text-text-primary'}`}>
                                  {routine.title}
                                </p>
                                <p className="text-[10px] text-text-secondary mt-0.5 truncate">
                                  {routine.time} - {routine.endTime || `${Math.floor(endMinutes/60).toString().padStart(2, '0')}:${(endMinutes%60).toString().padStart(2, '0')}`}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          </div>
        </div>
          </>
        )}
      </div>

      <RoutineDetailsModal 
        isOpen={!!selectedRoutine}
        routine={selectedRoutine || null}
        dateStr={selectedRoutineId?.dateStr || ''}
        onClose={() => setSelectedRoutineId(null)}
      />
    </div>
  );
}
