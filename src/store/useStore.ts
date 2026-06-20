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
  toggleTask: (routineId: string, date: string) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      categories: [
        { id: '1', name: 'Trabalho', color: 'bg-blue-500', icon: 'briefcase' },
        { id: '2', name: 'Pessoal', color: 'bg-green-500', icon: 'user' },
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
                  completedAt: Date.now(),
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
