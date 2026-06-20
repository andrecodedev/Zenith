import { parseISO, isPast, startOfToday } from 'date-fns';
import type { Routine, TaskInstance, TaskStatus } from '../types';

export function computeTaskStatus(routine: Routine, dateStr: string, instance?: TaskInstance): TaskStatus {
  // Status explícito do usuário tem prioridade absoluta
  if (instance?.status) return instance.status;

  // Override global da rotina
  if (routine.statusOverride) return routine.statusOverride;

  // Flag legada de completed
  if (instance?.completed) return 'completed';

  // Sem status explícito: calcula automaticamente
  if (routine.time) {
    const scheduledDateTime = parseISO(`${dateStr}T${routine.time}`);
    if (isPast(scheduledDateTime)) return 'late';
  } else {
    const taskDate = parseISO(dateStr);
    if (taskDate < startOfToday()) return 'late';
  }

  return 'pending';
}
