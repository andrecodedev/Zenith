import { parseISO, isPast, startOfToday } from 'date-fns';
import type { Routine, TaskInstance, TaskStatus } from '../types';

export function computeTaskStatus(routine: Routine, dateStr: string, instance?: TaskInstance, timeStr?: string): TaskStatus {
  // Determina o status base
  let baseStatus: TaskStatus = 'pending';

  if (instance?.status) {
    baseStatus = instance.status;
  } else if (routine.statusOverride) {
    baseStatus = routine.statusOverride;
  } else if (instance?.completed) {
    baseStatus = 'completed';
  }

  // Se o status for qualquer coisa além de Pendente (Concluído, Férias, Cancelado, etc), ele é soberano.
  if (baseStatus !== 'pending') {
    return baseStatus;
  }

  // Inteligência: Se estiver Pendente, o relógio tem a palavra final. Se passou da hora, fica Atrasado.
  const timeToCheck = timeStr || routine.time;
  if (timeToCheck) {
    const scheduledDateTime = parseISO(`${dateStr}T${timeToCheck}`);
    if (isPast(scheduledDateTime)) return 'late';
  } else {
    const taskDate = parseISO(dateStr);
    if (taskDate < startOfToday()) return 'late';
  }

  return 'pending';
}
