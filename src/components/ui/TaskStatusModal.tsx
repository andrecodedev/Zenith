import React, { useState, useEffect, useRef } from 'react';
import { parseISO, format, subDays, addDays } from 'date-fns';
import { useStore } from '../../store/useStore';
import { X, CheckCircle2, Clock, AlertCircle, Circle, RefreshCcw, XCircle, Loader2, ChevronDown, Palmtree } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';
import type { Routine, TaskStatus } from '../../types';


interface TaskStatusModalProps {
  routine: Routine | null;
  dateStr: string | null;
  isOpen: boolean;
  onClose: () => void;
  timeStr?: string;
}

export function TaskStatusModal({ routine, dateStr, isOpen, onClose, timeStr }: TaskStatusModalProps) {
  const { taskInstances, setTaskStatus, updateRoutine, setTaskStatusForAll, addRoutine } = useStore();
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'auto'>('pending');
  const [note, setNote] = useState('');
  const [applyScope, setApplyScope] = useState<'current' | 'past' | 'future' | 'all'>('current');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);
  const [scopeDropdownRect, setScopeDropdownRect] = useState<DOMRect | null>(null);
  const scopeDropdownBtnRef = useRef<HTMLButtonElement>(null);
  
  // Track instance to get notes
  const instance = isOpen && routine && dateStr 
    ? taskInstances.find(t => t.routineId === routine.id && t.date === dateStr && (!timeStr || t.id.endsWith(`_${timeStr.replace(':', '')}`))) 
    : undefined;

  useEffect(() => {
    if (isOpen && routine && dateStr) {
      if (instance?.status) {
        setSelectedStatus(instance.status);
        setNote(instance.notes?.[instance.status] || instance.statusNote || '');
      } else if (routine.statusOverride) {
        setSelectedStatus(routine.statusOverride);
        setNote(routine.notesOverride || '');
      } else {
        // Se não tem status na instância nem global, está no modo Automático!
        setSelectedStatus('auto');
        setNote('');
      }
      setApplyScope('current');
      setShowSuccess(false);
    }
  }, [isOpen, routine, dateStr]);

  const handleStatusChange = (newStatus: TaskStatus | 'auto') => {
    setSelectedStatus(newStatus);
    if (newStatus !== 'auto') {
      setNote(instance?.notes?.[newStatus] || (instance?.status === newStatus ? instance?.statusNote : '') || '');
    } else {
      setNote('');
    }
  };

  if (!isOpen || !routine || !dateStr) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (applyScope === 'all') {
        await updateRoutine(routine.id, {
          statusOverride: selectedStatus === 'auto' ? undefined : selectedStatus,
          notesOverride: note || undefined
        });
        await setTaskStatusForAll(routine.id, selectedStatus === 'auto' ? undefined : selectedStatus, note, 'all', dateStr);
      } else if (applyScope === 'future') {
        const prevDayObj = subDays(parseISO(dateStr), 1);
        const prevDayStr = format(prevDayObj, 'yyyy-MM-dd');
        
        await updateRoutine(routine.id, {
          endDate: prevDayStr
        });
        
        await addRoutine({
          title: routine.title,
          description: routine.description,
          categoryId: routine.categoryId,
          recurrence: routine.recurrence,
          customDays: routine.customDays,
          date: routine.date,
          time: routine.time,
          endTime: routine.endTime,
          times: routine.times,
          excludedDates: routine.excludedDates,
          startDate: dateStr,
          statusOverride: selectedStatus === 'auto' ? undefined : selectedStatus,
          notesOverride: note || undefined
        });
      } else if (applyScope === 'past') {
        const nextDayObj = addDays(parseISO(dateStr), 1);
        const nextDayStr = format(nextDayObj, 'yyyy-MM-dd');
        
        await updateRoutine(routine.id, {
          startDate: nextDayStr
        });
        
        await addRoutine({
          title: routine.title,
          description: routine.description,
          categoryId: routine.categoryId,
          recurrence: routine.recurrence,
          customDays: routine.customDays,
          date: routine.date,
          time: routine.time,
          endTime: routine.endTime,
          times: routine.times,
          excludedDates: routine.excludedDates,
          endDate: dateStr,
          statusOverride: selectedStatus === 'auto' ? undefined : selectedStatus,
          notesOverride: note || undefined
        });
      } else {
        if (selectedStatus === 'auto') {
          await setTaskStatus(routine.id, dateStr, undefined as any, '', timeStr);
        } else {
          await setTaskStatus(routine.id, dateStr, selectedStatus, note, timeStr);
        }
      }
      
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 1500);
    } finally {
      setIsSaving(false);
    }
  };

  const statuses: { value: TaskStatus | 'auto'; label: string; icon: React.ElementType; color: string; bg: string }[] = [
    { value: 'completed', label: 'Concluído', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30' },
    { value: 'in_progress', label: 'Em Andamento', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/30' },
    { value: 'late', label: 'Em Atraso', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30' },
    { value: 'canceled', label: 'Cancelado', icon: XCircle, color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/30' },
    { value: 'vacation', label: 'Férias', icon: Palmtree, color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/30' },
    { value: 'pending', label: 'Pendente', icon: Circle, color: 'text-text-tertiary', bg: 'bg-elements border-border-gray' },
    { value: 'auto', label: 'Automático', icon: RefreshCcw, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/30' }
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-bg-secondary border border-border-base rounded-xl w-full max-w-sm shadow-2xl relative flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-border-base flex justify-between items-center bg-bg-secondary/50 shrink-0">
          <h2 className="text-lg font-bold text-text-primary">Status da Tarefa</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          <div>
            <div className="text-sm text-text-secondary mb-1">Tarefa {timeStr ? `(Horário: ${timeStr})` : ''}</div>
            <div className="font-medium text-text-primary truncate">{routine.title}</div>
          </div>

          <div className="flex items-center gap-1.5 text-sm font-medium text-text-secondary mb-2">
            Status
            <InfoTooltip>
              <strong className="text-text-primary block mb-1">Significado de cada status:</strong>
              ✅ Concluído — tarefa feita<br/>
              🕐 Em Andamento — está sendo executada<br/>
              🔴 Em Atraso — não foi feita no prazo<br/>
              🚫 Cancelado — não será feita<br/>
              ⬜ Pendente — aguardando execução<br/>
              🔄 Automático — calculado pelo horário
            </InfoTooltip>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {statuses.map((s) => {
              const Icon = s.icon;
              const isSelected = selectedStatus === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => handleStatusChange(s.value)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all cursor-pointer ${
                    isSelected ? s.bg : 'bg-bg-primary border-border-base hover:border-border-gray'
                  }`}
                >
                  <Icon size={24} className={`mb-2 ${isSelected ? s.color : 'text-text-tertiary'}`} />
                  <span className={`text-xs font-medium ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedStatus !== 'auto' && (
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-text-secondary mb-2">
                Observações
                <InfoTooltip>Anotações sobre este status — aparecem no painel expandido da tarefa. Use para justificativas, links ou contexto.</InfoTooltip>
              </label>
              <textarea 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Descreva o andamento, motivos do atraso, links úteis..."
                className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-border-gray focus:ring-1 focus:ring-border-gray transition-all resize-none"
                rows={3}
              />
            </div>
          )}

          {routine.recurrence !== 'once' && !timeStr && (
            <div className="flex flex-col gap-2 p-4 bg-bg-primary border border-border-base rounded-lg">
              <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                Escopo da Alteração
                <InfoTooltip>Define quais datas serão afetadas por esta mudança de status.</InfoTooltip>
              </label>
              <div className="relative">
                <button
                  ref={scopeDropdownBtnRef}
                  type="button"
                  onClick={() => {
                    if (!isScopeDropdownOpen && scopeDropdownBtnRef.current) {
                      setScopeDropdownRect(scopeDropdownBtnRef.current.getBoundingClientRect());
                    }
                    setIsScopeDropdownOpen(!isScopeDropdownOpen);
                  }}
                  className={`w-full bg-bg-secondary border rounded-lg pl-3 pr-4 py-2 text-sm text-text-primary transition-all flex justify-between items-center cursor-pointer ${isScopeDropdownOpen ? 'border-border-gray ring-1 ring-border-gray' : 'border-border-base hover:border-border-gray'}`}>
                  <span className="truncate pr-2">
                    {applyScope === 'current' ? `Somente nesta data (${dateStr})` :
                     applyScope === 'future' ? 'Desta data em diante (Futuro)' :
                     applyScope === 'past' ? 'Desta data para trás (Passado)' :
                     'Todas as datas (⚠️ Sobrescreve histórico)'}
                  </span>
                  <ChevronDown size={16} className={`shrink-0 text-text-tertiary transition-transform duration-200 ${isScopeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isScopeDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-60" onClick={() => setIsScopeDropdownOpen(false)} />
                    <div
                      style={scopeDropdownRect ? {
                        position: 'fixed',
                        top: scopeDropdownRect.bottom + 6,
                        left: scopeDropdownRect.left,
                        width: scopeDropdownRect.width,
                        zIndex: 61,
                        maxHeight: Math.min(192, window.innerHeight - scopeDropdownRect.bottom - 12),
                      } : {}}
                        className="bg-bg-secondary border border-border-base rounded-lg shadow-xl overflow-y-auto flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200"
                      >
                        {[
                          { value: 'current', label: `Somente nesta data (${dateStr})` },
                          { value: 'future', label: 'Desta data em diante (Futuro)' },
                          { value: 'past', label: 'Desta data para trás (Passado)' },
                          { value: 'all', label: 'Todas as datas (⚠️ Sobrescreve histórico)' },
                        ].map(option => (
                          <button key={option.value} type="button" onClick={() => { setApplyScope(option.value as any); setIsScopeDropdownOpen(false); }}
                            className={`w-full text-left px-4 py-3 text-sm transition-colors cursor-pointer ${applyScope === option.value ? 'text-text-primary bg-elements font-medium' : 'text-text-secondary hover:bg-elements hover:text-text-primary'}`}>
                            {option.label}
                          </button>
                        ))}
                      </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border-base bg-bg-secondary/50">
          <button 
            onClick={handleSave}
            disabled={showSuccess || isSaving}
            className={`w-full rounded-lg py-3 font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              showSuccess 
                ? 'bg-emerald-500/20 text-emerald-500 cursor-default' 
                : 'bg-btn-bg hover:bg-btn-hover active:bg-btn-active text-text-primary disabled:opacity-50 disabled:cursor-not-allowed'
            }`}>
            {isSaving ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Salvando...
              </>
            ) : showSuccess ? (
              <>
                <CheckCircle2 size={20} />
                Salvo com sucesso!
              </>
            ) : (
              'Salvar Alterações'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
