import React, { useState, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { X, Sparkles, Loader2, Plus, Minus } from 'lucide-react';
import { InfoTooltip, CopyButton } from './InfoTooltip';
import { parseCourseWithGemini, smartScheduleCourseWithGemini } from '../../utils/ai';
import { addDays, format, parseISO } from 'date-fns';

const SYLLABUS_PROMPT = `Tenho a ementa de um curso. Reformate-a seguindo EXATAMENTE este padrão, sem adicionar nada além disso:

MÓDULO: [nome do módulo]
AULA: [nome da aula] - [tempo da aula se houver]
AULA: [nome da aula] - [tempo da aula se houver]

Cada módulo começa com "MÓDULO:" e cada aula com "AULA:". Se a ementa original contiver a duração da aula (ex: 15m, 01:20:00), coloque no final da linha após um hífen. Aqui está a ementa:
[COLE SUA EMENTA AQUI]`;

interface CourseBreakerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CourseBreakerModal({ isOpen, onClose }: CourseBreakerModalProps) {
  const { categories, addRoutine, routines } = useStore();
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
  const [syllabus, setSyllabus] = useState('');
  const [courseName, setCourseName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [studyDays, setStudyDays] = useState<number[]>([1, 2, 3, 4, 5]); // Seg a Sex
  const [lessonsPerDay, setLessonsPerDay] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSmartSchedule, setIsSmartSchedule] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<{
    totalLessons: number;
    startDate: string;
    endDate: string;
  } | null>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !syllabus || !courseName) return;
    if (!isSmartSchedule && studyDays.length === 0) return;

    setIsLoading(true);
    setError('');
    localStorage.setItem('gemini_api_key', apiKey);
    
    abortControllerRef.current = new AbortController();

    try {
      const courseCategory = categories.find(c => c.name === 'Cursos') || categories[0];
      const prefix = schoolName ? `[${schoolName} - ${courseName}]` : `[${courseName}]`;

      if (isSmartSchedule) {
        const scheduledLessons = await smartScheduleCourseWithGemini(apiKey, syllabus, routines, new Date(), abortControllerRef.current.signal);
        
        for (const item of scheduledLessons) {
          addRoutine({
            title: `${prefix} ${item.lesson}`,
            categoryId: courseCategory.id,
            recurrence: 'once',
            date: item.date,
            time: item.time,
            endTime: item.endTime
          });
        }

        setSuccessData({
          totalLessons: scheduledLessons.length,
          startDate: format(parseISO(scheduledLessons[0].date), 'dd/MM/yyyy'),
          endDate: format(parseISO(scheduledLessons[scheduledLessons.length - 1].date), 'dd/MM/yyyy')
        });

      } else {
        const lessons = await parseCourseWithGemini(apiKey, syllabus, abortControllerRef.current.signal);
        
        let currentDate = new Date(); // Start scheduling from today
        let lessonsScheduledToday = 0;
        
        for (const lesson of lessons) {
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
            title: `${prefix} ${lesson}`,
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
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Processamento cancelado.');
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao gerar sugestão');
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
    if (!successData && (courseName.trim() || syllabus.trim() || schoolName.trim())) {
      setShowConfirmClose(true);
    } else {
      handleDiscardAndClose();
    }
  };

  const handleDiscardAndClose = () => {
    setCourseName('');
    setSchoolName('');
    setSyllabus('');
    setError('');
    setShowConfirmClose(false);
    onClose();
    setTimeout(() => {
      setSuccessData(null);
      abortControllerRef.current?.abort();
    }, 300);
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
                  className="w-full bg-btn-bg hover:bg-btn-hover active:bg-btn-active disabled:opacity-50 text-text-primary rounded-lg py-3 font-medium transition-colors cursor-pointer">
                  Quebrar e Agendar
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
            <div className="col-span-1">
              <label className="flex items-center gap-1.5 text-sm font-medium text-text-secondary mb-2">
                Nome do Curso
                <InfoTooltip>Nome completo do curso. Será usado como prefixo em todas as aulas agendadas (ex: <strong>[React Avançado] Aula 1</strong>).</InfoTooltip>
              </label>
              <input 
                type="text" 
                value={courseName}
                onChange={e => setCourseName(e.target.value)}
                placeholder="Ex: React Avançado"
                className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-border-gray transition-all"
                required
              />
            </div>
            <div className="col-span-1">
              <label className="flex items-center gap-1.5 text-sm font-medium text-text-secondary mb-2">
                Instituição / Escola
                <InfoTooltip>Plataforma ou escola do curso (ex: Udemy, Rocketseat). Opcional — aparece junto com o nome: <strong>[Udemy - React Avançado]</strong>.</InfoTooltip>
              </label>
              <input 
                type="text" 
                value={schoolName}
                onChange={e => setSchoolName(e.target.value)}
                placeholder="Ex: Rocketseat, Udemy..."
                className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-border-gray transition-all"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-text-secondary mb-2">
              Ementa do Curso (Cole tudo aqui)
              <InfoTooltip>
                <p className="mb-2">Cole a ementa completa do curso. Para melhores resultados, use uma IA (ChatGPT, Gemini) para formatar antes de colar. Padrão esperado:</p>
                <code className="block bg-bg-secondary rounded p-2 text-text-primary text-[11px] leading-5 whitespace-pre">MÓDULO: Nome do módulo{'\n'}AULA: Nome da aula - 15:00{'\n'}AULA: Nome da aula - 01:20:00</code>
                <CopyButton text={SYLLABUS_PROMPT} />
              </InfoTooltip>
            </label>
            <textarea 
              value={syllabus}
              onChange={e => setSyllabus(e.target.value)}
              placeholder="Módulo 1&#10;Aula 1 - Intro&#10;Aula 2 - Setup..."
              rows={6}
              className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-border-gray transition-all resize-none"
              required
            />
          </div>

          {/* AI Auto-Schedule Placeholder */}
          <div className="bg-bg-primary border border-border-base rounded-lg p-4 relative overflow-hidden group">
            <div className="absolute inset-0 bg-linear-to-r from-white/5 to-white/10 opacity-50 pointer-events-none" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div>
                <h4 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-1">
                  <Sparkles size={16} className="text-text-primary" /> Auto-Agendamento Inteligente
                  <InfoTooltip>Quando ativado, a IA analisa suas tarefas existentes e distribui as aulas nos melhores horários livres, evitando sobreposição e garantindo tempo de descanso. Ignora "Dias de Estudo" e "Aulas por dia" — a IA decide.</InfoTooltip>
                </h4>
                <p className="text-xs text-text-tertiary max-w-[400px]">
                  A IA analisa suas tarefas atuais e sugere os melhores horários para as aulas, garantindo tempo de descanso.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={isSmartSchedule}
                  onChange={(e) => setIsSmartSchedule(e.target.checked)}
                />
                <div className="w-9 h-5 bg-elements peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-primary after:border-border-gray after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-btn-bg"></div>
              </label>
            </div>
          </div>

          <div className={`transition-all duration-300 overflow-hidden ${isSmartSchedule ? 'opacity-30 pointer-events-none h-0' : 'opacity-100 h-auto'}`}>
            <div className="flex flex-col sm:flex-row justify-between gap-6">
            <div className="flex-1">
              <label className="flex items-center gap-1.5 text-sm font-medium text-text-secondary mb-2">
                Dias de Estudo
                <InfoTooltip>Dias da semana em que você vai estudar. A IA distribuirá as aulas nesses dias, respeitando a quantidade de aulas por dia.</InfoTooltip>
              </label>
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
              <label className="flex items-center gap-1.5 text-sm font-medium text-text-secondary mb-2">
                Aulas por dia
                <InfoTooltip>Quantas aulas serão agendadas por dia de estudo. Ex: 2 aulas/dia = curso termina mais rápido.</InfoTooltip>
              </label>
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
          </div>

          <div className="pt-4 flex gap-2">
            <button 
              type="submit"
              disabled={isLoading || !courseName || !syllabus || !apiKey || (!isSmartSchedule && studyDays.length === 0)}
              className="flex-1 bg-btn-bg hover:bg-btn-hover active:bg-btn-active disabled:opacity-50 disabled:cursor-not-allowed text-text-primary rounded-lg py-4 font-bold transition-all flex items-center justify-center gap-2 cursor-pointer">
              {isLoading ? (
                <><Loader2 className="animate-spin" size={20} /> Processando com IA...</>
              ) : (
                <><Sparkles size={20} /> {isSmartSchedule ? 'Agendar Inteligente' : 'Quebrar e Agendar Aulas'}</>
              )}
            </button>
            {isLoading && (
              <button
                type="button"
                onClick={() => abortControllerRef.current?.abort()}
                className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 rounded-lg px-6 font-bold transition-all cursor-pointer flex items-center justify-center"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
