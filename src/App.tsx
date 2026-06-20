import { useState, useEffect, useRef } from 'react';
import { format, subDays, addDays, parseISO } from 'date-fns';
import { useStore } from './store/useStore';
import { getTodayStr, isTaskDueToday, generateWeek } from './utils/date';
import { Plus, Calendar, ChevronLeft, ChevronRight, Sparkles, LayoutDashboard, Menu, X, Sun, Moon, BarChart2 } from 'lucide-react';
import { TaskModal } from './components/ui/TaskModal';
import { CourseBreakerModal } from './components/ui/CourseBreakerModal';
import { TaskStatusModal } from './components/ui/TaskStatusModal';
import { TaskItem } from './components/ui/TaskItem';
import { FilterBar } from './components/ui/FilterBar';
import { CalendarView } from './components/ui/CalendarView';
import { StatsView } from './components/ui/StatsView';
import { Hero } from './components/ui/Hero';
import { AuthModal } from './components/ui/AuthModal';
import { NotificationCenterModal } from './components/ui/NotificationCenterModal';
import type { Routine } from './types';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { registerServiceWorker, sendTaskNotification, subscribeToPush } from './utils/notifications';
import { Bell } from 'lucide-react';

function App() {
  const { routines, categories, taskInstances } = useStore();
  const [today] = useState(getTodayStr());
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentView, setCurrentView] = useState<'hero' | 'dashboard' | 'calendar' | 'stats'>('hero');
  const [session, setSession] = useState<Session | null>(null);
  const weekDays = generateWeek(selectedDate);

  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('notifications_enabled') !== 'false';
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
        if (notificationsEnabled) subscribeToPush();
      } else {
        useStore.setState({ categories: [], routines: [], taskInstances: [] });
        setCurrentView('hero');
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const notifiedTasks = useRef<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => {
      if (!notificationsEnabled) return;

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const currentDateStr = getTodayStr();
      
      routines.forEach(routine => {
        if (!routine.time) return;
        
        const [hours, minutes] = routine.time.split(':').map(Number);
        const taskMinutes = hours * 60 + minutes;
        
        // Verifica se a hora atual passou da hora da tarefa (margem de 5 minutos)
        const isTimeMatch = currentMinutes >= taskMinutes && currentMinutes <= taskMinutes + 5;

        if (isTaskDueToday(routine, currentDateStr) && isTimeMatch) {
          const instanceId = `${routine.id}_${currentDateStr}`;
          const instance = taskInstances.find(t => t.id === instanceId);
          
          if (notifiedTasks.current.has(instanceId)) return;
          if (instance && instance.completed) return;
          
          sendTaskNotification(
            `Hora da Tarefa: ${routine.title}`,
            routine.description || "Não esqueça de marcar como concluída!",
            routine.id,
            currentDateStr
          );
          
          useStore.getState().addNotification(
            `Lembrete: ${routine.title}`,
            routine.description || "Chegou a hora de executar esta tarefa!",
            routine.id,
            currentDateStr
          );
          
          notifiedTasks.current.add(instanceId);
        }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [routines, taskInstances, notificationsEnabled]);

  useEffect(() => {
    registerServiceWorker().then(() => {
      if (session && notificationsEnabled) subscribeToPush();
    });

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_ACTION') {
        const { action, payload } = event.data;
        const { routineId, dateStr } = payload;
        
        if (action === 'completed') {
          useStore.getState().setTaskStatus(routineId, dateStr, 'completed', 'Concluído via Notificação');
        } else if (action === 'in_progress') {
          useStore.getState().setTaskStatus(routineId, dateStr, 'in_progress', 'Em andamento via Notificação');
        } else if (action === 'late') {
          useStore.getState().setTaskStatus(routineId, dateStr, 'late', 'Atrasado via Notificação');
        } else if (action === 'canceled') {
          useStore.getState().setTaskStatus(routineId, dateStr, 'canceled', 'Cancelado via Notificação');
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
  }, []);

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

  const filteredRoutines = selectedRoutines
    .filter(r => !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(r => !selectedCategoryFilter || r.categoryId === selectedCategoryFilter);

  const unreadCount = useStore(state => state.appNotifications.filter(n => !n.read).length);

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
      <header className="absolute top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl bg-white/[0.06] border border-white/[0.12] rounded-2xl px-6 py-3 flex items-center justify-between z-50 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] [html.light_&]:bg-black/[0.04] [html.light_&]:border-black/[0.10] [html.light_&]:shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
        {/* Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => setCurrentView('hero')}
        >
          <div className="w-8 h-8 flex items-center justify-center">
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
                onClick={() => setShowLogoutConfirm(true)}
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
                onClick={() => setCurrentView('stats')}
                className={`cursor-pointer transition-colors flex items-center gap-2 ${currentView === 'stats' ? 'text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
              >
                <BarChart2 size={16} />
                Estatísticas
              </button>
              <button
                onClick={() => {
                  setIsNotificationCenterOpen(true);
                }}
                className="relative cursor-pointer text-text-tertiary hover:text-text-primary transition-colors flex items-center"
                title="Central de Notificações"
              >
                <Bell size={18} className={unreadCount > 0 ? "animate-bell-ring" : ""} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-bg-primary"></span>
                )}
              </button>
              <button 
                onClick={() => setIsLightMode(!isLightMode)}
                className="cursor-pointer text-text-tertiary hover:text-text-primary transition-colors flex items-center"
              >
                {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </nav>
            
            
            {/* Mobile menu button */}
            <div className="md:hidden flex items-center gap-4">
              <button 
                onClick={() => {
                  setIsNotificationCenterOpen(true);
                }}
                className="relative cursor-pointer text-text-secondary hover:text-text-primary transition-colors"
                title="Central de Notificações"
              >
                <Bell size={20} className={unreadCount > 0 ? "animate-bell-ring" : ""} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-bg-primary"></span>
                )}
              </button>
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
                setCurrentView('stats');
                setIsMobileMenuOpen(false);
              }}
              className={`cursor-pointer transition-colors flex items-center gap-4 p-4 rounded-xl ${currentView === 'stats' ? 'bg-btn-bg text-text-primary' : 'text-text-tertiary active:bg-btn-bg active:text-text-primary'}`}
            >
              <BarChart2 size={24} />
              Estatísticas
            </button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 min-h-0 w-full flex flex-col ${currentView === 'hero' ? 'overflow-hidden' : 'pt-28 px-6 overflow-y-auto'}`}>
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

              {/* Ações rápidas */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex-1 cursor-pointer bg-btn-bg hover:bg-btn-hover text-text-primary px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all border border-border-base active:scale-95"
                >
                  <Plus size={16} /> Nova Tarefa
                </button>
                <button
                  onClick={() => setIsCourseModalOpen(true)}
                  className="cursor-pointer bg-btn-bg hover:bg-btn-hover text-text-primary px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all border border-border-base active:scale-95 whitespace-nowrap"
                >
                  <Sparkles size={16} /> Importar Curso
                </button>
              </div>

              {/* FilterBar */}
              <FilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCategory={selectedCategoryFilter}
                onCategoryChange={setSelectedCategoryFilter}
                categories={categories}
              />

              {/* Task List */}
              <div className="space-y-3 flex-1 overflow-y-auto pb-12">
                {filteredRoutines.length === 0 ? (
                  <div className="text-center py-12 px-6 text-text-tertiary bg-bg-secondary/50 rounded-lg border border-border-base border-dashed">
                    {selectedRoutines.length === 0
                      ? 'Nenhuma tarefa para este dia. Crie uma para começar!'
                      : 'Nenhuma tarefa encontrada com esses filtros.'}
                  </div>
                ) : (
                  filteredRoutines.map(routine => {
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
          ) : currentView === 'stats' ? (
            <StatsView />
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

      <NotificationCenterModal
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notificationsEnabled={notificationsEnabled}
        setNotificationsEnabled={setNotificationsEnabled}
        onTaskClick={(routineId, dateStr) => {
          setIsNotificationCenterOpen(false);
          setCurrentView('dashboard');
          setSelectedDate(dateStr);
          const routine = useStore.getState().routines.find(r => r.id === routineId);
          if (routine) {
            setStatusModalData({ isOpen: true, routine, dateStr });
          }
        }}
      />
      
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-border-base rounded-xl w-full max-w-sm shadow-2xl p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold font-title text-text-primary mb-2">Sair da Conta</h3>
            <p className="text-sm text-text-secondary mb-6">Tem certeza que deseja sair do Zenith?</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  supabase.auth.signOut();
                  setShowLogoutConfirm(false);
                }}
                className="w-full cursor-pointer bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Sim, Sair
              </button>
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full cursor-pointer bg-transparent border border-border-gray hover:bg-elements text-text-primary font-bold py-3 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
