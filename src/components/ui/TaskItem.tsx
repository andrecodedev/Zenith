import { useState, useRef, useEffect } from 'react';
import { ChevronDown, CheckCircle2, Circle, Clock, AlertCircle, Edit2 } from 'lucide-react';
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
  

  const status = computeTaskStatus(routine, dateStr, taskInstance);
  const isCompleted = status === 'completed';
  const isLate = status === 'late';
  const hasNote = !!taskInstance?.statusNote;
  const hasDetails = routine.description || isLate || hasNote;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (itemRef.current && !itemRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  return (
    <>
      <div ref={itemRef} className={`rounded-lg border transition-all overflow-hidden ${
        status === 'completed' 
        ? 'bg-bg-secondary/50 border-border-base/50 opacity-50' 
        : 'bg-bg-secondary border-border-gray hover:border-neutral-500'
    }`}>
      <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={onToggle}>
        <button className="flex-shrink-0 transition-colors">
          {status === 'completed' && <CheckCircle2 size={24} className="text-emerald-500" />}
          {status === 'in_progress' && <Clock size={24} className="text-yellow-500" />}
          {status === 'late' && <AlertCircle size={24} className="text-red-500" />}
          {status === 'pending' && <Circle size={24} className="text-text-tertiary" />}
        </button>
        
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium truncate ${isCompleted ? 'line-through text-text-tertiary' : 'text-text-primary'}`}>
            {routine.title}
          </h3>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-sm inline-block ${getCategoryStyles(category?.color)}`}>
              {category?.name}
            </span>
            {routine.time && (
              <span className="text-xs px-2 py-1 rounded-sm inline-block bg-elements text-text-secondary border border-border-gray">
                {routine.time}
              </span>
            )}
            {status === 'completed' && (
              <span className="text-xs px-2 py-1 rounded-sm inline-block bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Concluído
              </span>
            )}
            {status === 'pending' && (
              <span className="text-xs px-2 py-1 rounded-sm inline-block bg-elements text-text-secondary border border-border-gray">
                Pendente
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

        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="p-1.5 bg-elements/50 hover:bg-elements rounded-sm text-text-secondary hover:text-text-primary transition-all cursor-pointer"
          >
            <Edit2 size={16} />
          </button>
          
          {hasDetails && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-1.5 bg-elements/50 hover:bg-elements rounded-sm text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            >
              <ChevronDown size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {hasDetails && (
        <div 
          className={`px-4 pb-4 text-sm text-text-secondary border-t border-border-base/50 pt-3 transition-all duration-300 ${
            isExpanded ? 'block animate-in slide-in-from-top-2 opacity-100' : 'hidden opacity-0'
          }`}
        >
          {routine.description && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-text-tertiary mb-1 uppercase tracking-wider">Descrição</h4>
              <p>{routine.description}</p>
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
              const noteValue = taskInstance?.notes?.[s] || (s === (taskInstance?.status || 'pending') ? taskInstance?.statusNote : '') || '';
              return (
                <div key={s} className="mt-4">
                  <h4 className={`text-xs font-semibold mb-1 uppercase tracking-wider ${statusesConfig[s].color}`}>
                    {statusesConfig[s].label}
                  </h4>
                  {noteValue ? (
                    <div className="bg-bg-primary border border-border-base rounded-lg px-3 py-2 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
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
