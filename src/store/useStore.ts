import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Category, Routine, TaskInstance, TaskStatus } from '../types';

interface StoreState {
  categories: Category[];
  routines: Routine[];
  taskInstances: TaskInstance[];
  
  fetchData: () => Promise<void>;
  addCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addRoutine: (routine: Omit<Routine, 'id' | 'createdAt'>) => Promise<void>;
  updateRoutine: (id: string, updates: Partial<Routine>) => Promise<void>;
  deleteRoutine: (id: string) => Promise<void>;
  toggleTask: (routineId: string, date: string) => Promise<void>;
  toggleTimeSlot: (routineId: string, date: string, time: string) => Promise<void>;
  cycleTaskStatus: (routineId: string, date: string) => Promise<void>;
  setTaskStatus: (routineId: string, date: string, status: TaskStatus, note?: string, timeStr?: string) => Promise<void>;
  setTaskStatusForAll: (routineId: string, status: TaskStatus | undefined, note?: string, scope?: 'all' | 'future' | 'past', referenceDate?: string) => Promise<void>;
  updateTaskNote: (routineId: string, date: string, status: import('../types').TaskStatus, note: string) => Promise<void>;
  
  appNotifications: import('../types').AppNotification[];
  addNotification: (title: string, message: string, routineId?: string, dateStr?: string) => void;
  markNotificationsAsRead: () => void;
  toggleNotificationRead: (id: string) => void;
  setNotificationsRead: (ids: string[], read: boolean) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  deleteNotificationsByIds: (ids: string[]) => void;
}

const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  return user.id;
};

