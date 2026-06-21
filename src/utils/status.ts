import { parseISO, isPast, startOfToday } from 'date-fns';
import type { Routine, TaskInstance, TaskStatus } from '../types';

export function computeTaskStatus(routine: Routine, dateStr: string, instance?: TaskInstance, timeStr?: string): TaskStatus {
  // Determina se é estritamente Automática (nenhum input do usuário no ciclo de vida atual)
  const isAutomatic = !instance?.status && !routine.statusOverride && !instance?.completed;

  if (isAutomatic) {
    const timeToCheck = timeStr || routine.time;
    if (timeToCheck) {
      const startDateTime = parseISO(`${dateStr}T${timeToCheck}`);
      
      let endDateTime: Date;
      if (!timeStr && routine.endTime) {
        endDateTime = parseISO(`${dateStr}T${routine.endTime}`);
      } else {
        // Assume 1 hora de duração para calcular o término automático se não tiver endTime
        endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
      }

      const now = new Date();

      if (now < startDateTime) return 'pending';
      if (now < endDateTime) return 'in_progress';
      return 'completed'; // Já passou do fim, conclui automaticamente
    } else {
      const taskDate = parseISO(dateStr);
      if (taskDate < startOfToday()) return 'completed';
      return 'pending';
    }
  }

  // FLUXO MANUAL
  let baseStatus: TaskStatus = 'pending';

  if (instance?.status) {
    baseStatus = instance.status;
  } else if (routine.statusOverride) {
    baseStatus = routine.statusOverride;
  } else if (instance?.completed) {
    baseStatus = 'completed';
  }

  if (baseStatus !== 'pending') {
    return baseStatus;
  }

  // Inteligência para Tarefa MANUAL: Se estiver Pendente e passar da hora, ele ATRASA, pois exige check.
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
