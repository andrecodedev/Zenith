import { format, isWeekend, getDay, parseISO } from 'date-fns';
import type { Routine } from '../types';

export const getTodayStr = () => format(new Date(), 'yyyy-MM-dd');

export const isTaskDueToday = (routine: Routine, dateStr: string) => {
  const date = parseISO(dateStr);
  const dayOfWeek = getDay(date); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  switch (routine.recurrence) {
    case 'daily':
      return true;
    case 'weekdays':
      return !isWeekend(date);
    case 'weekends':
      return isWeekend(date);
    case 'custom':
      return routine.customDays?.includes(dayOfWeek) ?? false;
    default:
      return false;
  }
};
