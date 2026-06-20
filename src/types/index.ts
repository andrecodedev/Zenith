export type RecurrenceType = 'daily' | 'weekdays' | 'weekends' | 'custom' | 'once';

export interface Routine {
  id: string;
  title: string;
  description?: string;
  categoryId: string;
  recurrence: RecurrenceType;
  customDays?: number[]; // 0 = Sunday, 1 = Monday, etc.
  date?: string; // YYYY-MM-DD for 'once'
  time?: string; // HH:mm (optional time)
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'late';

export interface TaskInstance {
  id: string; // usually routineId_date
  routineId: string;
  date: string; // YYYY-MM-DD
  completed: boolean; // Keep for legacy
  status?: TaskStatus;
  statusNote?: string; // Legacy
  notes?: Partial<Record<TaskStatus, string>>;
  completedAt?: number;
}
