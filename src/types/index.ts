export type RecurrenceType = 'daily' | 'weekdays' | 'weekends' | 'custom' | 'once';

export interface Routine {
  id: string;
  title: string;
  categoryId: string;
  recurrence: RecurrenceType;
  customDays?: number[]; // 0 = Sunday, 1 = Monday, etc.
  date?: string; // YYYY-MM-DD for 'once'
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface TaskInstance {
  id: string; // usually routineId_date
  routineId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  completedAt?: number;
}
