import { useState, useRef, useEffect } from 'react';
import { ChevronDown, CheckCircle2, Circle, Clock, AlertCircle, Edit2, RefreshCcw, XCircle } from 'lucide-react';
import { getCategoryStyles } from '../../utils/colors';
import { computeTaskStatus } from '../../utils/status';
import { useStore } from '../../store/useStore';
import type { Routine, Category, TaskInstance } from '../../types';
import { TaskModal } from './TaskModal';

interface TaskItemProps {
  routine: Routine;
  category?: Category;
  dateStr: string;
  taskInstance?: TaskInstance;
  onToggle: () => void;
}

export function TaskItem({ routine, category, dateStr, taskInstance, onToggle }: TaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const taskInstances = useStore(s => s.taskInstances);
  const toggleTimeSlot = useStore(s => s.toggleTimeSlot);

  const isMultipleTimes = routine.recurrence === 'multiple_times';
  const times = routine.times || [];

  // Instâncias de cada slot de horário
  const slotInstances = isMultipleTimes
    ? times.map(t => {
        const slotId = `${routine.id}_${dateStr}_${t.replace(':', '')}`;
        return taskInstances.find(ti => ti.id === slotId) ?? null;
      })
    : [];

  const completedCount = slotInstances.filter(si => si?.completed).length;
  const totalCount = times.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const status = isMultipleTimes
    ? completedCount === totalCount && totalCount > 0
      ? 'completed'
      : completedCount > 0
      ? 'in_progress'
      : 'pending'
    : computeTaskStatus(routine, dateStr, taskInstance);

  const isCompleted = status === 'completed';
  const isLate = status === 'late';
  const hasNote = !!taskInstance?.statusNote;
  const hasDetails = isMultipleTimes || routine.description || isLate || hasNote;

  const isAutomatic = !isMultipleTimes && !taskInstance?.status && !routine.statusOverride && !taskInstance?.completed;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (itemRef.current && !itemRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };
    if (isExpanded) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  const handleRowClick = () => {
    if (isMultipleTimes) {
      setIsExpanded(prev => !prev);
    } else {
      onToggle();
    }
  };

  return (
    <>
      <div ref={itemRef} className={`rounded-lg border transition-all overflow-hidden ${
        status === 'completed' || status === 'canceled'
          ? 'bg-bg-secondary/50 border-border-base/50 opacity-50'
          : 'bg-bg-secondary border-border-gray hover:border-neutral-500'
      }`}>
        <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={handleRowClick}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="shrink-0 transition-colors cursor-pointer"
          >
            {status === 'completed' && <CheckCircle2 size={24} className="text-emerald-500" />}
            {status === 'in_progress' && <Clock size={24} className="text-yellow-500" />}
            {status === 'late' && <AlertCircle size={24} className="text-red-500" />}
            {status === 'pending' && <Circle size={24} className="text-text-tertiary" />}
            {status === 'canceled' && <XCircle size={24} className="text-purple-500" />}
          </button>

          <div className="flex-1 min-w-0">
            <h3 className={`font-medium truncate ${(isCompleted || status === 'canceled') ? 'line-through text-text-tertiary' : 'text-text-primary'}`}>
              {routine.title}
            </h3>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {isAutomatic && (
                <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-sm bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <RefreshCcw size={12} />
                  Automático
                </span>
              )}
              <span className={`text-xs px-2 py-1 rounded-sm inline-block ${getCategoryStyles(category?.color)}`}>
                {category?.name}
              </span>
              {isMultipleTimes ? (
                <span className={`text-xs px-2 py-1 rounded-sm inline-block border ${
                  completedCount === totalCount
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : completedCount > 0
                    ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                    : 'bg-elements text-text-secondary border-border-gray'
                }`}>
                  {completedCount}/{totalCount} completos
                </span>
              ) : (
                <>
                  {routine.time && (
                    <span className="text-xs px-2 py-1 rounded-sm inline-block bg-elements text-text-secondary border border-border-gray">
                      {routine.time.slice(0, 5)}{routine.endTime ? ` - ${routine.endTime.slice(0, 5)}` : ''}
                    </span>
                  )}
                  {status === 'completed' && (
                    <span className="text-xs px-2 py-1 rounded-sm inline-block bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Concluído</span>
                  )}
                  {status === 'pending' && (
                    <span className="text-xs px-2 py-1 rounded-sm inline-block bg-elements text-text-secondary border border-border-gray">Pendente</span>
                  )}
                  {status === 'in_progress' && (
                    <span className="text-xs px-2 py-1 rounded-sm inline-block bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">Em andamento</span>
                  )}
                  {status === 'late' && (
                    <span className="text-xs px-2 py-1 rounded-sm inline-block bg-red-500/10 text-red-500 border border-red-500/20">Atrasado</span>
                  )}
                  {status === 'canceled' && (
                    <span className="text-xs px-2 py-1 rounded-sm inline-block bg-purple-500/10 text-purple-500 border border-purple-500/20">Cancelado</span>
                  )}
                </>
              )}
            </div>

            {/* Barra de progresso — só para multiple_times */}
            {isMultipleTimes && totalCount > 0 && (
              <div className="mt-2 h-1.5 rounded-full bg-bg-primary overflow-hidden w-full max-w-[160px]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progressPct === 100 ? 'bg-emerald-500' : 'bg-yellow-500'}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              className="p-1.5 bg-elements/50 hover:bg-elements rounded-sm text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            >
              <Edit2 size={16} />
            </button>
            {hasDetails && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                className="p-1.5 bg-elements/50 hover:bg-elements rounded-sm text-text-secondary hover:text-text-primary transition-all cursor-pointer"
              >
                <ChevronDown size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {hasDetails && (
          <div className={`px-4 pb-4 text-sm text-text-secondary border-t border-border-base/50 pt-3 transition-all duration-300 ${
            isExpanded ? 'block animate-in slide-in-from-top-2 opacity-100' : 'hidden opacity-0'
          }`}>

            {/* Slots de horário */}
            {isMultipleTimes && times.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-semibold text-text-tertiary mb-2 uppercase tracking-wider">Horários</h4>
                <div className="space-y-2">
                  {times.map((t, idx) => {
                    const slotDone = slotInstances[idx]?.completed ?? false;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTimeSlot(routine.id, dateStr, t)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer text-left ${
                          slotDone
                            ? 'bg-emerald-500/10 border-emerald-500/20 opacity-70'
                            : 'bg-bg-primary border-border-base hover:border-border-gray hover:bg-elements'
                        }`}
                      >
                        <span className={`shrink-0 transition-colors ${slotDone ? 'text-emerald-500' : 'text-text-tertiary'}`}>
                          {slotDone
                            ? <CheckCircle2 size={18} />
                            : <Circle size={18} />}
                        </span>
                        <span className={`text-sm font-medium ${slotDone ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                          {t}
                        </span>
                        <span className="ml-auto text-xs text-text-tertiary">
                          {slotDone ? 'Feito' : 'Pendente'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {routine.description && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-text-tertiary mb-1 uppercase tracking-wider">Descrição</h4>
                <p>{routine.description}</p>
              </div>
            )}

            {!isMultipleTimes && (() => {
              const statusesConfig: Record<import('../../types').TaskStatus, { label: string, color: string }> = {
                pending: { label: 'Observações (Pendente)', color: 'text-text-tertiary' },
                in_progress: { label: 'Observações (Andamento)', color: 'text-yellow-500' },
                completed: { label: 'Observações (Concluído)', color: 'text-emerald-500' },
                late: { label: 'Justificativa (Atraso)', color: 'text-red-500' },
                canceled: { label: 'Motivo (Cancelado)', color: 'text-purple-500' },
              };
              const noteValue = taskInstance?.notes?.[status] || taskInstance?.statusNote || '';
              return (
                <div className="mt-4">
                  <h4 className={`text-xs font-semibold mb-1 uppercase tracking-wider ${statusesConfig[status].color}`}>
                    {statusesConfig[status].label}
                  </h4>
                  {noteValue ? (
                    <div className="bg-bg-primary border border-border-base rounded-lg px-3 py-2 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {noteValue}
                    </div>
                  ) : (
                    <div className="text-text-tertiary text-sm italic py-2">Nenhuma anotação.</div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <TaskModal
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        initialData={routine}
      />
    </>
  );
}
