import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Category, Routine, TaskInstance } from '../types';

interface StoreState {
  categories: Category[];
  routines: Routine[];
  taskInstances: TaskInstance[];
  
  // Actions
  addCategory: (category: Omit<Category, 'id'>) => void;
  addRoutine: (routine: Omit<Routine, 'id' | 'createdAt'>) => void;
  updateRoutine: (id: string, updates: Partial<Routine>) => void;
  toggleTask: (routineId: string, date: string) => void; // Keep for legacy
  cycleTaskStatus: (routineId: string, date: string) => void; // Keep if needed
  setTaskStatus: (routineId: string, date: string, status: import('../types').TaskStatus, note?: string) => void;
  updateTaskNote: (routineId: string, date: string, status: import('../types').TaskStatus, note: string) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      categories: [
        { id: '1', name: 'Trabalho', color: 'bg-blue-500', icon: 'briefcase' },
        { id: '2', name: 'Pessoal', color: 'bg-fuchsia-500', icon: 'user' },
        { id: '3', name: 'Cursos', color: 'bg-purple-500', icon: 'book' },
      ],
      routines: [],
      taskInstances: [],

      addCategory: (category) =>
        set((state) => ({
          categories: [
            ...state.categories,
            { ...category, id: crypto.randomUUID() },
          ],
        })),

      addRoutine: (routine) =>
        set((state) => ({
          routines: [
            ...state.routines,
            { ...routine, id: crypto.randomUUID(), createdAt: Date.now() },
          ],
        })),

      updateRoutine: (id, updates) =>
        set((state) => ({
          routines: state.routines.map((r) => 
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      toggleTask: (routineId, date) => {
        set((state) => {
          const instanceId = `${routineId}_${date}`;
          const existingIndex = state.taskInstances.findIndex((t) => t.id === instanceId);
          
          if (existingIndex >= 0) {
            // Toggle existing
            const newInstances = [...state.taskInstances];
            const isCompleted = !newInstances[existingIndex].completed;
            newInstances[existingIndex] = {
              ...newInstances[existingIndex],
              completed: isCompleted,
              status: isCompleted ? 'completed' : 'pending',
              completedAt: isCompleted ? Date.now() : undefined,
            };
            return { taskInstances: newInstances };
          } else {
            // Create new completed instance
            return {
              taskInstances: [
                ...state.taskInstances,
                {
                  id: instanceId,
                  routineId,
                  date,
                  completed: true,
                  status: 'completed',
                  completedAt: Date.now(),
                },
              ],
            };
          }
        });
      },

      cycleTaskStatus: (routineId, date) => {
        set((state) => {
          const instanceId = `${routineId}_${date}`;
          const existingIndex = state.taskInstances.findIndex((t) => t.id === instanceId);
          
          if (existingIndex >= 0) {
            const current = state.taskInstances[existingIndex];
            let nextStatus: 'pending' | 'in_progress' | 'completed' = 'in_progress';
            let isCompleted = false;
            
            const currentStatus = current.status || (current.completed ? 'completed' : 'pending');

            if (currentStatus === 'pending') {
              nextStatus = 'in_progress';
              isCompleted = false;
            } else if (currentStatus === 'in_progress') {
              nextStatus = 'completed';
              isCompleted = true;
            } else if (currentStatus === 'completed') {
              nextStatus = 'pending';
              isCompleted = false;
            }

            const newInstances = [...state.taskInstances];
            newInstances[existingIndex] = {
              ...current,
              status: nextStatus,
              completed: isCompleted,
              completedAt: isCompleted ? Date.now() : undefined,
            };
            return { taskInstances: newInstances };
          } else {
            return {
              taskInstances: [
                ...state.taskInstances,
                {
                  id: instanceId,
                  routineId,
                  date,
                  status: 'in_progress',
                  completed: false,
                },
              ],
            };
          }
        });
      },

      setTaskStatus: (routineId, date, status, note) => {
        set((state) => {
          const instanceId = `${routineId}_${date}`;
          const existingIndex = state.taskInstances.findIndex((t) => t.id === instanceId);
          
          if (existingIndex >= 0) {
            const current = state.taskInstances[existingIndex];
            const newInstances = [...state.taskInstances];
            const currentNotes = current.notes || {};
            if (current.statusNote) {
              currentNotes[current.status || 'pending'] = current.statusNote;
            }
            newInstances[existingIndex] = {
              ...current,
              status,
              completed: status === 'completed',
              completedAt: status === 'completed' ? Date.now() : undefined,
              statusNote: undefined,
              notes: {
                ...currentNotes,
                [status]: note !== undefined ? note : currentNotes[status]
              }
            };
            return { taskInstances: newInstances };
          } else {
            return {
              taskInstances: [
                ...state.taskInstances,
                {
                  id: instanceId,
                  routineId,
                  date,
                  status,
                  completed: status === 'completed',
                  completedAt: status === 'completed' ? Date.now() : undefined,
                  notes: note ? { [status]: note } : {},
                },
              ],
            };
          }
        });
      },

      updateTaskNote: (routineId, date, status, note) => {
        set((state) => {
          const instanceId = `${routineId}_${date}`;
          const existingIndex = state.taskInstances.findIndex((t) => t.id === instanceId);
          if (existingIndex >= 0) {
            const current = state.taskInstances[existingIndex];
            const newInstances = [...state.taskInstances];
            newInstances[existingIndex] = {
              ...current,
              notes: {
                ...current.notes,
                [status]: note,
              }
            };
            return { taskInstances: newInstances };
          } else {
            return {
              taskInstances: [
                ...state.taskInstances,
                {
                  id: instanceId,
                  routineId,
                  date,
                  status: 'pending',
                  completed: false,
                  notes: { [status]: note },
                },
              ],
            };
          }
        });
      },
    }),
    {
      name: 'rotina-storage', // name of item in the storage
    }
  )
);
