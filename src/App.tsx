import React, { useState } from 'react';
import { useStore } from './store/useStore';
import { getTodayStr, isTaskDueToday, generateWeek } from './utils/date';
import { CheckCircle2, Circle, Plus, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { TaskModal } from './components/ui/TaskModal';

function App() {
  const { routines, categories, taskInstances, toggleTask } = useStore();
  const [today] = useState(getTodayStr());
  const [selectedDate, setSelectedDate] = useState(today);
  const weekDays = generateWeek(selectedDate);

  const selectedRoutines = routines.filter(r => isTaskDueToday(r, selectedDate));
  
  const completedCount = selectedRoutines.filter(r => 
    taskInstances.find(t => t.routineId === r.id && t.date === selectedDate)?.completed
  ).length;

  const progress = selectedRoutines.length === 0 ? 0 : Math.round((completedCount / selectedRoutines.length) * 100);

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex">
      {/* Sidebar Simples */}
      <aside className="w-64 bg-neutral-900 border-r border-neutral-800 p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Calendar size={18} />
          </div>
          <h1 className="text-xl font-bold">Rotina.dev</h1>
        </div>
        
        <nav className="flex-1 space-y-2">
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-800 text-white">
            <CheckCircle2 size={18} className="text-indigo-400" />
            Hoje
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:bg-neutral-800/50 hover:text-white transition-colors">
            <Calendar size={18} />
            Calendário
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-3xl mx-auto">
          <header className="mb-8 flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-bold mb-2">Meu Dia</h2>
              <p className="text-neutral-400">Você tem {selectedRoutines.length} tarefas neste dia.</p>
            </div>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Plus size={18} /> Nova Tarefa
            </button>
          </header>

          {/* Weekly Calendar Slider */}
          <div className="flex items-center justify-between mb-8">
            <button className="text-neutral-500 hover:text-white transition-colors">
              <ChevronLeft size={24} />
            </button>
            <div className="flex gap-2 overflow-x-auto px-4 hide-scrollbar">
              {weekDays.map(({ dateStr, dayName, dayNumber }) => {
                const isSelected = dateStr === selectedDate;
                const isTodayStr = dateStr === today;
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`flex flex-col items-center justify-center min-w-[4rem] py-3 rounded-xl transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                        : isTodayStr
                        ? 'bg-neutral-800 text-white border border-neutral-700'
                        : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'
                    }`}
                  >
                    <span className="text-xs uppercase font-medium tracking-wider mb-1">
                      {dayName}
                    </span>
                    <span className="text-lg font-bold">{dayNumber}</span>
                    {isTodayStr && !isSelected && (
                      <div className="w-1 h-1 bg-indigo-500 rounded-full mt-1 absolute bottom-2" />
                    )}
                  </button>
                );
              })}
            </div>
            <button className="text-neutral-500 hover:text-white transition-colors">
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="bg-neutral-900 rounded-xl p-6 mb-8 border border-neutral-800">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-neutral-400">Progresso diário</span>
              <span className="font-bold">{progress}%</span>
            </div>
            <div className="h-3 bg-neutral-950 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Task List */}
          <div className="space-y-3">
            {selectedRoutines.length === 0 ? (
              <div className="text-center py-12 text-neutral-500 bg-neutral-900/50 rounded-xl border border-neutral-800 border-dashed">
                Nenhuma tarefa para este dia. Crie uma para começar!
              </div>
            ) : (
              selectedRoutines.map(routine => {
                const category = categories.find(c => c.id === routine.categoryId);
                const isCompleted = taskInstances.find(t => t.routineId === routine.id && t.date === selectedDate)?.completed;

                return (
                  <div 
                    key={routine.id}
                    onClick={() => toggleTask(routine.id, selectedDate)}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                      isCompleted 
                        ? 'bg-neutral-900/50 border-neutral-800 opacity-60' 
                        : 'bg-neutral-900 border-neutral-700 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10'
                    }`}
                  >
                    <button className={`flex-shrink-0 transition-colors ${isCompleted ? 'text-indigo-500' : 'text-neutral-500'}`}>
                      {isCompleted ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </button>
                    
                    <div className="flex-1">
                      <h3 className={`font-medium ${isCompleted ? 'line-through text-neutral-500' : 'text-white'}`}>
                        {routine.title}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded-md mt-1 inline-block ${category?.color} bg-opacity-20 text-white/80`}>
                        {category?.name}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

export default App;
