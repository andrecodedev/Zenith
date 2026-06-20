import React from 'react';
import { useStore } from '../../store/useStore';
import { X, CheckCircle2, Circle, Clock, AlertCircle, Edit2 } from 'lucide-react';
import type { Routine, Category } from '../../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getCategoryStyles } from '../../utils/colors';
import { computeTaskStatus } from '../../utils/status';
import { TaskModal } from './TaskModal';
import { TaskStatusModal } from './TaskStatusModal';

interface RoutineDetailsModalProps {
  routine: Routine | null;
  dateStr: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RoutineDetailsModal({ routine, dateStr, isOpen, onClose }: RoutineDetailsModalProps) {
  const { categories, taskInstances, updateTaskNote } = useStore();
  const [isEditing, setIsEditing] = React.useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = React.useState(false);

  if (!isOpen || !routine || !dateStr) return null;

  const category = categories.find(c => c.id === routine.categoryId);
  const instance = taskInstances.find(t => t.routineId === routine.id && t.date === dateStr);
  
  const status = computeTaskStatus(routine, dateStr, instance);
  const isCompleted = status === 'completed';
  const isLate = status === 'late';
  const hasNote = !!instance?.statusNote;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-bg-secondary border border-border-base rounded-xl w-full max-w-md shadow-2xl relative flex flex-col">
        <div className="p-6 border-b border-border-base flex justify-between items-start bg-bg-secondary/50 rounded-t-2xl">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-3 mb-2">
              <button 
                onClick={() => setIsStatusModalOpen(true)}
                className="flex-shrink-0 transition-colors cursor-pointer hover:opacity-80"
              >
                {status === 'completed' && <CheckCircle2 size={28} className="text-emerald-500" />}
                {status === 'in_progress' && <Clock size={28} className="text-yellow-500" />}
                {status === 'late' && <AlertCircle size={28} className="text-red-500" />}
                {status === 'pending' && <Circle size={28} className="text-text-tertiary" />}
              </button>
              <h2 className="text-xl font-bold font-title text-white leading-tight">{routine.title}</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-1 rounded-sm inline-block ${getCategoryStyles(category?.color)}`}>
                {category?.name}
              </span>
              <span className="text-xs text-text-tertiary bg-bg-primary px-2 py-1 rounded-sm border border-border-base">
                {format(parseISO(dateStr), "dd 'de' MMM", { locale: ptBR })}
              </span>
              {routine.time && (
                <span className="text-xs text-text-secondary bg-elements px-2 py-1 rounded-sm border border-border-gray">
                  {routine.time}
                </span>
              )}
              {status === 'in_progress' && (
                <span className="text-xs px-2 py-1 rounded-sm inline-block bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                  Em andamento
                </span>
              )}
              {status === 'late' && (
                <span className="text-xs px-2 py-1 rounded-sm inline-block bg-red-500/10 text-red-500 border border-red-500/20">
                  Em atraso
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsEditing(true)} className="text-text-secondary hover:text-white transition-colors p-2 rounded-sm hover:bg-elements cursor-pointer">
              <Edit2 size={20} />
            </button>
            <button onClick={onClose} className="text-text-secondary hover:text-white transition-colors p-2 rounded-sm hover:bg-elements cursor-pointer">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="space-y-6">
            {routine.description ? (
              <div>
                <h3 className="text-sm font-medium text-text-secondary mb-2">Descrição</h3>
                <div className="bg-bg-primary border border-border-base rounded-lg p-4 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {routine.description}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-text-tertiary text-sm italic">
                Nenhuma descrição informada.
              </div>
            )}

            {(() => {
              const statusesConfig: Record<import('../../types').TaskStatus, { label: string, color: string, focusColor: string }> = {
                pending: { label: 'Observações (Pendente)', color: 'text-text-tertiary', focusColor: 'focus:border-neutral-500 focus:ring-neutral-500 border-border-base' },
                in_progress: { label: 'Observações (Andamento)', color: 'text-yellow-500', focusColor: 'focus:border-yellow-500 focus:ring-yellow-500 border-yellow-500/30' },
                completed: { label: 'Observações (Concluído)', color: 'text-emerald-500', focusColor: 'focus:border-emerald-500 focus:ring-emerald-500 border-emerald-500/30' },
                late: { label: 'Justificativa (Atraso)', color: 'text-red-500', focusColor: 'focus:border-red-500 focus:ring-red-500 border-red-500/30' }
              };

              const activeStatuses = [status];

              return activeStatuses.map(s => {
                const noteValue = instance?.notes?.[s] || (s === (instance?.status || 'pending') ? instance?.statusNote : '') || '';
                return (
                  <div key={s} className="mt-6">
                    <h3 className={`text-sm font-medium mb-2 ${statusesConfig[s].color}`}>
                      {statusesConfig[s].label}
                    </h3>
                    {noteValue ? (
                      <div className="bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                        {noteValue}
                      </div>
                    ) : (
                      <div className="text-text-tertiary text-sm italic py-2">
                        Nenhuma anotação.
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
      <TaskModal 
        isOpen={isEditing} 
        onClose={() => setIsEditing(false)} 
        initialData={routine} 
      />
      <TaskStatusModal
        isOpen={isStatusModalOpen}
        routine={routine}
        dateStr={dateStr}
        onClose={() => setIsStatusModalOpen(false)}
      />
    </div>
  );
}
