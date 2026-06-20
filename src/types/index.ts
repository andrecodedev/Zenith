export type RecurrenceType = 'daily' | 'weekdays' | 'weekends' | 'custom' | 'once' | 'multiple_times';

export interface Routine {
  id: string;
  title: string;
  description?: string;
  categoryId: string;
  recurrence: RecurrenceType;
  customDays?: number[]; // 0 = Sunday, 1 = Monday, etc.
  date?: string; // YYYY-MM-DD for 'once'
  time?: string; // HH:mm (optional time)
  endTime?: string; // HH:mm (optional end time)
  times?: string[]; // HH:mm[] for multiple_times recurrence
  excludedDates?: string[]; // YYYY-MM-DD dates where this routine should not appear
  statusOverride?: TaskStatus; // Global status override for all instances
  notesOverride?: string; // Global notes override
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'late' | 'canceled';

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

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  timestamp: number;
  routineId?: string;
  dateStr?: string;
}
