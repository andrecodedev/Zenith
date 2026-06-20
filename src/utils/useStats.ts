import { useMemo } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useStore } from '../store/useStore';
import { isTaskDueToday, getTodayStr } from './date';

export interface DayData {
  dateStr: string;
  label: string;
  total: number;
  completed: number;
  pct: number;
}

export interface Stats {
  currentStreak: number;
  bestStreak: number;
  weekData: DayData[];
  weeklyPct: number;
  totalCompletedAllTime: number;
  todayTotal: number;
  todayCompleted: number;
}

export function useStats(referenceDate?: string): Stats {
  const routines = useStore(s => s.routines);
  const taskInstances = useStore(s => s.taskInstances);

  return useMemo(() => {
    const today = getTodayStr();
    const endDate = referenceDate ?? today;

    const getDayData = (dateStr: string): DayData => {
      const due = routines.filter(r => isTaskDueToday(r, dateStr));
      const completed = due.filter(r =>
        taskInstances.some(t => t.routineId === r.id && t.date === dateStr && t.completed)
      );
      const pct = due.length === 0 ? 0 : Math.round((completed.length / due.length) * 100);
      const label = format(parseISO(dateStr), 'EEE', { locale: ptBR }).slice(0, 3);
      return { dateStr, label, total: due.length, completed: completed.length, pct };
    };

    // 7 days ending on referenceDate
    const weekData: DayData[] = Array.from({ length: 7 }, (_, i) => {
      const dateStr = format(subDays(parseISO(endDate), 6 - i), 'yyyy-MM-dd');
      return getDayData(dateStr);
    });

    const weeklyPct = (() => {
      const daysWithTasks = weekData.filter(d => d.total > 0);
      if (daysWithTasks.length === 0) return 0;
      return Math.round(daysWithTasks.reduce((acc, d) => acc + d.pct, 0) / daysWithTasks.length);
    })();

    // Current streak — always from today, ignores referenceDate
    let currentStreak = 0;
    for (let i = 0; i <= 365; i++) {
      const dateStr = format(subDays(parseISO(today), i), 'yyyy-MM-dd');
      const due = routines.filter(r => isTaskDueToday(r, dateStr));
      if (due.length === 0) continue;
      const hasCompleted = taskInstances.some(t => t.date === dateStr && t.completed);
      if (hasCompleted) {
        currentStreak++;
      } else if (i > 0) {
        break;
      }
    }

    // Best streak — from all completed dates
    const completedDates = Array.from(
      new Set(taskInstances.filter(t => t.completed).map(t => t.date))
    ).sort();

    let bestStreak = currentStreak;
    let tempStreak = 1;
    for (let i = 1; i < completedDates.length; i++) {
      const prev = parseISO(completedDates[i - 1]);
      const curr = parseISO(completedDates[i]);
      const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diff === 1) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }

    const totalCompletedAllTime = taskInstances.filter(t => t.completed).length;
    const todayData = getDayData(today);

    return {
      currentStreak,
      bestStreak,
      weekData,
      weeklyPct,
      totalCompletedAllTime,
      todayTotal: todayData.total,
      todayCompleted: todayData.completed,
    };
  }, [routines, taskInstances, referenceDate]);
}
