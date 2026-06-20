import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { X } from 'lucide-react';
import type { RecurrenceType } from '../../types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TaskModal({ isOpen, onClose }: TaskModalProps) {
  const { categories, addRoutine } = useStore();
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addRoutine({
      title: title.trim(),
      categoryId,
      recurrence,
      customDays: recurrence === 'custom' ? customDays : undefined,
    });

    setTitle('');
    setRecurrence('daily');
    setCustomDays([]);
    onClose();
  };

  const toggleDay = (day: number) => {
    setCustomDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
          <h2 className="text-xl font-bold">Nova Tarefa / Curso</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">Título da Tarefa</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Aula 01 - React Hooks"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">Categoria</label>
            <div className="grid grid-cols-3 gap-3">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    categoryId === cat.id 
                      ? `${cat.color} bg-opacity-20 border-${cat.color.split('-')[1]}-500 text-white` 
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">Repetição</label>
            <select 
              value={recurrence}
              onChange={e => setRecurrence(e.target.value as RecurrenceType)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all"
            >
              <option value="daily">Todos os dias</option>
              <option value="weekdays">Dias úteis (Seg-Sex)</option>
              <option value="weekends">Finais de semana</option>
              <option value="custom">Dias específicos</option>
            </select>
          </div>

          {recurrence === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Quais dias?</label>
              <div className="flex justify-between gap-1">
                {daysOfWeek.map((day, idx) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                      customDays.includes(idx)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-neutral-950 text-neutral-500 hover:bg-neutral-800'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4">
            <button 
              type="submit"
              disabled={!title.trim() || (recurrence === 'custom' && customDays.length === 0)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 font-bold transition-all"
            >
              Salvar Tarefa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
