import { useState, useEffect, useRef } from 'react';
import { format, subDays, addDays, parseISO } from 'date-fns';
import { useStore } from './store/useStore';
import { getTodayStr, isTaskDueToday, generateWeek } from './utils/date';
import { computeTaskStatus } from './utils/status';
import { Plus, Calendar, ChevronLeft, ChevronRight, ChevronDown, Sparkles, LayoutDashboard, Menu, X, Sun, Moon, BarChart2, Settings2, FileText, Mountain, Landmark, PieChart, ArrowLeft } from 'lucide-react';
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
import { BulkEditorModal } from './components/ui/BulkEditorModal';
import { SobreView } from './components/ui/SobreView';
import { HubView } from './components/ui/HubView';
import { NotesView } from './components/ui/NotesView';
import { FinanceView } from './components/ui/FinanceView';
import { InvestmentView } from './components/ui/InvestmentView';
import type { Routine, TaskStatus } from './types';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { registerServiceWorker, sendTaskNotification, subscribeToPush } from './utils/notifications';
import { Bell } from 'lucide-react';

type AppView = 'hero' | 'sobre' | 'dashboard' | 'calendar' | 'stats' | 'notes' | 'finance' | 'investments' | 'hub';

function RoutineDropdown({ currentView, setCurrentView, setSelectedDate, today }: { currentView: AppView, setCurrentView: (v: AppView) => void, setSelectedDate: (d: string) => void, today: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = currentView === 'dashboard' || currentView === 'calendar' || currentView === 'stats';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`cursor-pointer transition-colors flex items-center gap-1.5 text-sm font-medium ${isActive ? 'text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
      >
        <LayoutDashboard size={16} />
        Rotina
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-48 bg-bg-secondary border border-border-base rounded-xl shadow-2xl overflow-hidden z-50">
          <button
            onClick={() => { setSelectedDate(today); setCurrentView('dashboard'); setOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-elements cursor-pointer ${currentView === 'dashboard' ? 'text-text-primary' : 'text-text-tertiary'}`}
          >
            <LayoutDashboard size={14} />
            Meu Dia
          </button>
          <div className="h-px bg-border-base/40" />
          <button
            onClick={() => { setCurrentView('calendar'); setOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-elements cursor-pointer ${currentView === 'calendar' ? 'text-text-primary' : 'text-text-tertiary'}`}
          >
            <Calendar size={14} />
            Calendário
          </button>
          <div className="h-px bg-border-base/40" />
          <button
            onClick={() => { setCurrentView('stats'); setOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-elements cursor-pointer ${currentView === 'stats' ? 'text-text-primary' : 'text-text-tertiary'}`}
          >
            <BarChart2 size={14} />
            Estatísticas
          </button>
        </div>
      )}
    </div>
  );
}

