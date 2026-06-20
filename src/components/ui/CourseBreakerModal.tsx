import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { X, Sparkles, Loader2, Plus, Minus } from 'lucide-react';
import { parseCourseWithGemini } from '../../utils/ai';
import { addDays, format } from 'date-fns';

interface CourseBreakerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CourseBreakerModal({ isOpen, onClose }: CourseBreakerModalProps) {
  const { categories, addRoutine } = useStore();
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  const [apiKey, setApiKey] = useState(() => envKey || localStorage.getItem('gemini_api_key') || '');
  const [syllabus, setSyllabus] = useState('');
  const [courseName, setCourseName] = useState('');
  const [studyDays, setStudyDays] = useState<number[]>([1, 2, 3, 4, 5]); // Seg a Sex
  const [lessonsPerDay, setLessonsPerDay] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<{
    totalLessons: number;
    startDate: string;
    endDate: string;
  } | null>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !syllabus || !courseName || studyDays.length === 0) return;

    setIsLoading(true);
    setError('');
    localStorage.setItem('gemini_api_key', apiKey);

    try {
      const lessons = await parseCourseWithGemini(apiKey, syllabus);
      
      let currentDate = new Date(); // Start scheduling from today
      let lessonsScheduledToday = 0;
      
      // Schedule each lesson
      const courseCategory = categories.find(c => c.name === 'Cursos') || categories[0];

      for (const lesson of lessons) {
        // Find next valid study day
        while (!studyDays.includes(currentDate.getDay()) || lessonsScheduledToday >= lessonsPerDay) {
          if (lessonsScheduledToday >= lessonsPerDay) {
            currentDate = addDays(currentDate, 1);
            lessonsScheduledToday = 0;
          } else {
            currentDate = addDays(currentDate, 1);
          }
        }

        const dateStr = format(currentDate, 'yyyy-MM-dd');

        addRoutine({
          title: `[${courseName}] ${lesson}`,
          categoryId: courseCategory.id,
          recurrence: 'once',
          date: dateStr
        });

        lessonsScheduledToday++;
      }

      setSuccessData({
        totalLessons: lessons.length,
        startDate: format(new Date(), 'dd/MM/yyyy'),
        endDate: format(currentDate, 'dd/MM/yyyy')
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro desconhecido');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDay = (day: number) => {
    setStudyDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const handleCloseRequest = () => {
    // Se não gerou sucesso e tem algo digitado
    if (!successData && (courseName.trim() || syllabus.trim())) {
      setShowConfirmClose(true);
    } else {
      handleDiscardAndClose();
    }
  };

  const handleDiscardAndClose = () => {
    setCourseName('');
    setSyllabus('');
    setShowConfirmClose(false);
    onClose();
    setTimeout(() => setSuccessData(null), 300);
  };

  const handleKeepCacheAndClose = () => {
    setShowConfirmClose(false);
    onClose();
  };

  const handleSaveFromConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowConfirmClose(false);
    handleSubmit(e as unknown as React.FormEvent);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCloseRequest();
      }}
    >
      <div className="bg-bg-secondary border border-border-base rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
        
        {/* Modal de Confirmação de Saída */}
        {showConfirmClose && (
          <div className="absolute inset-0 bg-bg-secondary/95 backdrop-blur-md z-50 flex items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="max-w-sm w-full space-y-6">
              <div>
                <h3 className="text-xl font-bold font-title text-text-primary mb-2">Alterações não salvas</h3>
                <p className="text-sm text-text-secondary">Você tem um curso sendo planejado. O que deseja fazer antes de fechar?</p>
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
                  disabled={!apiKey || !syllabus.trim() || !courseName.trim() || studyDays.length === 0}
                  className="w-full bg-btn-bg hover:bg-btn-hover active:bg-btn-active disabled:opacity-50 text-text-primary rounded-lg py-3 font-medium transition-colors cursor-pointer"
                >
                  Quebrar e Agendar
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

        <div className="p-6 border-b border-border-base flex justify-between items-center bg-bg-secondary/50 shrink-0 z-10">
          <h2 className="text-xl font-bold font-title flex items-center gap-2 text-text-primary">
            <Sparkles size={20} /> Quebrador de Cursos (IA)
          </h2>
          <button onClick={handleCloseRequest} className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {successData ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 overflow-y-auto">
            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-4">
              <Sparkles size={32} />
            </div>
            <h3 className="text-2xl font-bold font-title text-text-primary">Pronto! Curso Quebrado.</h3>
            <p className="text-text-secondary max-w-md">
              A Inteligência Artificial triturou sua ementa e agendou <strong className="text-text-primary">{successData.totalLessons} aulas</strong> de forma inteligente nos seus dias de estudo.
            </p>
            
            <div className="bg-bg-primary border border-border-base rounded-lg p-4 w-full mt-4 text-sm text-left">
              <div className="flex justify-between border-b border-border-base pb-2 mb-2">
                <span className="text-text-tertiary">Curso:</span>
                <span className="font-medium text-text-primary">{courseName}</span>
              </div>
              <div className="flex justify-between border-b border-border-base pb-2 mb-2">
                <span className="text-text-tertiary">Início:</span>
                <span className="font-medium text-text-primary">{successData.startDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-tertiary">Término previsto:</span>
                <span className="font-medium text-text-primary">{successData.endDate}</span>
              </div>
            </div>

            <button 
              onClick={() => {
                onClose();
                setTimeout(() => setSuccessData(null), 300);
              }}
              className="mt-6 w-full bg-elements hover:bg-elements-hover text-text-primary rounded-lg py-4 font-bold transition-all cursor-pointer"
            >
              Concluir e Voltar ao Calendário
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className={envKey ? "col-span-2" : ""}>
              <label className="block text-sm font-medium text-text-secondary mb-2">Nome do Curso</label>
              <input 
                type="text" 
                value={courseName}
                onChange={e => setCourseName(e.target.value)}
                placeholder="Ex: React Avançado"
                className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-border-gray transition-all"
                required
              />
            </div>
            {!envKey && (
              <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Chave da API Gemini</label>
              <input 
                type="password" 
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-border-gray transition-all"
                required
              />
              <p className="text-xs text-text-tertiary mt-1">Fica salva só no seu navegador.</p>
            </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Ementa do Curso (Cole tudo aqui)</label>
            <textarea 
              value={syllabus}
              onChange={e => setSyllabus(e.target.value)}
              placeholder="Módulo 1&#10;Aula 1 - Intro&#10;Aula 2 - Setup..."
              rows={6}
              className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-border-gray transition-all resize-none"
              required
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-secondary mb-2">Dias de Estudo</label>
              <div className="flex flex-nowrap gap-2">
                {daysOfWeek.map((day, idx) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`flex-1 min-w-[36px] h-10 rounded-md text-sm font-medium transition-all ${
                      studyDays.includes(idx)
                        ? 'bg-btn-bg text-text-primary'
                        : 'bg-bg-primary text-text-tertiary hover:bg-elements border border-border-base'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Aulas por dia</label>
              <div className="flex items-center justify-between bg-bg-primary border border-border-base rounded-lg p-1 w-[120px]">
                <button
                  type="button"
                  onClick={() => setLessonsPerDay(Math.max(1, lessonsPerDay - 1))}
                  className="w-10 h-10 flex items-center justify-center rounded-md text-text-secondary hover:text-text-primary hover:bg-elements transition-colors"
                >
                  <Minus size={18} />
                </button>
                <div className="text-center text-lg font-bold text-text-primary flex-1">
                  {lessonsPerDay}
                </div>
                <button
                  type="button"
                  onClick={() => setLessonsPerDay(Math.min(10, lessonsPerDay + 1))}
                  className="w-10 h-10 flex items-center justify-center rounded-md text-text-secondary hover:text-text-primary hover:bg-elements transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={isLoading || !courseName || !syllabus || !apiKey || studyDays.length === 0}
              className="w-full bg-btn-bg hover:bg-btn-hover active:bg-btn-active disabled:opacity-50 disabled:cursor-not-allowed text-text-primary rounded-lg py-4 font-bold transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <><Loader2 className="animate-spin" size={20} /> Processando com IA...</>
              ) : (
                <><Sparkles size={20} /> Quebrar e Agendar Aulas</>
              )}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
