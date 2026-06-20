import { parseISO, isPast, startOfToday } from 'date-fns';
import type { Routine, TaskInstance, TaskStatus } from '../types';

export function computeTaskStatus(routine: Routine, dateStr: string, instance?: TaskInstance): TaskStatus | 'late' {
  const explicitStatus = instance?.status || routine.statusOverride || (instance?.completed ? 'completed' : 'pending');
  
  if (explicitStatus === 'completed') {
    return 'completed';
  }

  // If time exists, check if past that exact time
  if (routine.time) {
    const scheduledDateTime = parseISO(`${dateStr}T${routine.time}`);
    if (isPast(scheduledDateTime)) {
      return 'late';
    }
  } else {
    // If no time, it's late if the date is strictly before today
    const taskDate = parseISO(dateStr);
    if (taskDate < startOfToday()) {
      return 'late';
    }
  }

  return explicitStatus;
}
