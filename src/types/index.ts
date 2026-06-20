export type RecurrenceType = 'daily' | 'weekdays' | 'weekends' | 'custom';

export interface Routine {
  id: string;
  title: string;
  categoryId: string;
  recurrence: RecurrenceType;
  customDays?: number[]; // 0 = Sunday, 1 = Monday, etc.
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
