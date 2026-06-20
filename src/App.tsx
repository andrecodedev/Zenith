import { useState } from 'react';
import { format, subDays, addDays, parseISO } from 'date-fns';
import { useStore } from './store/useStore';
import { getTodayStr, isTaskDueToday, generateWeek } from './utils/date';
import { CheckCircle2, Circle, Plus, Calendar, ChevronLeft, ChevronRight, Sparkles, LayoutDashboard } from 'lucide-react';
import { TaskModal } from './components/ui/TaskModal';
import { CourseBreakerModal } from './components/ui/CourseBreakerModal';
import { TaskStatusModal } from './components/ui/TaskStatusModal';
import { TaskItem } from './components/ui/TaskItem';
import { CalendarView } from './components/ui/CalendarView';
import type { Routine } from './types';

function App() {
  const { routines, categories, taskInstances, cycleTaskStatus } = useStore();
  const [today] = useState(getTodayStr());
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentView, setCurrentView] = useState<'dashboard' | 'calendar'>('dashboard');
  const weekDays = generateWeek(selectedDate);

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
  const [statusModalData, setStatusModalData] = useState<{isOpen: boolean, routine: Routine | null, dateStr: string | null}>({
    isOpen: false,
    routine: null,
    dateStr: null
  });

  return (
    <div className="h-screen w-full flex flex-col relative overflow-hidden">
      {/* Floating Header */}
      <header className="absolute top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl bg-glass border border-border-base rounded-2xl px-6 py-4 flex items-center justify-between shadow-2xl z-50 backdrop-blur-md">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <img src="/logo.png" alt="Rotina Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-bold font-title tracking-widest text-white uppercase">Zenith</h1>
        </div>

        {/* Navigation & Actions */}
        <div className="flex items-center gap-8">
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button 
              onClick={() => {
                setSelectedDate(today);
                setCurrentView('dashboard');
              }}
              className={`transition-colors flex items-center gap-2 ${currentView === 'dashboard' ? 'text-white' : 'text-text-tertiary hover:text-white'}`}
            >
              <LayoutDashboard size={16} />
              Meu Dia
            </button>
            <button 
              onClick={() => setCurrentView('calendar')}
              className={`transition-colors flex items-center gap-2 ${currentView === 'calendar' ? 'text-white' : 'text-text-tertiary hover:text-white'}`}
            >
              <Calendar size={16} />
              Calendário
            </button>
            <button 
              onClick={() => setIsCourseModalOpen(true)}
              className="text-text-tertiary hover:text-white transition-colors flex items-center gap-2"
            >
              <Sparkles size={16} />
              Importar Curso
            </button>
          </nav>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-white hover:bg-neutral-200 text-black px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            <Plus size={16} /> Nova Tarefa
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto pt-32 pb-12 px-6 flex flex-col">
        <div className={`w-full flex-1 flex flex-col min-h-0 ${currentView === 'dashboard' ? 'max-w-3xl mx-auto' : 'max-w-full'}`}>
          
          {currentView === 'dashboard' ? (
            <div className="w-full h-full flex flex-col min-h-0">

              <div className="mb-8 flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold font-title mb-2">Meu Dia</h2>
                  <p className="text-text-secondary">Você tem {selectedRoutines.length} tarefas neste dia.</p>
                </div>
              </div>

              {/* Weekly Calendar Slider */}
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => handleNavigateDays(-1)}
                  className="p-3 bg-btn-bg hover:bg-btn-hover active:bg-btn-active text-text-secondary hover:text-white rounded-lg transition-colors cursor-pointer border border-border-base flex items-center justify-center"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex gap-2 overflow-x-auto px-4 hide-scrollbar">
                  {weekDays.map(({ dateStr, dayName, dayNumber }) => {
                    const isSelected = dateStr === selectedDate;
                    const isTodayStr = dateStr === today;
                    return (
                      <button
                        key={dateStr}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`flex flex-col items-center justify-center min-w-[5rem] px-3 py-3 rounded-lg transition-all ${
                          isSelected
                            ? 'bg-elements-hover text-white shadow-md border border-border-gray'
                            : isTodayStr
                            ? 'bg-elements text-white border border-border-gray'
                            : 'bg-bg-secondary text-text-secondary hover:bg-elements'
                        }`}
                      >
                        <span className="text-xs uppercase font-medium tracking-wider mb-1">
                          {dayName}
                        </span>
                        <span className="text-lg font-bold">{dayNumber}</span>
                        {isTodayStr && !isSelected && (
                          <div className="w-1 h-1 bg-text-tertiary rounded-full mt-1 absolute bottom-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <button 
                  onClick={() => handleNavigateDays(1)}
                  className="p-3 bg-btn-bg hover:bg-btn-hover active:bg-btn-active text-text-secondary hover:text-white rounded-lg transition-colors cursor-pointer border border-border-base flex items-center justify-center"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="bg-bg-secondary rounded-lg p-6 mb-8 border border-border-base">
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
    </div>
  );
}

export default App;
