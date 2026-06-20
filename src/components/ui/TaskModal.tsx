import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { X, ChevronDown, Sparkles, Loader2, CheckCircle2, Trash2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { getCategoryStyles } from '../../utils/colors';
import type { RecurrenceType, Routine } from '../../types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Routine;
}

export function TaskModal({ isOpen, onClose, initialData }: TaskModalProps) {
  const { categories, addRoutine, updateRoutine, deleteRoutine } = useStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [recurrenceMenu, setRecurrenceMenu] = useState<string>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [specificDate, setSpecificDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [feedbackState, setFeedbackState] = useState<{type: 'success' | 'error' | null, message: string}>({ type: null, message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setDescription(initialData.description || '');
        setTime(initialData.time || '');
        setEndTime(initialData.endTime || '');
        setCategoryId(initialData.categoryId || categories[0]?.id || '');
        
        if (initialData.recurrence === 'once') {
          if (initialData.date === format(new Date(), 'yyyy-MM-dd')) {
            setRecurrenceMenu('today');
          } else if (initialData.date === format(addDays(new Date(), 1), 'yyyy-MM-dd')) {
            setRecurrenceMenu('tomorrow');
          } else {
            setRecurrenceMenu('specific_date');
            if (initialData.date) setSpecificDate(initialData.date);
          }
        } else {
          setRecurrenceMenu(initialData.recurrence);
          if (initialData.customDays) setCustomDays(initialData.customDays);
        }
      } else {
        setTitle('');
        setDescription('');
        setTime('');
        setEndTime('');
        setCategoryId(categories[0]?.id || '');
        setRecurrenceMenu('daily');
        setCustomDays([]);
        setSpecificDate(format(new Date(), 'yyyy-MM-dd'));
      }
    }
  }, [isOpen, initialData, categories]);

  const recurrenceOptions = [
    { value: 'today', label: 'Somente hoje' },
    { value: 'tomorrow', label: 'Amanhã' },
    { value: 'specific_date', label: 'Data específica' },
    { value: 'daily', label: 'Todos os dias' },
    { value: 'weekdays', label: 'Dias úteis (Seg-Sex)' },
    { value: 'weekends', label: 'Finais de semana' },
    { value: 'custom', label: 'Dias específicos da semana' },
  ];

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setFeedbackState({ type: null, message: '' });

    let finalRecurrence: RecurrenceType = 'daily';
    let finalDate: string | undefined = undefined;

    if (recurrenceMenu === 'today') {
      finalRecurrence = 'once';
      finalDate = format(new Date(), 'yyyy-MM-dd');
    } else if (recurrenceMenu === 'tomorrow') {
      finalRecurrence = 'once';
      finalDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    } else if (recurrenceMenu === 'specific_date') {
      finalRecurrence = 'once';
      finalDate = specificDate;
    } else {
      finalRecurrence = recurrenceMenu as RecurrenceType;
    }

    try {
      if (initialData) {
        await updateRoutine(initialData.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          categoryId,
          recurrence: finalRecurrence,
          customDays: finalRecurrence === 'custom' ? customDays : undefined,
          date: finalDate,
          time: time || undefined,
          endTime: endTime || undefined,
        });
      } else {
        await addRoutine({
          title: title.trim(),
          description: description.trim() || undefined,
          categoryId,
          recurrence: finalRecurrence,
          customDays: finalRecurrence === 'custom' ? customDays : undefined,
          date: finalDate,
          time: time || undefined,
          endTime: endTime || undefined,
        });
      }

      setIsSubmitting(false);
      setFeedbackState({ type: 'success', message: 'Tarefa salva com sucesso!' });
      
      setTimeout(() => {
        setTitle('');
        setDescription('');
        setTime('');
        setEndTime('');
        setRecurrenceMenu('daily');
        setCustomDays([]);
        setShowConfirmClose(false);
        setFeedbackState({ type: null, message: '' });
        onClose();
      }, 1000);

    } catch (error) {
      console.error(error);
      setFeedbackState({ type: 'error', message: 'Erro ao salvar a tarefa. Tente novamente.' });
      setIsSubmitting(false);
    }
  };

  const computeHasChanges = (): boolean => {
    if (!initialData) {
      return title.trim().length > 0 || description.trim().length > 0;
    }
    if (title.trim() !== initialData.title) return true;
    if (description.trim() !== (initialData.description || '')) return true;
    if (time !== (initialData.time || '')) return true;
    if (endTime !== (initialData.endTime || '')) return true;
    if (categoryId !== initialData.categoryId) return true;

    let origMenu: string;
    if (initialData.recurrence === 'once') {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      if (initialData.date === todayStr) origMenu = 'today';
      else if (initialData.date === tomorrowStr) origMenu = 'tomorrow';
      else origMenu = 'specific_date';
    } else {
      origMenu = initialData.recurrence;
    }
    if (recurrenceMenu !== origMenu) return true;
    if (recurrenceMenu === 'specific_date' && specificDate !== (initialData.date || '')) return true;
    if (recurrenceMenu === 'custom') {
      const orig = [...(initialData.customDays || [])].sort().join();
      if ([...customDays].sort().join() !== orig) return true;
    }
    return false;
  };

  const handleCloseRequest = () => {
    if (computeHasChanges()) {
      setShowConfirmClose(true);
    } else {
      handleDiscardAndClose();
    }
  };

  const handleDelete = async () => {
    if (!initialData) return;
    await deleteRoutine(initialData.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleDiscardAndClose = () => {
    setTitle('');
    setDescription('');
    setTime('');
    setEndTime('');
    setRecurrenceMenu('daily');
    setCustomDays([]);
    setShowConfirmClose(false);
    onClose();
  };

  const handleKeepCacheAndClose = () => {
    setShowConfirmClose(false);
    onClose();
  };

  const handleSaveFromConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    handleSubmit(e as unknown as React.FormEvent);
  };

  const toggleDay = (day: number) => {
    setCustomDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleGenerateDescription = async () => {
    if (!title.trim() || isGenerating) return;
    setIsGenerating(true);
    
    // TODO: Substituir por uma chamada real à API (OpenAI / Gemini)
    // Exemplo de como você montaria o prompt:
    // const prompt = `Crie uma descrição para a tarefa "${title}". Contexto adicional do usuário: "${description}"`;
    
    setTimeout(() => {
      const mockDescriptions: Record<string, string> = {
        'react': 'Estudar os fundamentos do React, incluindo componentes, hooks (useState, useEffect) e gerenciamento de estado.',
        'node': 'Revisar a arquitetura do Node.js, Event Loop, criação de APIs REST e middlewares.',
        'treino': 'Focar na execução correta. 4 séries de 12 repetições. Lembrar de alongar antes e depois do exercício.',
        'leitura': 'Ler um capítulo do livro, fazer anotações dos pontos chaves e grifar termos importantes.',
        'projeto': 'Desenvolver as features planejadas para a sprint, criar testes e revisar os pull requests.',
        'reunião': 'Discutir o progresso atual, identificar bloqueios e alinhar os próximos passos com a equipe.',
        'pdp': 'Revisar e ajustar os componentes da página de detalhes do produto (PDP). Garantir que imagens, variações e botões de compra estejam responsivos e funcionando conforme o protótipo.'
      };

      const foundKey = Object.keys(mockDescriptions).find(key => title.toLowerCase().includes(key));
      const baseText = foundKey 
        ? mockDescriptions[foundKey] 
        : `Executar a tarefa "${title.trim()}" seguindo os requisitos estabelecidos.`;

      const generatedText = `${baseText} Validar os resultados e revisar possíveis gargalos antes da conclusão.`;
      
      setDescription(generatedText);
      setIsGenerating(false);
    }, 1500);
  };

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCloseRequest();
      }}
    >
      <div className="bg-bg-secondary border border-border-base rounded-xl w-full max-w-md max-h-[90vh] shadow-2xl relative flex flex-col overflow-hidden">
        
        {/* Confirmação de exclusão */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-bg-secondary/95 backdrop-blur-md z-50 flex items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="max-w-sm w-full space-y-6">
              <div>
                <h3 className="text-xl font-bold font-title text-red-500 mb-2">Excluir Tarefa</h3>
                <p className="text-sm text-text-secondary">Tem certeza que quer excluir <span className="font-semibold text-text-primary">"{initialData?.title}"</span>? Todas as instâncias serão removidas permanentemente.</p>
              </div>
              <div className="space-y-3">
                <button onClick={handleDelete} className="w-full bg-red-500 hover:bg-red-600 text-white rounded-lg py-3 font-bold transition-colors cursor-pointer">
                  Sim, excluir
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="w-full bg-elements hover:bg-elements-hover text-text-primary rounded-lg py-3 font-medium transition-colors cursor-pointer">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Saída */}
        {showConfirmClose && (
          <div className="absolute inset-0 bg-bg-secondary/95 backdrop-blur-md z-50 flex items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="max-w-sm w-full space-y-6">
              <div>
                <h3 className="text-xl font-bold font-title text-text-primary mb-2">Alterações não salvas</h3>
                <p className="text-sm text-text-secondary">Você tem informações preenchidas. O que deseja fazer antes de fechar?</p>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={() => setShowConfirmClose(false)}
                  className="w-full bg-elements hover:bg-elements-hover text-text-primary rounded-lg py-3 font-medium transition-colors cursor-pointer"
                >
                  Voltar e continuar editando
                </button>
                <button 
                  onClick={handleSaveFromConfirm}
                  disabled={!title.trim() || (recurrenceMenu === 'custom' && customDays.length === 0)}
                  className="w-full bg-btn-bg hover:bg-btn-hover active:bg-btn-active disabled:opacity-50 text-text-primary rounded-lg py-3 font-medium transition-colors cursor-pointer">
                  Salvar Tarefa
                </button>
                <button 
                  onClick={handleKeepCacheAndClose}
                  className="w-full bg-bg-secondary border border-border-gray hover:border-neutral-500 text-text-secondary rounded-lg py-3 font-medium transition-colors cursor-pointer">
                  Deixar em cache (Rascunho)
                </button>
                <button 
                  onClick={handleDiscardAndClose}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg py-3 font-medium transition-colors cursor-pointer">
                  Descartar tudo
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 border-b border-border-base flex justify-between items-center bg-bg-secondary/50 rounded-t-2xl shrink-0 relative overflow-hidden">
          {feedbackState.type === 'error' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center font-bold text-sm animate-in fade-in slide-in-from-top-4 duration-300 bg-red-500/90 text-white">
              {feedbackState.message}
            </div>
          )}
          <h2 className="text-xl font-bold font-title">{initialData ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
          <button onClick={handleCloseRequest} className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Título da Tarefa</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Estudar para a prova de Cálculo I"
              className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-border-gray focus:ring-1 focus:ring-border-gray transition-all"
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-text-secondary">Descrição (Opcional)</label>
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={!title.trim() || isGenerating}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-sm transition-all border ${
                  !title.trim() 
                    ? 'text-neutral-600 bg-bg-secondary border-border-base cursor-not-allowed'
                    : isGenerating
                      ? 'text-text-primary bg-elements border-border-base'
                      : 'text-text-primary bg-elements border-border-base hover:bg-elements-hover hover:border-border-gray cursor-pointer'
                }`}>
                {isGenerating ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                {isGenerating ? 'Gerando IA...' : 'Gerar com IA'}
              </button>
            </div>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detalhes, links ou anotações sobre a tarefa..."
              rows={3}
              className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-border-gray focus:ring-1 focus:ring-border-gray transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Categoria</label>
            <div className="grid grid-cols-3 gap-3">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={`py-2 px-3 rounded-md text-sm font-medium border transition-all cursor-pointer ${
                    categoryId === cat.id 
                      ? getCategoryStyles(cat.color)
                      : 'bg-bg-primary border-border-base text-text-secondary hover:border-border-gray'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-text-secondary mb-2">Repetição</label>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`w-full bg-bg-primary border rounded-lg px-4 py-3 text-text-primary transition-all flex justify-between items-center cursor-pointer ${isDropdownOpen ? 'border-border-gray ring-1 ring-border-gray' : 'border-border-base hover:border-border-gray'}`}
            >
              <span>{recurrenceOptions.find(o => o.value === recurrenceMenu)?.label}</span>
              <ChevronDown size={18} className={`text-text-tertiary transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-bg-secondary border border-border-base rounded-lg shadow-xl overflow-y-auto max-h-48 z-20 flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  {recurrenceOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setRecurrenceMenu(option.value);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors cursor-pointer ${
                        recurrenceMenu === option.value 
                          ? 'text-text-primary bg-elements font-medium' 
                          : 'text-text-secondary hover:bg-elements hover:text-text-primary'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {recurrenceMenu === 'specific_date' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Qual data?</label>
              <input 
                type="date"
                value={specificDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSpecificDate(e.target.value);
                  }
                }}
                className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-border-gray focus:ring-1 focus:ring-border-gray transition-all [color-scheme:dark]"
              />
            </div>
          )}

          {recurrenceMenu === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Quais dias?</label>
              <div className="flex justify-between gap-1">
                {daysOfWeek.map((day, idx) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`w-10 h-10 rounded-md text-sm font-medium transition-all ${
                      customDays.includes(idx)
                        ? 'bg-btn-bg text-text-primary'
                        : 'bg-bg-primary text-text-tertiary hover:bg-elements'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Horário de Início (Opcional)</label>
              <input 
                type="time" 
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-border-gray focus:ring-1 focus:ring-border-gray transition-all cursor-pointer [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Horário de Fim (Opcional)</label>
              <input 
                type="time" 
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-border-gray focus:ring-1 focus:ring-border-gray transition-all cursor-pointer [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="pt-4 space-y-3">
            {initialData && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 rounded-lg py-3 font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors cursor-pointer border border-red-500/20"
              >
                <Trash2 size={16} />
                Excluir Tarefa
              </button>
            )}
            <button
              type="submit"
              disabled={!title.trim() || (recurrenceMenu === 'custom' && customDays.length === 0) || isSubmitting || feedbackState.type === 'success'}
              className={`relative w-full rounded-lg py-3 font-bold transition-all cursor-pointer flex items-center justify-center gap-2 overflow-hidden ${
                feedbackState.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-500 cursor-default'
                  : 'bg-btn-bg hover:bg-btn-hover active:bg-btn-active disabled:opacity-50 disabled:cursor-not-allowed text-text-primary'
              }`}>
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Salvando...
                </>
              ) : feedbackState.type === 'success' ? (
                <>
                  <CheckCircle2 size={20} />
                  Salvo com sucesso!
                </>
              ) : (
                'Salvar Tarefa'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
