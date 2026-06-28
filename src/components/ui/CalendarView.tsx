import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { generateCalendarWeek, isTaskDueToday } from '../../utils/date';
import { ChevronLeft, ChevronRight, ChevronDown, Calendar, X } from 'lucide-react';
import { computeTaskStatus } from '../../utils/status';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getCategoryStyles } from '../../utils/colors';
import { RoutineDetailsModal } from './RoutineDetailsModal';
import type { Routine, TaskStatus } from '../../types';

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
    case 'vacation': return 'bg-orange-500';
    default: return 'bg-neutral-500';
  }
};

const HOUR_HEIGHT = 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MAX_VIS = 4; // máximo de eventos visíveis por cluster antes de colapsar em pill

type CalEvent = {
  key: string;
  routine: Routine;
  slotTime: string;
  isMultiSlot: boolean;
  startMinutes: number;
  endMinutes: number;
};

type CalEventPos = CalEvent & { col: number; totalCols: number };

// Componentes conexos do grafo de sobreposição (closure transitiva de A↔B↔C)
function findTimeClusters<T extends { key: string; startMinutes: number; endMinutes: number }>(
  events: T[]
): T[][] {
  const clusters: T[][] = [];
  const visited = new Set<string>();
  for (const ev of events) {
    if (visited.has(ev.key)) continue;
    const cluster: T[] = [ev];
    visited.add(ev.key);
    let changed = true;
    while (changed) {
      changed = false;
      for (const other of events) {
        if (visited.has(other.key)) continue;
        if (cluster.some(e => e.startMinutes < other.endMinutes && e.endMinutes > other.startMinutes)) {
          cluster.push(other);
          visited.add(other.key);
          changed = true;
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

// Distribui eventos sobrepostos em colunas lado a lado
function assignColumns<T extends { key: string; startMinutes: number; endMinutes: number }>(
  events: T[]
): (T & { col: number; totalCols: number })[] {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes);
  const colEnds: number[] = [];
  const withCols = sorted.map(ev => {
    let col = colEnds.findIndex(t => t <= ev.startMinutes);
    if (col === -1) { col = colEnds.length; colEnds.push(0); }
    colEnds[col] = ev.endMinutes;
    return { ...ev, col };
  });
  return withCols.map(ev => {
    const overlapping = withCols.filter(e =>
      e.startMinutes < ev.endMinutes && e.endMinutes > ev.startMinutes
    );
    const totalCols = overlapping.reduce((max, e) => Math.max(max, e.col + 1), 1);
    return { ...ev, totalCols };
  });
}

export function CalendarView({ selectedDate, onNavigate, onSelectDate }: CalendarViewProps) {
  const { routines, categories, taskInstances } = useStore();
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [selectedRoutineId, setSelectedRoutineId] = useState<{ id: string, dateStr: string, timeStr?: string } | null>(null);
  const [overflowGroup, setOverflowGroup] = useState<{ events: CalEvent[]; dateStr: string } | null>(null);
  
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
    <div className="flex flex-col h-full min-h-0 bg-bg-primary px-4">
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
          <div className="flex-1 flex flex-col min-w-[1400px]">
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
                            className={`px-1.5 py-1 text-xs rounded truncate cursor-pointer transition-transform hover:scale-[1.02] flex items-center gap-1 ${isCompleted ? 'opacity-50 line-through bg-bg-secondary' : 'bg-bg-secondary border border-border-base/50'}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusColor(status)}`} />
                            {routine.time && <span className="font-bold">{routine.time}</span>}
                            <span>{routine.title}</span>
                          </div>
                        );
                      })}
                      {dayRoutines.length > 4 && (
                        <div className="text-xs text-text-tertiary text-center cursor-pointer hover:text-text-primary mt-1">
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
            <div className={`flex border-b border-border-base shrink-0 ${viewMode === 'day' ? 'w-full' : 'w-full min-w-[1800px]'}`}>
              <div className="w-16 shrink-0 border-r border-border-base bg-bg-primary" />
              <div className="flex-1 flex">
                {currentDays.map(({ dateStr, dayName, dayNumber }) => {
                  const isTodaysDate = dateStr === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <div key={dateStr} className="flex-1 text-center py-3 border-r border-border-base last:border-r-0 min-w-[240px]">
                      <div className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-1">{dayName}</div>
                      <div className={`text-2xl font-bold font-title inline-flex items-center justify-center w-10 h-10 rounded-full ${isTodaysDate ? 'bg-btn-bg text-text-primary' : 'text-text-primary'}`}>
                        {dayNumber}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

        {/* All Day Section. só tarefas sem horário E sem times[] */}
        {currentDays.some(({ dateStr }) => routines.some(r => isTaskDueToday(r, dateStr) && !r.time && !r.times?.length)) && (
          <div className={`flex border-b border-border-base shrink-0 ${viewMode === 'day' ? 'w-full' : 'w-full min-w-[1800px]'}`}>
            <div className="w-16 shrink-0 border-r border-border-base bg-bg-primary flex flex-col justify-center items-center text-[10px] text-text-tertiary font-medium">
              o dia todo
            </div>
            <div className="flex-1 flex">
              {currentDays.map(({ dateStr }) => {
                const allDayRoutines = routines.filter(r => isTaskDueToday(r, dateStr) && !r.time && !r.times?.length);
                return (
                  <div key={dateStr} className="flex-1 p-1 border-r border-border-base last:border-r-0 min-h-[40px] flex flex-col gap-1 min-w-[240px]">
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
          </div>
        )}

        {/* Scrollable Timeline Grid */}
        <div className={`flex-1 overflow-y-auto relative hide-scrollbar ${viewMode === 'day' ? 'w-full' : 'w-full min-w-[1800px]'}`} ref={gridRef}>
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

            {/* Day Columns. pool unificado, estilo Google Calendar */}
            {currentDays.map(({ dateStr }) => {
              // Pool único: eventos com horário + slots de múltiplos horários
              const allEvs = [
                ...routines
                  .filter(r => isTaskDueToday(r, dateStr) && r.time)
                  .map(r => ({
                    key: r.id,
                    routine: r,
                    slotTime: r.time!,
                    isMultiSlot: false as const,
                    startMinutes: parseTimeToMinutes(r.time!),
                    endMinutes: r.endTime
                      ? parseTimeToMinutes(r.endTime)
                      : parseTimeToMinutes(r.time!) + 60,
                  })),
                ...routines
                  .filter(r => isTaskDueToday(r, dateStr) && !r.time && !!r.times?.length)
                  .flatMap(r =>
                    (r.times || []).map(slotTime => ({
                      key: `${r.id}_${dateStr}_${slotTime}`,
                      routine: r,
                      slotTime,
                      isMultiSlot: true as const,
                      startMinutes: parseTimeToMinutes(slotTime),
                      endMinutes: parseTimeToMinutes(slotTime) + 45,
                    }))
                  ),
              ];

              // Agrupa por componente conexo e limita visíveis por cluster
              const clusters = findTimeClusters(allEvs);
              const visibleEvs: CalEventPos[] = [];
              const overflowClusters: { overflow: CalEvent[]; all: CalEvent[]; startMin: number; endMin: number }[] = [];

              for (const cluster of clusters) {
                const sorted = [...cluster].sort((a, b) => a.startMinutes - b.startMinutes);
                if (sorted.length <= MAX_VIS) {
                  (assignColumns(sorted) as CalEventPos[]).forEach(ev => visibleEvs.push(ev));
                } else {
                  // Primeiros MAX_VIS - 1 em colunas fixas; restantes no pill
                  sorted.slice(0, MAX_VIS - 1).forEach((ev, idx) => {
                    visibleEvs.push({ ...ev, col: idx, totalCols: MAX_VIS });
                  });
                  const hide = sorted.slice(MAX_VIS - 1);
                  overflowClusters.push({
                    overflow: hide,
                    all: sorted,
                    startMin: Math.min(...hide.map(e => e.startMinutes)),
                    endMin: Math.max(...hide.map(e => e.endMinutes)),
                  });
                }
              }

              return (
                <div key={dateStr} className="flex-1 relative border-r border-border-base/30 last:border-r-0 min-w-[240px]">
                  {visibleEvs.map(ev => {
                    const leftPct = (ev.col / ev.totalCols) * 100;
                    const widthPct = (1 / ev.totalCols) * 100;
                    const { startMinutes, endMinutes } = ev;
                    const duration = endMinutes - startMinutes;

                    const category = categories.find(c => c.id === ev.routine.categoryId);
                    const styleClass = getCategoryStyles(category?.color);

                    const slotId = ev.isMultiSlot ? `${ev.routine.id}_${dateStr}_${ev.slotTime.replace(':', '')}` : undefined;
                    const instance = ev.isMultiSlot
                      ? taskInstances.find(t => t.id === slotId)
                      : taskInstances.find(t => t.routineId === ev.routine.id && t.date === dateStr);

                    const status = ev.isMultiSlot
                      ? (instance?.completed ? 'completed' : 'pending')
                      : computeTaskStatus(ev.routine, dateStr, instance);

                    const isCompleted = status === 'completed' || status === 'canceled';

                    return (
                      <div
                        key={ev.key}
                        onClick={() => setSelectedRoutineId({ id: ev.routine.id, dateStr, timeStr: ev.isMultiSlot ? ev.slotTime : undefined })}
                        className={`absolute rounded-md px-2 py-1 overflow-hidden cursor-pointer transition-all hover:brightness-110 hover:shadow-md z-10 flex flex-col justify-start ${styleClass} ${isCompleted ? 'opacity-50' : ''}`}
                        style={{
                          top: `${startMinutes}px`,
                          height: `${Math.max(duration, 48)}px`,
                          left: `calc(${leftPct}% + 1px)`,
                          width: `calc(${widthPct}% - 2px)`,
                        }}
                      >
                        <p className="text-[10px] opacity-80 leading-none mb-0.5 shrink-0">
                          {ev.slotTime.slice(0, 5)}{ev.routine.endTime && !ev.isMultiSlot ? ` - ${ev.routine.endTime.slice(0,5)}` : ''}
                        </p>
                        <p className={`text-xs font-bold leading-tight truncate ${isCompleted ? 'line-through' : ''}`}>
                          {ev.routine.title}
                        </p>
                      </div>
                    );
                  })}

                  {/* Pill de overflow. compacto, posicionado no início do overflow */}
                  {overflowClusters.map((cl, ci) => (
                    <div
                      key={`overflow-${ci}`}
                      onClick={() => setOverflowGroup({ events: cl.all, dateStr })}
                      className="absolute rounded-md cursor-pointer z-20 flex flex-col items-center justify-center gap-0.5 bg-bg-secondary/90 border border-border-gray hover:bg-elements hover:border-neutral-500 transition-all"
                      style={{
                        top: `${cl.startMin}px`,
                        height: '44px',
                        left: `calc(${((MAX_VIS - 1) / MAX_VIS) * 100}% + 1px)`,
                        width: `calc(${(1 / MAX_VIS) * 100}% - 2px)`,
                      }}
                    >
                      <span className="text-sm font-bold text-text-primary leading-none">+{cl.overflow.length}</span>
                      <span className="text-[9px] text-text-tertiary leading-none">ver mais</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Modal de overflow. lista todos os eventos colapsados no horário */}
      {overflowGroup && (
        <div
          className="fixed inset-0 z-100 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOverflowGroup(null)}
        >
          <div
            className="bg-bg-secondary border border-border-base rounded-xl w-full max-w-sm shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-bold text-text-primary text-sm">Tarefas neste horário</h3>
                <p className="text-text-tertiary text-xs mt-0.5">{overflowGroup.events.length} no total</p>
              </div>
              <button
                onClick={() => setOverflowGroup(null)}
                className="text-text-tertiary hover:text-text-primary cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
              {overflowGroup.events.map(ev => {
                const instance = ev.isMultiSlot
                  ? taskInstances.find(t => t.id === `${ev.routine.id}_${overflowGroup.dateStr}_${ev.slotTime.replace(':', '')}`)
                  : taskInstances.find(t => t.routineId === ev.routine.id && t.date === overflowGroup.dateStr);
                const status = ev.isMultiSlot
                  ? (instance?.completed ? 'completed' : 'pending')
                  : computeTaskStatus(ev.routine, overflowGroup.dateStr, instance);
                const category = categories.find(c => c.id === ev.routine.categoryId);

                return (
                  <div
                    key={ev.key}
                    onClick={() => {
                      setOverflowGroup(null);
                      setSelectedRoutineId({ id: ev.routine.id, dateStr: overflowGroup.dateStr, timeStr: ev.isMultiSlot ? ev.slotTime : undefined });
                    }}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-border-base hover:bg-elements cursor-pointer transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor(status)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-text-primary text-xs font-medium wrap-break-word leading-snug">{ev.routine.title}</p>
                      <p className="text-text-tertiary text-[10px] mt-0.5">{ev.slotTime.slice(0, 5)}</p>
                    </div>
                    {category && (
                      <span className={`text-[10px] shrink-0 px-1.5 py-0.5 rounded-sm truncate max-w-[60px] ${getCategoryStyles(category.color)}`}>
                        {category.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <RoutineDetailsModal
        isOpen={!!selectedRoutine}
        routine={selectedRoutine || null}
        dateStr={selectedRoutineId?.dateStr || ''}
        timeStr={selectedRoutineId?.timeStr}
        onClose={() => setSelectedRoutineId(null)}
      />
    </div>
  );
}
