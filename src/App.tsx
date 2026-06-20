import { useState, useEffect } from 'react';
import { format, subDays, addDays, parseISO } from 'date-fns';
import { useStore } from './store/useStore';
import { getTodayStr, isTaskDueToday, generateWeek } from './utils/date';
import { Plus, Calendar, ChevronLeft, ChevronRight, Sparkles, LayoutDashboard, Menu, X, Sun, Moon } from 'lucide-react';
import { TaskModal } from './components/ui/TaskModal';
import { CourseBreakerModal } from './components/ui/CourseBreakerModal';
import { TaskStatusModal } from './components/ui/TaskStatusModal';
import { TaskItem } from './components/ui/TaskItem';
import { CalendarView } from './components/ui/CalendarView';
import { Hero } from './components/ui/Hero';
import { AuthModal } from './components/ui/AuthModal';
import type { Routine } from './types';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';

function App() {
  const { routines, categories, taskInstances } = useStore();
  const [today] = useState(getTodayStr());
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentView, setCurrentView] = useState<'hero' | 'dashboard' | 'calendar'>('hero');
  const [session, setSession] = useState<Session | null>(null);
  const weekDays = generateWeek(selectedDate);

  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    }
  }, [isLightMode]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        useStore.getState().fetchData();
        if (currentView === 'hero') setCurrentView('dashboard');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        useStore.getState().fetchData();
        if (currentView === 'hero') setCurrentView('dashboard');
      } else {
        useStore.setState({ categories: [], routines: [], taskInstances: [] });
        setCurrentView('hero');
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNavigateDays = (amount: number) => {
    setSelectedDate(prev => {
      const dateObj = parseISO(prev);
      const newDate = amount > 0 ? addDays(dateObj, amount) : subDays(dateObj, Math.abs(amount));
      return format(newDate, 'yyyy-MM-dd');
    });
  };

  const selectedRoutines = routines.filter(r => isTaskDueToday(r, selectedDate));
  
  const completedCount = selectedRoutines.filter(r => 
    taskInstances.find(t => t.routineId === r.id && t.date === selectedDate)?.completed
  ).length;

  const progress = selectedRoutines.length === 0 ? 0 : Math.round((completedCount / selectedRoutines.length) * 100);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [statusModalData, setStatusModalData] = useState<{isOpen: boolean, routine: Routine | null, dateStr: string | null}>({
    isOpen: false,
    routine: null,
    dateStr: null
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (currentView === 'dashboard') {
      setTimeout(() => {
        const el = document.getElementById(`dash-day-${selectedDate}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }, 100);
    }
  }, [selectedDate, currentView]);

  return (
    <div className="h-screen w-full flex flex-col relative overflow-hidden">
      {/* Floating Header */}
      <header className="absolute top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl bg-glass border border-border-base rounded-2xl px-6 py-4 flex items-center justify-between shadow-2xl z-50 backdrop-blur-md">
        {/* Logo */}
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => setCurrentView('hero')}
        >
          <div className="w-12 h-12 flex items-center justify-center">
            <img src="/logo.png" alt="Zenith Logo" className="w-full h-full object-contain transition-all duration-300 [html.light_&]:invert" />
          </div>
        </div>

        {currentView === 'hero' ? (
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsLightMode(!isLightMode)}
              className="cursor-pointer text-text-secondary hover:text-text-primary transition-colors"
            >
              {isLightMode ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            {session ? (
              <button 
                onClick={() => supabase.auth.signOut()}
                className="cursor-pointer text-text-primary hover:text-text-secondary font-bold uppercase tracking-wider text-sm transition-colors mr-2"
              >
                Sair
              </button>
            ) : (
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="cursor-pointer text-text-primary hover:text-text-secondary font-bold uppercase tracking-wider text-sm transition-colors mr-2"
              >
                Login
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <button 
                onClick={() => {
                  setSelectedDate(today);
                  setCurrentView('dashboard');
                }}
                className={`cursor-pointer transition-colors flex items-center gap-2 ${currentView === 'dashboard' ? 'text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
              >
                <LayoutDashboard size={16} />
                Meu Dia
              </button>
              <button 
                onClick={() => setCurrentView('calendar')}
                className={`cursor-pointer transition-colors flex items-center gap-2 ${currentView === 'calendar' ? 'text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
              >
                <Calendar size={16} />
                Calendário
              </button>
              <button 
                onClick={() => setIsCourseModalOpen(true)}
                className="cursor-pointer text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-2"
              >
                <Sparkles size={16} />
                Importar Curso
              </button>
              <button 
                onClick={() => setIsLightMode(!isLightMode)}
                className="cursor-pointer text-text-tertiary hover:text-text-primary transition-colors flex items-center"
              >
                {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </nav>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="hidden md:flex cursor-pointer bg-text-primary hover:opacity-80 text-bg-primary px-5 py-2 rounded-xl text-sm font-bold items-center gap-2 transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              <Plus size={16} /> Nova Tarefa
            </button>
            
            {/* Mobile menu button */}
            <div className="md:hidden flex items-center gap-4">
              <button 
                onClick={() => setIsLightMode(!isLightMode)}
                className="cursor-pointer text-text-secondary hover:text-text-primary transition-colors"
              >
                {isLightMode ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <Menu size={24} />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-bg-primary/95 backdrop-blur-md flex flex-col p-6 md:hidden">
          <div className="flex justify-end mb-8">
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer p-2"
            >
              <X size={28} />
            </button>
          </div>
          <nav className="flex flex-col gap-6 text-lg font-medium">
            <button 
              onClick={() => {
                setSelectedDate(today);
                setCurrentView('dashboard');
                setIsMobileMenuOpen(false);
              }}
              className={`cursor-pointer transition-colors flex items-center gap-4 p-4 rounded-xl ${currentView === 'dashboard' ? 'bg-btn-bg text-text-primary' : 'text-text-tertiary active:bg-btn-bg active:text-text-primary'}`}
            >
              <LayoutDashboard size={24} />
              Meu Dia
            </button>
            <button 
              onClick={() => {
                setCurrentView('calendar');
                setIsMobileMenuOpen(false);
              }}
              className={`cursor-pointer transition-colors flex items-center gap-4 p-4 rounded-xl ${currentView === 'calendar' ? 'bg-btn-bg text-text-primary' : 'text-text-tertiary active:bg-btn-bg active:text-text-primary'}`}
            >
              <Calendar size={24} />
              Calendário
            </button>
            <button 
              onClick={() => {
                setIsCourseModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="cursor-pointer text-text-tertiary hover:text-text-primary active:bg-btn-bg p-4 rounded-xl transition-colors flex items-center gap-4"
            >
              <Sparkles size={24} />
              Importar Curso
            </button>
            
            <button 
              onClick={() => {
                setIsModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="mt-8 cursor-pointer bg-text-primary text-bg-primary px-6 py-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 w-full"
            >
              <Plus size={20} /> Nova Tarefa
            </button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-h-0 w-full pt-28 px-6 flex flex-col">
        <div className={`w-full mx-auto flex-1 flex flex-col min-h-0 ${currentView === 'hero' ? 'max-w-7xl' : 'max-w-full px-2 lg:px-8'}`}>
          
          {currentView === 'hero' ? (
            <Hero onStart={() => session ? setCurrentView('dashboard') : setIsAuthModalOpen(true)} />
          ) : currentView === 'dashboard' ? (
            <div className="w-full h-full flex flex-col min-h-0">

              <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h2 className="text-3xl font-bold font-title mb-2">Meu Dia</h2>
                  <p className="text-text-secondary">Você tem {selectedRoutines.length} tarefas neste dia.</p>
                </div>
                <div className="flex gap-2 items-center w-full md:w-auto">
                  <button 
                    onClick={() => setSelectedDate(today)} 
                    className="text-sm font-bold bg-btn-bg hover:bg-elements text-text-primary px-4 py-2 rounded-lg cursor-pointer transition-colors border border-border-base"
                  >
                    Hoje
                  </button>
                  <input 
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedDate(e.target.value);
                      }
                    }}
                    className="flex-1 md:flex-none bg-bg-secondary border border-border-base rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-neutral-500 cursor-pointer [color-scheme:dark] [html.light_&]:[color-scheme:light]"
                  />
                </div>
              </div>

              {/* Weekly Calendar Slider */}
              <div className="flex items-stretch gap-2 mb-4 w-full max-w-full">
                <button 
                  onClick={() => handleNavigateDays(-1)}
                  className="flex-shrink-0 px-3 md:px-4 bg-btn-bg hover:bg-btn-hover active:bg-btn-active text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer border border-border-base flex items-center justify-center"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex-1 flex gap-2 overflow-x-auto snap-x snap-mandatory hide-scrollbar py-1">
                  {weekDays.map(({ dateStr, dayName, dayNumber }) => {
                    const isSelected = dateStr === selectedDate;
                    const isTodayStr = dateStr === today;
                    return (
                      <button
                        key={dateStr}
                        id={`dash-day-${dateStr}`}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`relative snap-center flex-shrink-0 cursor-pointer flex flex-col items-center justify-center min-w-[4.5rem] md:min-w-[5rem] md:flex-1 px-2 py-2 rounded-lg transition-all ${
                          isSelected
                            ? 'bg-elements-hover text-text-primary shadow-md border border-border-gray'
                            : isTodayStr
                            ? 'bg-elements text-text-primary border border-border-gray'
                            : 'bg-bg-secondary text-text-secondary hover:bg-elements'
                        }`}
                      >
                        <span className="text-xs uppercase font-medium tracking-wider mb-1">
                          {dayName}
                        </span>
                        <span className="text-lg font-bold">{dayNumber}</span>
                        {isTodayStr && !isSelected && (
                          <div className="w-1 h-1 bg-text-tertiary rounded-full absolute bottom-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <button 
                  onClick={() => handleNavigateDays(1)}
                  className="flex-shrink-0 px-3 md:px-4 bg-btn-bg hover:bg-btn-hover active:bg-btn-active text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer border border-border-base flex items-center justify-center"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="bg-bg-secondary rounded-lg p-4 mb-6 border border-border-base">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-secondary">Progresso diário</span>
                  <span className="font-bold">{progress}%</span>
                </div>
                <div className="h-3 bg-bg-primary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-text-tertiary transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Task List */}
              <div className="space-y-3 flex-1 overflow-y-auto pb-12">
                {selectedRoutines.length === 0 ? (
                  <div className="text-center py-12 text-text-tertiary bg-bg-secondary/50 rounded-lg border border-border-base border-dashed">
                    Nenhuma tarefa para este dia. Crie uma para começar!
                  </div>
                ) : (
                  selectedRoutines.map(routine => {
                    const category = categories.find(c => c.id === routine.categoryId);
                    const instance = taskInstances.find(t => t.routineId === routine.id && t.date === selectedDate);

                    return (
                      <TaskItem 
                        key={routine.id}
                        routine={routine}
                        category={category}
                        dateStr={selectedDate}
                        taskInstance={instance}
                        onToggle={() => setStatusModalData({ isOpen: true, routine, dateStr: selectedDate })}
                      />
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <CalendarView 
              selectedDate={selectedDate} 
              onNavigate={handleNavigateDays} 
              onSelectDate={setSelectedDate} 
            />
          )}
        </div>
      </main>

      <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <CourseBreakerModal isOpen={isCourseModalOpen} onClose={() => setIsCourseModalOpen(false)} />
      <TaskStatusModal 
        isOpen={statusModalData.isOpen} 
        routine={statusModalData.routine}
        dateStr={statusModalData.dateStr}
        onClose={() => setStatusModalData({ isOpen: false, routine: null, dateStr: null })}
      />
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onSuccess={() => setCurrentView('dashboard')} 
      />
    </div>
  );
}

export default App;
