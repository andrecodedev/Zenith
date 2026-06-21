import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { X, Search, ChevronDown, Square, CheckSquare, Settings2 } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';
import { getCategoryStyles } from '../../utils/colors';
import type { TaskStatus } from '../../types';

interface BulkEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function CustomSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: {value: string, label: string}[], placeholder: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (!isOpen && btnRef.current) setRect(btnRef.current.getBoundingClientRect());
          setIsOpen(!isOpen);
        }}
        className={`w-full bg-elements border rounded-lg pl-3 pr-4 py-2 text-sm text-text-primary transition-all flex justify-between items-center cursor-pointer ${isOpen ? 'border-border-gray ring-1 ring-border-gray' : 'border-border-base hover:border-border-gray'}`}
      >
        <span className="truncate pr-2">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-text-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
          <div
            style={rect ? {
              position: 'fixed',
              top: rect.bottom + 6,
              left: rect.left,
              width: rect.width,
              zIndex: 61,
              maxHeight: 250,
            } : {}}
            className="bg-bg-secondary border border-border-base rounded-lg shadow-xl overflow-y-auto flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {options.map(option => (
              <button key={option.value} type="button" onClick={() => { onChange(option.value); setIsOpen(false); }}
                className={`w-full text-left px-4 py-3 text-sm transition-colors cursor-pointer ${value === option.value ? 'text-text-primary bg-elements font-medium' : 'text-text-secondary hover:bg-elements hover:text-text-primary'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function BulkEditorModal({ isOpen, onClose }: BulkEditorModalProps) {
  const { routines, categories, deleteRoutine, updateRoutine } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Ações
  const [actionType, setActionType] = useState<'none' | 'delete' | 'time' | 'category' | 'status'>('none');
  const [newTime, setNewTime] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newStatus, setNewStatus] = useState<TaskStatus | 'automatic'>('automatic');

  const filteredRoutines = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const q = normalize(searchQuery);
    
    return routines.filter(r => normalize(r.title).includes(q));
  }, [routines, searchQuery]);

  const allSelected = filteredRoutines.length > 0 && selectedIds.size === filteredRoutines.length;

  if (!isOpen) return null;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRoutines.map(r => r.id)));
    }
  };

  const toggleItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const executeApply = () => {
    if (selectedIds.size === 0) return;

    if (actionType === 'delete') {
      Array.from(selectedIds).forEach(id => deleteRoutine(id));
    } else if (actionType === 'time') {
      Array.from(selectedIds).forEach(id => {
        updateRoutine(id, { time: newTime || undefined });
      });
    } else if (actionType === 'category') {
      if (!newCategoryId) return;
      Array.from(selectedIds).forEach(id => {
        updateRoutine(id, { categoryId: newCategoryId });
      });
    } else if (actionType === 'status') {
      Array.from(selectedIds).forEach(id => {
        updateRoutine(id, { statusOverride: newStatus === 'automatic' ? undefined : newStatus });
      });
    }

    setSelectedIds(new Set());
    setActionType('none');
    setShowConfirmModal(false);
  };

  const handleApplyClick = () => {
    if (selectedIds.size === 0) return;
    
    // Se não for delete, validar campos obrigatórios
    if (actionType === 'category' && !newCategoryId) return;
    
    setShowConfirmModal(true);
  };
  const actionOptions = [
    { value: 'none', label: 'Selecione uma ação...' },
    { value: 'status', label: 'Alterar Status Base' },
    { value: 'time', label: 'Alterar Horário' },
    { value: 'category', label: 'Alterar Categoria' },
    { value: 'delete', label: 'Excluir Tarefas' },
  ];

  const statusOptions = [
    { value: 'pending', label: 'Pendente (Requer check)' },
    { value: 'automatic', label: 'Automático (Tempo dita o status)' },
    { value: 'in_progress', label: 'Em Andamento' },
    { value: 'completed', label: 'Concluído' },
    { value: 'late', label: 'Atrasado' },
    { value: 'canceled', label: 'Cancelado' },
    { value: 'vacation', label: 'Férias' },
  ];

  const categoryOptions = [
    { value: '', label: 'Selecione a categoria...' },
    ...categories.map(c => ({ value: c.id, label: c.name }))
  ];

  const getConfirmationMessage = () => {
    const count = selectedIds.size;
    switch (actionType) {
      case 'delete':
        return `Você está prestes a EXCLUIR ${count} tarefa(s). Esta ação apagará permanentemente o registro e todo o histórico dessas tarefas. Isso NÃO pode ser desfeito.`;
      case 'status':
        const statusLabel = statusOptions.find(o => o.value === newStatus)?.label || newStatus;
        return `Você vai alterar o status base de ${count} tarefa(s) para "${statusLabel}". Para reverter depois, você precisará selecionar essas tarefas de novo e aplicar o status anterior.`;
      case 'category':
        const catLabel = categoryOptions.find(o => o.value === newCategoryId)?.label || 'Sem Categoria';
        return `Você vai mover ${count} tarefa(s) para a categoria "${catLabel}". Para reverter depois, você precisará selecionar essas tarefas de novo e voltar para a categoria original.`;
      case 'time':
        return `Você vai alterar o horário de ${count} tarefa(s) para ${newTime || 'Nenhum horário'}. Para reverter depois, você precisará aplicar o horário original manualmente.`;
      default:
        return '';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !showConfirmModal) onClose();
      }}
    >
      <div className="bg-bg-secondary border border-border-base rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Overlay de Confirmação */}
        {showConfirmModal && (
          <div className="absolute inset-0 bg-bg-secondary/95 backdrop-blur-md z-[70] flex items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="max-w-md w-full space-y-6">
              <div>
                <h3 className={`text-xl font-bold font-title mb-2 ${actionType === 'delete' ? 'text-red-500' : 'text-text-primary'}`}>
                  {actionType === 'delete' ? 'Excluir em Massa' : 'Confirmação de Ação em Lote'}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {getConfirmationMessage()}
                </p>
              </div>
              <div className="space-y-3">
                <button 
                  onClick={executeApply} 
                  className={`w-full rounded-lg py-3 font-bold transition-colors cursor-pointer ${
                    actionType === 'delete' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-bg-primary'
                  }`}
                >
                  Sim, aplicar em {selectedIds.size} itens
                </button>
                <button 
                  onClick={() => setShowConfirmModal(false)} 
                  className="w-full bg-elements hover:bg-elements-hover text-text-primary rounded-lg py-3 font-medium transition-colors cursor-pointer"
                >
                  Cancelar e Voltar
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="p-6 border-b border-border-base flex justify-between items-center bg-bg-secondary/50 shrink-0">
          <div>
            <h2 className="text-xl font-bold font-title flex items-center gap-2 text-text-primary">
              <Settings2 size={24} /> 
              Configuração Global (Lote)
            </h2>
            <p className="text-xs text-text-tertiary mt-1">Busque, selecione e aplique ações em múltiplas tarefas de uma vez.</p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer p-2 rounded-lg hover:bg-elements">
            <X size={20} />
          </button>
        </div>

        {/* Top Controls */}
        <div className="p-6 border-b border-border-base bg-bg-primary shrink-0 flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
            <input 
              type="text"
              placeholder="Digite parte do nome para buscar tarefas (ex: JavaScript)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-elements border border-border-base rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-border-gray text-text-primary placeholder:text-text-tertiary"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3 p-4 bg-bg-secondary border border-border-base rounded-lg">
            <div className="flex-1 min-w-[200px]">
              <label className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary mb-2">
                Ação em Lote
                <InfoTooltip>Escolha qual modificação será aplicada em todas as tarefas selecionadas simultaneamente. Cuidado ao excluir!</InfoTooltip>
              </label>
              <CustomSelect 
                value={actionType}
                onChange={(v) => setActionType(v as any)}
                options={actionOptions}
                placeholder="Selecione uma ação..."
              />
            </div>

            {actionType === 'time' && (
              <div className="flex-1 min-w-[150px]">
                <label className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary mb-2">
                  Novo Horário (vazio para remover)
                  <InfoTooltip>Altera permanentemente o horário de todas as tarefas selecionadas. Deixe vazio para deixar sem horário.</InfoTooltip>
                </label>
                <input 
                  type="time" 
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  className="w-full bg-elements border border-border-base rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none [color-scheme:dark] [html.light_&]:[color-scheme:light]"
                />
              </div>
            )}

            {actionType === 'category' && (
              <div className="flex-1 min-w-[150px]">
                <label className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary mb-2">
                  Nova Categoria
                  <InfoTooltip>Organiza visualmente as tarefas agrupando por cor e contexto. Ex: Trabalhos, Cursos.</InfoTooltip>
                </label>
                <CustomSelect 
                  value={newCategoryId}
                  onChange={setNewCategoryId}
                  options={categoryOptions}
                  placeholder="Selecione..."
                />
              </div>
            )}

            {actionType === 'status' && (
              <div className="flex-1 min-w-[150px]">
                <label className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary mb-2">
                  Novo Status Base
                  <InfoTooltip>O status base define a regra do jogo. 'Manual (Pendente)' exige sua confirmação. 'Automático' completa sozinho. Outros status são definitivos.</InfoTooltip>
                </label>
                <CustomSelect 
                  value={newStatus}
                  onChange={(v) => setNewStatus(v as any)}
                  options={statusOptions}
                  placeholder="Selecione..."
                />
              </div>
            )}

            <button
              onClick={handleApplyClick}
              disabled={actionType === 'none' || selectedIds.size === 0 || (actionType === 'category' && !newCategoryId)}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer whitespace-nowrap h-[38px] ${
                actionType === 'delete' 
                  ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                  : 'bg-btn-bg text-text-primary hover:bg-btn-hover active:bg-btn-active border border-border-base'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Aplicar em {selectedIds.size} itens
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6">
          {!searchQuery.trim() ? (
            <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
              <Search size={48} className="mb-4 opacity-20" />
              <p>Digite algo para encontrar tarefas.</p>
            </div>
          ) : filteredRoutines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
              <p>Nenhuma tarefa encontrada para "{searchQuery}".</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-4 py-2 border-b border-border-base mb-2">
                <button onClick={toggleAll} className="text-text-secondary hover:text-text-primary cursor-pointer">
                  {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
                <span className="text-xs font-bold text-text-tertiary uppercase tracking-wider flex-1">Título</span>
                <span className="hidden sm:block text-xs font-bold text-text-tertiary uppercase tracking-wider w-24">Horário</span>
                <span className="hidden sm:block text-xs font-bold text-text-tertiary uppercase tracking-wider w-32">Status Base</span>
              </div>
              
              {filteredRoutines.map(routine => {
                const isSelected = selectedIds.has(routine.id);
                const category = categories.find(c => c.id === routine.categoryId);
                
                return (
                  <div 
                    key={routine.id}
                    onClick={() => toggleItem(routine.id)}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected ? 'bg-elements border-border-gray' : 'bg-bg-primary border-border-base hover:border-border-gray/50'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                      <div className={`mt-0.5 sm:mt-0 ${isSelected ? 'text-text-primary' : 'text-text-tertiary'}`}>
                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text-primary truncate">{routine.title}</div>
                        <div className="text-xs text-text-tertiary mt-1 flex flex-wrap items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded-sm ${getCategoryStyles(category?.color)}`}>
                            {category?.name}
                          </span>
                          <span>{routine.recurrence === 'once' ? 'Aula Única' : 'Recorrente'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 pl-8 sm:pl-0">
                      <div className="w-20 sm:w-24 shrink-0 text-sm text-text-secondary">
                        {routine.time || (routine.times?.length ? 'Múltiplos' : '--:--')}
                      </div>

                      <div className="w-28 sm:w-32 shrink-0">
                        {routine.statusOverride === 'pending' ? (
                          <span className="text-xs px-2 py-1 rounded bg-bg-secondary border border-border-base text-text-secondary">Manual (Pend.)</span>
                        ) : routine.statusOverride ? (
                          <span className="text-xs px-2 py-1 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20">{routine.statusOverride}</span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Automático</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