export const useStore = create<StoreState>((set, get) => ({
  categories: [],
  routines: [],
  taskInstances: [],
  appNotifications: JSON.parse(localStorage.getItem('app_notifications') || '[]'),

  fetchData: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [catRes, routRes, taskRes] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user.id),
      supabase.from('routines').select('*').eq('user_id', user.id),
      supabase.from('task_instances').select('*').eq('user_id', user.id)
    ]);

    let fetchedCategories = catRes.data || [];

    if (catRes.error) {
      console.error('[fetchData] categories error:', catRes.error.message);
    }

    if (fetchedCategories.length === 0 && !catRes.error) {
      const defaultCategories = [
        { id: crypto.randomUUID(), user_id: user.id, name: 'Trabalho', color: 'bg-orange-500', icon: 'briefcase' },
        { id: crypto.randomUUID(), user_id: user.id, name: 'Pessoal', color: 'bg-fuchsia-500', icon: 'user' },
        { id: crypto.randomUUID(), user_id: user.id, name: 'Cursos', color: 'bg-teal-500', icon: 'book' },
      ];
      const { error: insertError } = await supabase
        .from('categories')
        .upsert(defaultCategories, { onConflict: 'user_id,name', ignoreDuplicates: true });
      if (!insertError) fetchedCategories = defaultCategories;
      else console.error('[fetchData] insert default categories error:', insertError.message);
    }

    set({
      categories: fetchedCategories,
      routines: (routRes.data || []).map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        categoryId: r.category_id,
        recurrence: r.recurrence,
        customDays: r.custom_days,
        date: r.date,
        time: r.time,
        endTime: r.end_time,
        times: r.times || undefined,
        excludedDates: r.excluded_dates || undefined,
        statusOverride: r.status_override || undefined,
        notesOverride: r.notes_override || undefined,
        startDate: r.start_date || undefined,
        endDate: r.end_date || undefined,
        createdAt: new Date(r.created_at).getTime()
      })),
      taskInstances: (taskRes.data || []).map(t => ({
        id: t.id,
        routineId: t.routine_id,
        date: t.date,
        completed: t.completed,
        status: t.status,
        statusNote: t.status_note,
        notes: t.notes,
        completedAt: t.completed_at ? new Date(t.completed_at).getTime() : undefined
      }))
    });
  },

  addCategory: async (category) => {
    const userId = await getUserId();
    const newId = crypto.randomUUID();
    const newCat = { ...category, id: newId };
    
    set(state => ({ categories: [...state.categories, newCat] }));

    await supabase.from('categories').insert({
      id: newId,
      user_id: userId,
      name: category.name,
      color: category.color,
      icon: category.icon
    });
  },

  updateCategory: async (id, updates) => {
    set(state => ({
      categories: state.categories.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
    await supabase.from('categories').update(updates).eq('id', id);
  },

  deleteCategory: async (id) => {
    set(state => ({
      categories: state.categories.filter(c => c.id !== id)
    }));
    await supabase.from('categories').delete().eq('id', id);
  },

  addRoutine: async (routine) => {
    const userId = await getUserId();
    const newId = crypto.randomUUID();
    const newRoutine = { ...routine, id: newId, createdAt: Date.now() };

    set(state => ({ routines: [...state.routines, newRoutine] }));

    const insertPayload: Record<string, unknown> = {
      id: newId,
      user_id: userId,
      title: routine.title,
      description: routine.description ?? null,
      category_id: routine.categoryId,
      recurrence: routine.recurrence,
      custom_days: routine.customDays ?? null,
      date: routine.date ?? null,
      time: routine.time ?? null,
      status_override: routine.statusOverride ?? null,
      notes_override: routine.notesOverride ?? null,
      excluded_dates: routine.excludedDates ?? null,
      start_date: routine.startDate ?? null,
      end_date: routine.endDate ?? null,
    };
    if (routine.endTime !== undefined) insertPayload.end_time = routine.endTime;
    if (routine.times !== undefined) insertPayload.times = routine.times;

    const { error: insertError } = await supabase.from('routines').insert(insertPayload);
    if (insertError) console.error('[addRoutine] insert error:', insertError.message);
  },

  updateRoutine: async (id, updates) => {
    set(state => ({
      routines: state.routines.map(r => r.id === id ? { ...r, ...updates } : r)
    }));

    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;
    if (updates.recurrence !== undefined) dbUpdates.recurrence = updates.recurrence;
    if (updates.customDays !== undefined) dbUpdates.custom_days = updates.customDays;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.time !== undefined) dbUpdates.time = updates.time;
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
    if (updates.times !== undefined) dbUpdates.times = updates.times ?? null;
    if (updates.statusOverride !== undefined) dbUpdates.status_override = updates.statusOverride ?? null;
    if (updates.notesOverride !== undefined) dbUpdates.notes_override = updates.notesOverride ?? null;
    if (updates.excludedDates !== undefined) dbUpdates.excluded_dates = updates.excludedDates ?? null;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate ?? null;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate ?? null;

    await supabase.from('routines').update(dbUpdates).eq('id', id);
  },

  deleteRoutine: async (id) => {
    set(state => ({
      routines: state.routines.filter(r => r.id !== id),
      taskInstances: state.taskInstances.filter(t => t.routineId !== id),
    }));
    await supabase.from('task_instances').delete().eq('routine_id', id);
    await supabase.from('routines').delete().eq('id', id);
  },

  toggleTask: async (routineId, date) => {
    const userId = await getUserId();
    const instanceId = `${routineId}_${date}`;
    const state = get();
    const existingIndex = state.taskInstances.findIndex((t) => t.id === instanceId);
    
    let newTaskInstance: TaskInstance;

    if (existingIndex >= 0) {
      const isCompleted = !state.taskInstances[existingIndex].completed;
      newTaskInstance = {
        ...state.taskInstances[existingIndex],
        completed: isCompleted,
        status: isCompleted ? 'completed' : 'pending',
        completedAt: isCompleted ? Date.now() : undefined,
      };
      const newInstances = [...state.taskInstances];
      newInstances[existingIndex] = newTaskInstance;
      set({ taskInstances: newInstances });
    } else {
      newTaskInstance = {
        id: instanceId,
        routineId,
        date,
        completed: true,
        status: 'completed',
        completedAt: Date.now(),
      };
      set({ taskInstances: [...state.taskInstances, newTaskInstance] });
    }

    await syncTaskInstance(newTaskInstance, userId);
  },

  toggleTimeSlot: async (routineId, date, time) => {
    const userId = await getUserId();
    const instanceId = `${routineId}_${date}_${time.replace(':', '')}`;
    const state = get();
    const existingIndex = state.taskInstances.findIndex(t => t.id === instanceId);

    let newTaskInstance: TaskInstance;

    if (existingIndex >= 0) {
      const isCompleted = !state.taskInstances[existingIndex].completed;
      newTaskInstance = {
        ...state.taskInstances[existingIndex],
        completed: isCompleted,
        status: isCompleted ? 'completed' : 'pending',
        completedAt: isCompleted ? Date.now() : undefined,
      };
      const updated = [...state.taskInstances];
      updated[existingIndex] = newTaskInstance;
      set({ taskInstances: updated });
    } else {
      newTaskInstance = {
        id: instanceId,
        routineId,
        date,
        completed: true,
        status: 'completed',
        completedAt: Date.now(),
      };
      set({ taskInstances: [...state.taskInstances, newTaskInstance] });
    }

    await syncTaskInstance(newTaskInstance, userId);
  },

  cycleTaskStatus: async (routineId, date) => {
    const userId = await getUserId();
    const instanceId = `${routineId}_${date}`;
    const state = get();
    const existingIndex = state.taskInstances.findIndex((t) => t.id === instanceId);
    
    let newTaskInstance: TaskInstance;

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

      newTaskInstance = {
        ...current,
        status: nextStatus,
        completed: isCompleted,
        completedAt: isCompleted ? Date.now() : undefined,
      };
      const newInstances = [...state.taskInstances];
      newInstances[existingIndex] = newTaskInstance;
      set({ taskInstances: newInstances });
    } else {
      newTaskInstance = {
        id: instanceId,
        routineId,
        date,
        status: 'in_progress',
        completed: false,
      };
      set({ taskInstances: [...state.taskInstances, newTaskInstance] });
    }

    await syncTaskInstance(newTaskInstance, userId);
  },

  setTaskStatus: async (routineId, date, status, note, timeStr) => {
    const userId = await getUserId();
    const state = get();
    const suffix = timeStr ? `_${timeStr.replace(':', '')}` : '';
    const instanceId = `${routineId}_${date}${suffix}`;
    const existingIndex = state.taskInstances.findIndex((t) => t.id === instanceId);
    
    let newTaskInstance: TaskInstance;

    if (existingIndex >= 0) {
      const current = state.taskInstances[existingIndex];
      const currentNotes = current.notes || {};
      if (current.statusNote) {
        currentNotes[current.status || 'pending'] = current.statusNote;
      }
      newTaskInstance = {
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
      const newInstances = [...state.taskInstances];
      newInstances[existingIndex] = newTaskInstance;
      set({ taskInstances: newInstances });
    } else {
      newTaskInstance = {
        id: instanceId,
        routineId,
        date,
        status,
        completed: status === 'completed',
        completedAt: status === 'completed' ? Date.now() : undefined,
        notes: note ? { [status]: note } : {},
      };
      set({ taskInstances: [...state.taskInstances, newTaskInstance] });
    }

    await syncTaskInstance(newTaskInstance, userId);
    
    const statusLabels: Record<string, string> = {
      'pending': 'Pendente',
      'in_progress': 'Em Progresso',
      'completed': 'Concluída',
      'late': 'Atrasada',
      'canceled': 'Cancelada'
    };

    const label = status ? statusLabels[status] || status : 'Automático';
    const taskTitle = get().routines.find(r => r.id === routineId)?.title || 'Tarefa';

    get().addNotification(
      'Status Alterado',
      `"${taskTitle}" mudou para: ${label}.`
    );
  },

  setTaskStatusForAll: async (routineId, status, note, scope = 'all', referenceDate = '') => {
    const userId = await getUserId();
    const state = get();
    
    // Find all existing instances for this routine
    let existingInstances = state.taskInstances.filter(t => t.routineId === routineId);
    
    if (scope === 'future' && referenceDate) {
      existingInstances = existingInstances.filter(t => t.date >= referenceDate);
    } else if (scope === 'past' && referenceDate) {
      existingInstances = existingInstances.filter(t => t.date <= referenceDate);
    }

    if (existingInstances.length === 0) return;

    const updatedInstances = existingInstances.map(current => {
      const currentNotes = current.notes || {};
      if (current.statusNote) {
        currentNotes[current.status || 'pending'] = current.statusNote;
      }
      
      const newStatus = status; // undefined if auto
      
      return {
        ...current,
        status: newStatus as TaskStatus,
        completed: newStatus === 'completed',
        completedAt: newStatus === 'completed' ? Date.now() : undefined,
        statusNote: undefined,
        notes: {
          ...currentNotes,
          ...(newStatus && { [newStatus]: note !== undefined ? note : currentNotes[newStatus] })
        }
      };
    });

    // Update local state for all of them
    const newInstancesState = [...state.taskInstances];
    updatedInstances.forEach(updated => {
      const idx = newInstancesState.findIndex(t => t.id === updated.id);
      if (idx >= 0) newInstancesState[idx] = updated;
    });
    set({ taskInstances: newInstancesState });

    // Sync all of them to Supabase
    for (const inst of updatedInstances) {
      await syncTaskInstance(inst, userId);
    }
  },

  updateTaskNote: async (routineId, date, status, note) => {
    const userId = await getUserId();
    const instanceId = `${routineId}_${date}`;
    const state = get();
    const existingIndex = state.taskInstances.findIndex((t) => t.id === instanceId);
    
    let newTaskInstance: TaskInstance;

    if (existingIndex >= 0) {
      const current = state.taskInstances[existingIndex];
      newTaskInstance = {
        ...current,
        notes: {
          ...current.notes,
          [status]: note,
        }
      };
      const newInstances = [...state.taskInstances];
      newInstances[existingIndex] = newTaskInstance;
      set({ taskInstances: newInstances });
    } else {
      newTaskInstance = {
        id: instanceId,
        routineId,
        date,
        status: 'pending',
        completed: false,
        notes: { [status]: note },
      };
      set({ taskInstances: [...state.taskInstances, newTaskInstance] });
    }

    await syncTaskInstance(newTaskInstance, userId);
  },

  addNotification: (title, message, routineId, dateStr) => {
    set(state => {
      const newNotif = {
        id: crypto.randomUUID(),
        title,
        message,
        read: false,
        timestamp: Date.now(),
        routineId,
        dateStr
      };
      const updated = [newNotif, ...state.appNotifications].slice(0, 50); // Keep last 50
      localStorage.setItem('app_notifications', JSON.stringify(updated));
      return { appNotifications: updated };
    });
  },

  markNotificationsAsRead: () => {
    set(state => {
      const updated = state.appNotifications.map(n => ({ ...n, read: true }));
      localStorage.setItem('app_notifications', JSON.stringify(updated));
      return { appNotifications: updated };
    });
  },

  toggleNotificationRead: (id) => {
    set(state => {
      const updated = state.appNotifications.map(n =>
        n.id === id ? { ...n, read: !n.read } : n
      );
      localStorage.setItem('app_notifications', JSON.stringify(updated));
      return { appNotifications: updated };
    });
  },

  clearNotifications: () => {
    localStorage.setItem('app_notifications', '[]');
    set({ appNotifications: [] });
  },

  deleteNotificationsByIds: (ids) => {
    set(state => {
      const updated = state.appNotifications.filter(n => !ids.includes(n.id));
      localStorage.setItem('app_notifications', JSON.stringify(updated));
      return { appNotifications: updated };
    });
  },

  setNotificationsRead: (ids, read) => {
    set(state => {
      const updated = state.appNotifications.map(n =>
        ids.includes(n.id) ? { ...n, read } : n
      );
      localStorage.setItem('app_notifications', JSON.stringify(updated));
      return { appNotifications: updated };
    });
  },

  markNotificationRead: (id) => {
    set(state => {
      const updated = state.appNotifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      );
      localStorage.setItem('app_notifications', JSON.stringify(updated));
      return { appNotifications: updated };
    });
  },

}));

async function syncTaskInstance(task: TaskInstance, userId: string) {
  await supabase.from('task_instances').upsert({
    id: task.id,
    user_id: userId,
    routine_id: task.routineId,
    date: task.date,
    completed: task.completed,
    status: task.status,
    status_note: task.statusNote,
    notes: task.notes,
    completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : null,
  });
}
