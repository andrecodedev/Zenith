import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { X, ChevronDown, Sparkles, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { getCategoryStyles } from '../../utils/colors';
import type { RecurrenceType, Routine } from '../../types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Routine;
}

export function TaskModal({ isOpen, onClose, initialData }: TaskModalProps) {
  const { categories, addRoutine, updateRoutine } = useStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [recurrenceMenu, setRecurrenceMenu] = useState<string>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [specificDate, setSpecificDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setDescription(initialData.description || '');
        setTime(initialData.time || '');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

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

    if (initialData) {
      updateRoutine(initialData.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        categoryId,
        recurrence: finalRecurrence,
        customDays: finalRecurrence === 'custom' ? customDays : undefined,
        date: finalDate,
        time: time || undefined,
      });
    } else {
      addRoutine({
        title: title.trim(),
        description: description.trim() || undefined,
        categoryId,
        recurrence: finalRecurrence,
        customDays: finalRecurrence === 'custom' ? customDays : undefined,
        date: finalDate,
        time: time || undefined,
      });
    }

    setTitle('');
    setDescription('');
    setRecurrenceMenu('daily');
    setCustomDays([]);
    setShowConfirmClose(false);
    onClose();
  };

  const handleCloseRequest = () => {
    if (title.trim() || description.trim()) {
      setShowConfirmClose(true);
    } else {
      handleDiscardAndClose();
    }
  };

  const handleDiscardAndClose = () => {
    setTitle('');
    setDescription('');
    setTime('');
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
      let generatedText = '';
      
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

      if (description.trim().length > 0) {
        // Simula uma resposta fluída que integra as anotações do usuário no meio do texto gerado
        generatedText = `${baseText} O foco principal desta execução será atender o que foi planejado: "${description.trim()}". Validar os resultados e revisar possíveis gargalos antes da conclusão para garantir excelência técnica.`;
      } else {
        generatedText = `${baseText} Validar os resultados e revisar possíveis gargalos antes da conclusão.`;
      }
      
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
      <div className="bg-bg-secondary border border-border-base rounded-xl w-full max-w-md shadow-2xl relative flex flex-col overflow-hidden">
        
        {/* Modal de Confirmação de Saída */}
        {showConfirmClose && (
          <div className="absolute inset-0 bg-bg-secondary/95 backdrop-blur-md z-50 flex items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="max-w-sm w-full space-y-6">
              <div>
                <h3 className="text-xl font-bold font-title text-white mb-2">Alterações não salvas</h3>
                <p className="text-sm text-text-secondary">Você tem informações preenchidas. O que deseja fazer antes de fechar?</p>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={() => setShowConfirmClose(false)}
                  className="w-full bg-elements hover:bg-elements-hover text-white rounded-lg py-3 font-medium transition-colors cursor-pointer"
                >
                  Voltar e continuar editando
                </button>
                <button 
                  onClick={handleSaveFromConfirm}
                  disabled={!title.trim() || (recurrenceMenu === 'custom' && customDays.length === 0)}
                  className="w-full bg-btn-bg hover:bg-btn-hover active:bg-btn-active disabled:opacity-50 text-white rounded-lg py-3 font-medium transition-colors cursor-pointer"
                >
                  Salvar Tarefa
                </button>
                <button 
                  onClick={handleKeepCacheAndClose}
                  className="w-full bg-bg-secondary border border-border-gray hover:border-neutral-500 text-text-secondary rounded-lg py-3 font-medium transition-colors cursor-pointer"
                >
                  Deixar em cache (Rascunho)
                </button>
                <button 
                  onClick={handleDiscardAndClose}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg py-3 font-medium transition-colors cursor-pointer"
                >
                  Descartar tudo
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 border-b border-border-base flex justify-between items-center bg-bg-secondary/50 rounded-t-2xl">
          <h2 className="text-xl font-bold font-title">{initialData ? 'Editar Tarefa / Curso' : 'Nova Tarefa / Curso'}</h2>
          <button onClick={handleCloseRequest} className="text-text-secondary hover:text-white transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Título da Tarefa</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Aula 01 - React Hooks"
              className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-white focus:outline-none focus:border-border-gray focus:ring-1 focus:ring-border-gray transition-all"
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
                      ? 'text-white bg-elements border-border-base'
                      : 'text-white bg-elements border-border-base hover:bg-elements-hover hover:border-border-gray cursor-pointer'
                }`}
              >
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
              className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-white focus:outline-none focus:border-border-gray focus:ring-1 focus:ring-border-gray transition-all resize-none"
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
              className={`w-full bg-bg-primary border rounded-lg px-4 py-3 text-white transition-all flex justify-between items-center cursor-pointer ${isDropdownOpen ? 'border-border-gray ring-1 ring-border-gray' : 'border-border-base hover:border-border-gray'}`}
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
                          ? 'text-white bg-elements font-medium' 
                          : 'text-text-secondary hover:bg-elements hover:text-white'
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
                onChange={(e) => setSpecificDate(e.target.value)}
                className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-white focus:outline-none focus:border-border-gray focus:ring-1 focus:ring-border-gray transition-all [color-scheme:dark]"
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
                        ? 'bg-btn-bg text-white'
                        : 'bg-bg-primary text-text-tertiary hover:bg-elements'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Horário (Opcional)</label>
            <input 
              type="time" 
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-white focus:outline-none focus:border-border-gray focus:ring-1 focus:ring-border-gray transition-all cursor-pointer [color-scheme:dark]"
            />
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={!title.trim() || (recurrenceMenu === 'custom' && customDays.length === 0)}
              className="w-full bg-btn-bg hover:bg-btn-hover active:bg-btn-active disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-3 font-bold transition-all"
            >
              Salvar Tarefa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
