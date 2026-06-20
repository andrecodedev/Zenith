import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { X, CheckCircle2, Clock, AlertCircle, Circle } from 'lucide-react';
import type { Routine, TaskStatus } from '../../types';
import { computeTaskStatus } from '../../utils/status';

interface TaskStatusModalProps {
  routine: Routine | null;
  dateStr: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskStatusModal({ routine, dateStr, isOpen, onClose }: TaskStatusModalProps) {
  const { taskInstances, setTaskStatus } = useStore();
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>('pending');
  const [note, setNote] = useState('');
  
  // Track instance to get notes
  const instance = isOpen && routine && dateStr ? taskInstances.find(t => t.routineId === routine.id && t.date === dateStr) : undefined;

  useEffect(() => {
    if (isOpen && routine && dateStr) {
      const computed = computeTaskStatus(routine, dateStr, instance);
      const initialStatus = instance?.status || (computed === 'late' ? 'late' : computed);
      setSelectedStatus(initialStatus);
      // Try notes[initialStatus] first, fallback to legacy statusNote if matching status
      setNote(instance?.notes?.[initialStatus] || (instance?.status === initialStatus ? instance?.statusNote : '') || '');
    }
  }, [isOpen, routine, dateStr]);

  // When changing status tab, load the existing note for that status
  const handleStatusChange = (newStatus: TaskStatus) => {
    setSelectedStatus(newStatus);
    setNote(instance?.notes?.[newStatus] || (instance?.status === newStatus ? instance?.statusNote : '') || '');
  };

  if (!isOpen || !routine || !dateStr) return null;

  const handleSave = () => {
    setTaskStatus(routine.id, dateStr, selectedStatus, note);
    onClose();
  };

  const statuses: { value: TaskStatus; label: string; icon: React.ElementType; color: string; bg: string }[] = [
    { value: 'completed', label: 'Concluído', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30' },
    { value: 'in_progress', label: 'Em Andamento', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/30' },
    { value: 'late', label: 'Em Atraso', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30' },
    { value: 'pending', label: 'Pendente', icon: Circle, color: 'text-text-tertiary', bg: 'bg-elements border-border-gray' }
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
        </div>

        <div className="p-5 border-t border-border-base bg-bg-secondary/50">
          <button 
            onClick={handleSave}
            className="w-full bg-btn-bg hover:bg-btn-hover active:bg-btn-active text-text-primary rounded-lg py-3 font-bold transition-all cursor-pointer"
          >
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}
