import { format, isWeekend, getDay, parseISO, addDays, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Routine } from '../types';

export const getTodayStr = () => format(new Date(), 'yyyy-MM-dd');

export const generateWeek = (baseDateStr: string) => {
  const baseDate = parseISO(baseDateStr);
  const week = [];
  // Gera 3 dias antes, o dia atual, e 3 dias depois
  for (let i = -3; i <= 3; i++) {
    const d = addDays(baseDate, i);
    week.push({
      dateStr: format(d, 'yyyy-MM-dd'),
      dayName: format(d, 'eee', { locale: ptBR }),
      dayNumber: format(d, 'dd'),
    });
  }
  return week;
};

export const generateCalendarWeek = (baseDateStr: string) => {
  const baseDate = parseISO(baseDateStr);
  const startDay = startOfWeek(baseDate, { weekStartsOn: 0 }); // 0 = Domingo
  const week = [];
  for (let i = 0; i <= 6; i++) {
    const d = addDays(startDay, i);
    week.push({
      dateStr: format(d, 'yyyy-MM-dd'),
      dayName: format(d, 'eee', { locale: ptBR }),
      dayNumber: format(d, 'dd'),
    });
  }
  return week;
};

export const isTaskDueToday = (routine: Routine, dateStr: string) => {
  // Não exibe a tarefa em dias anteriores à sua criação
  if (routine.createdAt) {
    const createdDateStr = format(new Date(routine.createdAt), 'yyyy-MM-dd');
    if (dateStr < createdDateStr) {
      return false;
    }
  }

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
    case 'once':
      return routine.date === dateStr;
    default:
      return false;
  }
};