function FinanceDropdown({ currentView, setCurrentView }: {
  currentView: AppView;
  setCurrentView: (v: 'finance' | 'investments') => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = currentView === 'finance' || currentView === 'investments';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`cursor-pointer transition-colors flex items-center gap-1.5 text-sm font-medium ${isActive ? 'text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
      >
        <Landmark size={16} />
        Finanças
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-48 bg-bg-secondary border border-border-base rounded-xl shadow-2xl overflow-hidden z-50">
          <button
            onClick={() => { setCurrentView('finance'); setOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-elements cursor-pointer ${currentView === 'finance' ? 'text-text-primary' : 'text-text-tertiary'}`}
          >
            <Landmark size={14} />
            Controle Financeiro
          </button>
          <div className="h-px bg-border-base/40" />
          <button
            onClick={() => { setCurrentView('investments'); setOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-elements cursor-pointer ${currentView === 'investments' ? 'text-text-primary' : 'text-text-tertiary'}`}
          >
            <PieChart size={14} />
            Investimentos
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  const { routines, categories, taskInstances } = useStore();
  const [today] = useState(getTodayStr());
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentView, setCurrentView] = useState<AppView>('hero');
  const [headerVisible, setHeaderVisible] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      // track scroll only on elements that have scrollable overflow
      if (!target.classList || (!target.classList.contains('overflow-y-auto') && !target.classList.contains('overflow-auto'))) return;

      const currentScrollY = target.scrollTop;
      if (window.innerWidth >= 768) {
        setHeaderVisible(true);
        return;
      }

      if (currentScrollY <= 0) {
        setHeaderVisible(true);
      } else if (currentScrollY > lastScrollY.current + 10) {
        setHeaderVisible(false);
      } else if (currentScrollY < lastScrollY.current - 10) {
        setHeaderVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setHeaderVisible(true);
      }
    };

    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    
    // Initial check on mount
    handleResize();

    return () => {
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  const currentViewRef = useRef<AppView>('hero');
  const [session, setSession] = useState<Session | null>(null);
  const weekDays = generateWeek(selectedDate);

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]); // eslint-disable-line react-hooks/exhaustive-deps

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
        useStore.getState().fetchNotes();
        if (currentViewRef.current === 'hero' || currentViewRef.current === 'sobre') {
          setCurrentView('hub');
        }
      }
      setIsInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        if (event === 'SIGNED_IN') {
          useStore.getState().fetchData();
          useStore.getState().fetchNotes();
          if (currentViewRef.current === 'hero' || currentViewRef.current === 'sobre') {
            setCurrentView('hub');
          }
          if (notificationsEnabled) subscribeToPush();
        }
      } else {
        useStore.setState({ categories: [], routines: [], taskInstances: [] });
        setCurrentView('hero');
      }
      setIsInitializing(false);
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const mainScroll = document.getElementById('main-scroll');
    if (mainScroll) {
      mainScroll.scrollTop = 0;
    }
  }, [currentView]);

  const notifiedTasks = useRef<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => {
      if (!notificationsEnabled) return;

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const currentDateStr = getTodayStr();
      
      routines.forEach(routine => {
        if (!isTaskDueToday(routine, currentDateStr)) return;

        const checkAndNotify = (timeStr: string, slotIdSuffix: string = '') => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          const taskMinutes = hours * 60 + minutes;
          
          // Verifica se a hora atual passou da hora da tarefa (margem de 5 minutos)
          const isTimeMatch = currentMinutes >= taskMinutes && currentMinutes <= taskMinutes + 5;

          if (isTimeMatch) {
            const instanceId = `${routine.id}_${currentDateStr}${slotIdSuffix}`;
            const instance = taskInstances.find(t => t.id === instanceId);
            
            if (notifiedTasks.current.has(instanceId)) return;
            if (instance && instance.completed) return;
            
            const timeLabel = slotIdSuffix ? ` às ${timeStr}` : '';
            
            sendTaskNotification(
              `Hora da Tarefa: ${routine.title}`,
              routine.description || `Não esqueça de marcar como concluída${timeLabel}!`,
              routine.id,
              currentDateStr
            );
            
            useStore.getState().addNotification(
              `Lembrete: ${routine.title}`,
              routine.description || `Chegou a hora de executar esta tarefa${timeLabel}!`,
              routine.id,
              currentDateStr
            );
            
            notifiedTasks.current.add(instanceId);
          }
        };

        if (routine.recurrence === 'multiple_times' && routine.times && routine.times.length > 0) {
          routine.times.forEach(t => {
            const slotIdSuffix = `_${t.replace(':', '')}`;
            checkAndNotify(t, slotIdSuffix);
          });
        } else if (routine.time) {
          checkAndNotify(routine.time);
        }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [routines, taskInstances, notificationsEnabled]);

  useEffect(() => {
    if (!session || !notificationsEnabled) return;

    const checkFinanceNotifications = async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const dateStr = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`;
      const cacheKey = `finance_notified_${year}_${month}_${day}`;

      if (localStorage.getItem(cacheKey)) return;

      const { data } = await supabase
        .from('finance_entries')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('year', year)
        .eq('month', month)
        .eq('notify', true)
        .eq('paid', false);

      if (data && data.length > 0) {
        let notifiedAny = false;
        data.forEach(entry => {
          if (entry.date_str === dateStr) {
            const amount = Number(entry.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            useStore.getState().addNotification(
              `Conta Vencendo Hoje!`,
              `A despesa "${entry.name}" no valor de ${amount} vence hoje.`,
              entry.id,
              dateStr
            );
            notifiedAny = true;
          }
        });
        if (notifiedAny) {
          localStorage.setItem(cacheKey, 'true');
        }
      }
    };

    checkFinanceNotifications();
    
    // Tenta de novo a cada 1 hora se o app ficar muito tempo aberto
    const interval = setInterval(checkFinanceNotifications, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session, notificationsEnabled]);

  useEffect(() => {
    registerServiceWorker().then(() => {
      // subscribeToPush é chamado pelo onAuthStateChange no SIGNED_IN. não duplicar aqui
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
  const [isBulkEditorModalOpen, setIsBulkEditorModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [statusModalData, setStatusModalData] = useState<{isOpen: boolean, routine: Routine | null, dateStr: string | null, timeStr?: string}>({
    isOpen: false, 
    routine: null, 
    dateStr: null,
    timeStr: undefined
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [sortMode, setSortMode] = useState<'manual' | 'time' | 'status'>('time');

  const [routineOrder, setRoutineOrder] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('routine_order') || '[]'); }
    catch { return []; }
  });
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

  const filteredRoutines = selectedRoutines
    .filter(r => !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(r => !selectedCategoryFilter || r.categoryId === selectedCategoryFilter)
    .filter(r => {
      if (statusFilter === 'all') return true;
      const instance = taskInstances.find(t => t.routineId === r.id && t.date === selectedDate);
      return computeTaskStatus(r, selectedDate, instance) === statusFilter;
    });

  const getStatusOrder = (status: TaskStatus) => {
    switch (status) {
      case 'late': return 1;
      case 'in_progress': return 2;
      case 'pending': return 3;
      case 'completed': return 4;
      case 'vacation': return 5;
      case 'canceled': return 6;
      default: return 7;
    }
  };

  const sortedFilteredRoutines = [...filteredRoutines].sort((a, b) => {
    if (sortMode === 'time') {
      const timeA = a.time || a.times?.[0] || '23:59';
      const timeB = b.time || b.times?.[0] || '23:59';
      return timeA.localeCompare(timeB);
    }
    
    if (sortMode === 'status') {
      const instA = taskInstances.find(t => t.routineId === a.id && t.date === selectedDate);
      const instB = taskInstances.find(t => t.routineId === b.id && t.date === selectedDate);
      const statA = computeTaskStatus(a, selectedDate, instA);
      const statB = computeTaskStatus(b, selectedDate, instB);
      const diff = getStatusOrder(statA) - getStatusOrder(statB);
      if (diff !== 0) return diff;
    }

    const ai = routineOrder.indexOf(a.id);
    const bi = routineOrder.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const handleDrop = (targetId: string) => {
    const fromId = dragIdRef.current;
    if (!fromId || fromId === targetId) return;
    const fromIdx = sortedFilteredRoutines.findIndex(r => r.id === fromId);
    const toIdx = sortedFilteredRoutines.findIndex(r => r.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const ids = sortedFilteredRoutines.map(r => r.id);
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, fromId);
    setRoutineOrder(ids);
    localStorage.setItem('routine_order', JSON.stringify(ids));
    dragIdRef.current = null;
    setDragOverId(null);
  };

  const unreadCount = useStore(state => state.appNotifications.filter(n => !n.read).length);

  useEffect(() => {
    if (currentView === 'dashboard') {
      setTimeout(() => {
        const el = document.getElementById(`dash-day-${selectedDate}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }, 100);
    }
  }, [selectedDate, currentView]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-elements border-t-text-primary rounded-full animate-spin" />
        <p className="text-text-tertiary text-sm font-semibold tracking-wide animate-pulse">CARREGANDO ZENITH...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col relative overflow-hidden">
      
      {/* Header Block - Absolute for all views to allow scroll behind */}
      <div 
        className={`absolute left-0 w-full flex justify-center transition-all duration-300 z-50 pointer-events-none ${
          headerVisible 
            ? 'top-6 translate-y-0 opacity-100' 
            : 'top-6 -translate-y-24 opacity-0'
        }`}
      >
        <header className="pointer-events-auto w-[90%] max-w-4xl bg-white/[0.06] border border-white/[0.12] rounded-2xl px-6 py-3 flex items-center justify-between backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] [html.light_&]:bg-black/[0.04] [html.light_&]:border-black/[0.10] [html.light_&]:shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]">
        {/* Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => setCurrentView('hero')}
        >
          <div className="w-8 h-8 flex items-center justify-center">
            <img src="/logo.png" alt="Zenith Logo" className="w-full h-full object-contain transition-all duration-300 [html.light_&]:invert" />
          </div>
        </div>

        {(currentView === 'hero' || (currentView === 'sobre' && !session)) ? (
          <div className="flex items-center gap-4">
            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <button
                onClick={() => setCurrentView('sobre')}
                className={`cursor-pointer transition-colors flex items-center gap-2 ${currentView === 'sobre' ? 'text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
              >
                <Mountain size={16} />
                Sobre
              </button>
              <button
                onClick={() => setIsLightMode(!isLightMode)}
                className="cursor-pointer text-text-tertiary hover:text-text-primary transition-colors"
              >
                {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              {session ? (
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="cursor-pointer text-text-primary hover:text-text-secondary font-bold uppercase tracking-wider text-xs transition-colors"
                >
                  Sair
                </button>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="cursor-pointer border border-white/30 hover:border-white/80 hover:bg-white hover:text-black text-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 [html.light_&]:text-neutral-900 [html.light_&]:border-neutral-900/30 [html.light_&]:hover:bg-neutral-900 [html.light_&]:hover:text-white"
                >
                  Entrar
                </button>
              )}
            </nav>
            {/* Mobile */}
            <div className="md:hidden flex items-center gap-3">
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
        ) : (
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <button
                onClick={() => setCurrentView('sobre')}
                className="cursor-pointer transition-colors flex items-center gap-2 text-text-tertiary hover:text-text-primary"
              >
                <Mountain size={16} />
                Sobre
              </button>
              <RoutineDropdown currentView={currentView} setCurrentView={setCurrentView} setSelectedDate={setSelectedDate} today={today} />
              <button
                onClick={() => setCurrentView('notes')}
                className={`cursor-pointer transition-colors flex items-center gap-2 ${currentView === 'notes' ? 'text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
              >
                <FileText size={16} />
                Notas
              </button>
              <FinanceDropdown currentView={currentView} setCurrentView={setCurrentView} />
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
    </div>

    {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-bg-primary/95 backdrop-blur-md flex flex-col p-6 md:hidden">
          <div className="flex justify-between items-center mb-8">
            <span className="text-text-tertiary text-xs uppercase tracking-widest font-bold">Menu</span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer p-2"
            >
              <X size={28} />
            </button>
          </div>

          {(currentView === 'hero' || (currentView === 'sobre' && !session)) ? (
            <nav className="flex flex-col gap-4 text-base font-medium">
              <button
                onClick={() => { setCurrentView('sobre'); setIsMobileMenuOpen(false); }}
                className={`cursor-pointer transition-colors flex items-center gap-4 p-4 rounded-xl ${currentView === 'sobre' ? 'bg-btn-bg text-text-primary' : 'text-text-tertiary active:bg-btn-bg active:text-text-primary'}`}
              >
                <Mountain size={24} />
                Sobre o Zenith
              </button>
              {session ? (
                <>
                  <button
                    onClick={() => { setCurrentView('dashboard'); setIsMobileMenuOpen(false); }}
                    className="cursor-pointer transition-colors flex items-center gap-4 p-4 rounded-xl text-text-tertiary active:bg-btn-bg active:text-text-primary"
                  >
                    <LayoutDashboard size={24} />
                    Ir para o App
                  </button>
                  <button
                    onClick={() => { setShowLogoutConfirm(true); setIsMobileMenuOpen(false); }}
                    className="cursor-pointer transition-colors flex items-center gap-4 p-4 rounded-xl text-text-tertiary active:bg-btn-bg"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setIsAuthModalOpen(true); setIsMobileMenuOpen(false); }}
                  className="cursor-pointer transition-colors flex items-center gap-4 p-4 rounded-xl text-text-primary bg-btn-bg font-bold"
                >
                  Entrar / Criar Conta
                </button>
              )}
            </nav>
          ) : (
            <nav className="flex flex-col gap-4 text-base font-medium">
              <button
                onClick={() => { setCurrentView('sobre'); setIsMobileMenuOpen(false); }}
                className="cursor-pointer transition-colors flex items-center gap-4 p-4 rounded-xl text-text-tertiary active:bg-btn-bg active:text-text-primary"
              >
                <Mountain size={24} />
                Sobre o Zenith
              </button>
              <button
                onClick={() => { setSelectedDate(today); setCurrentView('dashboard'); setIsMobileMenuOpen(false); }}
                className={`cursor-pointer transition-colors flex items-center gap-4 p-4 rounded-xl ${currentView === 'dashboard' ? 'bg-btn-bg text-text-primary' : 'text-text-tertiary active:bg-btn-bg active:text-text-primary'}`}
              >
                <LayoutDashboard size={24} />
                Meu Dia
              </button>
              <button
                onClick={() => { setCurrentView('calendar'); setIsMobileMenuOpen(false); }}
                className={`cursor-pointer transition-colors flex items-center gap-4 p-4 rounded-xl ${currentView === 'calendar' ? 'bg-btn-bg text-text-primary' : 'text-text-tertiary active:bg-btn-bg active:text-text-primary'}`}
              >
                <Calendar size={24} />
                Calendário
              </button>
              <button
                onClick={() => { setCurrentView('stats'); setIsMobileMenuOpen(false); }}
                className={`cursor-pointer transition-colors flex items-center gap-4 p-4 rounded-xl ${currentView === 'stats' ? 'bg-btn-bg text-text-primary' : 'text-text-tertiary active:bg-btn-bg active:text-text-primary'}`}
              >
                <BarChart2 size={24} />
                Estatísticas
              </button>
              <button
                onClick={() => { setCurrentView('notes'); setIsMobileMenuOpen(false); }}
                className={`cursor-pointer transition-colors flex items-center gap-4 p-4 rounded-xl ${currentView === 'notes' ? 'bg-btn-bg text-text-primary' : 'text-text-tertiary active:bg-btn-bg active:text-text-primary'}`}
              >
                <FileText size={24} />
                Notas
              </button>
              <button
                onClick={() => { setCurrentView('finance'); setIsMobileMenuOpen(false); }}
                className={`cursor-pointer transition-colors flex items-center gap-4 p-4 rounded-xl ${currentView === 'finance' ? 'bg-btn-bg text-text-primary' : 'text-text-tertiary active:bg-btn-bg active:text-text-primary'}`}
              >
                <Landmark size={24} />
                Finanças
              </button>
              <button
                onClick={() => { setCurrentView('investments'); setIsMobileMenuOpen(false); }}
                className={`cursor-pointer transition-colors flex items-center gap-4 p-4 rounded-xl ${currentView === 'investments' ? 'bg-btn-bg text-text-primary' : 'text-text-tertiary active:bg-btn-bg active:text-text-primary'}`}
              >
                <PieChart size={24} />
                Investimentos
              </button>
            </nav>
          )}
        </div>
      )}

    {/* Main Content */}
    <main id="main-scroll" className={`flex-1 min-h-0 w-full flex flex-col ${currentView === 'hero' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      <div className={`w-full mx-auto flex-1 flex flex-col min-h-0 ${currentView === 'hero' ? 'max-w-7xl' : 'max-w-full px-4 lg:px-8 pt-24 sm:pt-28'}`}>

          {!['hero', 'hub', 'sobre'].includes(currentView) && (
            <button
              onClick={() => setCurrentView('hub')}
              className="flex items-center gap-2 text-text-tertiary hover:text-text-primary transition-colors text-sm mb-6 mt-6 cursor-pointer group w-fit"
            >
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
              Menu Principal
            </button>
          )}

          {currentView === 'hero' ? (
            <Hero onStart={() => session ? setCurrentView('hub') : setIsAuthModalOpen(true)} />
          ) : currentView === 'sobre' ? (
            <SobreView
              onBack={() => setCurrentView('hero')}
              onStart={() => session ? setCurrentView('hub') : setIsAuthModalOpen(true)}
            />
          ) : currentView === 'hub' ? (
            <HubView onNavigate={(v) => setCurrentView(v)} />
          ) : currentView === 'dashboard' ? (
            <div className="w-full flex flex-col px-4">

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
                  className="bg-bg-secondary border border-border-base text-text-secondary px-3 md:px-4 py-2 rounded-lg font-bold hover:text-text-primary hover:border-neutral-500 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shadow-sm h-[42px] mt-2 md:mt-0"
                >
                  <Sparkles size={20} />
                  <span className="hidden sm:inline">Importar Cursos</span>
                </button>
                <button
                  onClick={() => setIsBulkEditorModalOpen(true)}
                  className="bg-bg-secondary border border-border-base text-text-secondary px-3 py-2 rounded-lg font-bold hover:text-text-primary hover:border-neutral-500 transition-all cursor-pointer flex items-center justify-center shadow-sm h-[42px] mt-2 md:mt-0"
                  title="Configuração Global (Lote)"
                >
                  <Settings2 size={20} />
                </button>
              </div>

              {/* FilterBar */}
              <FilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCategory={selectedCategoryFilter}
                onCategoryChange={setSelectedCategoryFilter}
                categories={categories}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                sortMode={sortMode}
                onSortModeChange={setSortMode}
              />

              {/* Task List */}
              <div className="space-y-3 flex flex-col mb-8">
                {filteredRoutines.length === 0 ? (
                  <div className="text-center py-12 px-6 text-text-tertiary bg-bg-secondary/50 rounded-lg border border-border-base border-dashed">
                    {selectedRoutines.length === 0
                      ? 'Nenhuma tarefa para este dia. Crie uma para começar!'
                      : 'Nenhuma tarefa encontrada com esses filtros.'}
                  </div>
                ) : (
                  sortedFilteredRoutines.map(routine => {
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
                        onSlotToggle={(timeStr) => setStatusModalData({ isOpen: true, routine, dateStr: selectedDate, timeStr })}
                        onDragStart={() => { dragIdRef.current = routine.id; }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverId(routine.id); }}
                        onDrop={() => handleDrop(routine.id)}
                        onDragEnd={() => { dragIdRef.current = null; setDragOverId(null); }}
                        isDragOver={dragOverId === routine.id}
                      />
                    );
                  })
                )}
              </div>
            </div>
          ) : currentView === 'stats' ? (
            <div className="w-full flex-1 flex flex-col mb-8 px-4"><StatsView /></div>
          ) : currentView === 'notes' ? (
            <div className="w-full flex-1 flex flex-col mb-8 px-4"><NotesView /></div>
          ) : currentView === 'finance' ? (
            <div className="w-full flex-1 flex flex-col mb-8 px-4"><FinanceView /></div>
          ) : currentView === 'investments' ? (
            <div className="w-full flex-1 flex flex-col mb-8 px-4"><InvestmentView /></div>
          ) : (
            <div className="w-full flex-1 flex flex-col mb-8 px-4">
              <CalendarView
                selectedDate={selectedDate}
                onNavigate={handleNavigateDays}
                onSelectDate={setSelectedDate}
              />
            </div>
          )}
        </div>
      </main>

      <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <CourseBreakerModal isOpen={isCourseModalOpen} onClose={() => setIsCourseModalOpen(false)} />
      <BulkEditorModal isOpen={isBulkEditorModalOpen} onClose={() => setIsBulkEditorModalOpen(false)} />
      <TaskStatusModal 
        isOpen={statusModalData.isOpen} 
        routine={statusModalData.routine}
        dateStr={statusModalData.dateStr}
        timeStr={statusModalData.timeStr}
        onClose={() => setStatusModalData(prev => ({ ...prev, isOpen: false, routine: null, dateStr: null, timeStr: undefined }))}
      />
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onSuccess={() => setCurrentView('hub')} 
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
