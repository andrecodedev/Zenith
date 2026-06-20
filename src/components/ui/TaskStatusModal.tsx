import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { X, CheckCircle2, Clock, AlertCircle, Circle, RefreshCcw, XCircle, Loader2 } from 'lucide-react';
import type { Routine, TaskStatus } from '../../types';


interface TaskStatusModalProps {
  routine: Routine | null;
  dateStr: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskStatusModal({ routine, dateStr, isOpen, onClose }: TaskStatusModalProps) {
  const { taskInstances, setTaskStatus, updateRoutine, setTaskStatusForAll } = useStore();
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'auto'>('pending');
  const [note, setNote] = useState('');
  const [applyToAll, setApplyToAll] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Track instance to get notes
  const instance = isOpen && routine && dateStr ? taskInstances.find(t => t.routineId === routine.id && t.date === dateStr) : undefined;

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
      setApplyToAll(false);
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
      if (applyToAll) {
        await updateRoutine(routine.id, {
          statusOverride: selectedStatus === 'auto' ? undefined : selectedStatus,
          notesOverride: note || undefined
        });
        // Clear/Update all existing instances so the db is in sync
        await setTaskStatusForAll(routine.id, selectedStatus === 'auto' ? undefined : selectedStatus, note);
      } else {
        if (selectedStatus === 'auto') {
          // Clear instance status to let the system compute it
          await setTaskStatus(routine.id, dateStr, undefined as any, '');
        } else {
          await setTaskStatus(routine.id, dateStr, selectedStatus, note);
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
      <div className="bg-bg-secondary border border-border-base rounded-xl w-full max-w-sm shadow-2xl relative flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-border-base flex justify-between items-center bg-bg-secondary/50">
          <h2 className="text-lg font-bold text-text-primary">Status da Tarefa</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <div className="text-sm text-text-secondary mb-1">Tarefa</div>
            <div className="font-medium text-text-primary truncate">{routine.title}</div>
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
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Observações (opcional)
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

          {routine.recurrence !== 'once' && (
            <div className="flex items-center gap-3 p-3 bg-bg-primary border border-border-base rounded-lg">
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                />
                <div className="w-9 h-5 bg-elements peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-primary after:border-border-gray after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
              <span className="text-sm font-medium text-text-primary">Aplicar a todas as datas</span>
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
