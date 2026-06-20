import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { parseCourseWithGemini } from '../../utils/ai';
import { addDays, format } from 'date-fns';

interface CourseBreakerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CourseBreakerModal({ isOpen, onClose }: CourseBreakerModalProps) {
  const { categories, addRoutine } = useStore();
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [syllabus, setSyllabus] = useState('');
  const [courseName, setCourseName] = useState('');
  const [studyDays, setStudyDays] = useState<number[]>([1, 2, 3, 4, 5]); // Seg a Sex
  const [lessonsPerDay, setLessonsPerDay] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

      onClose();
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl hide-scrollbar">
        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50 sticky top-0 z-10">
          <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-400">
            <Sparkles size={20} /> Quebrador de Cursos (IA)
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Nome do Curso</label>
              <input 
                type="text" 
                value={courseName}
                onChange={e => setCourseName(e.target.value)}
                placeholder="Ex: React Avançado"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Chave da API Gemini</label>
              <input 
                type="password" 
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all"
                required
              />
              <p className="text-xs text-neutral-500 mt-1">Fica salva só no seu navegador.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">Ementa do Curso (Cole tudo aqui)</label>
            <textarea 
              value={syllabus}
              onChange={e => setSyllabus(e.target.value)}
              placeholder="Módulo 1&#10;Aula 1 - Intro&#10;Aula 2 - Setup..."
              rows={6}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Dias de Estudo</label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map((day, idx) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                      studyDays.includes(idx)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-neutral-950 text-neutral-500 hover:bg-neutral-800 border border-neutral-800'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Aulas por dia</label>
              <input 
                type="number" 
                min="1"
                max="10"
                value={lessonsPerDay}
                onChange={e => setLessonsPerDay(Number(e.target.value))}
                className="w-24 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all"
                required
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={isLoading || !courseName || !syllabus || !apiKey || studyDays.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-4 font-bold transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <><Loader2 className="animate-spin" size={20} /> Processando com IA...</>
              ) : (
                <><Sparkles size={20} /> Quebrar e Agendar Aulas</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
