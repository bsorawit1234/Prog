export type StatPoint = {
  label: string;
  volumeKg: number;
  sessions: number;
};

export type TrainingStatSet = {
  sessionId: string;
  startedAt: string;
  exerciseKey: string;
  weightKg: number;
  reps: number;
  completed: boolean;
};

export type TrainingStatSession = {
  id: string;
  started_at: string;
  duration_seconds: number | null;
};

export type CalculatedTrainingStats = {
  sessions: number;
  volumeKg: number;
  completedSets: number;
  durationSeconds: number;
  personalRecords: number;
  currentWeekVolumeKg: number;
  previousWeekVolumeKg: number;
  weeklyPoints: StatPoint[];
  volumeByDate: Record<string, number>;
  exerciseMaxes: Record<string, number>;
};

function localDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfWeek(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

export function calculateTrainingStats(sessions: TrainingStatSession[], sets: TrainingStatSet[], now = new Date()): CalculatedTrainingStats {
  const volumeByDate: Record<string, number> = {};
  const exerciseMaxes: Record<string, number> = {};
  const weekly = new Map<string, StatPoint>();
  const currentWeek = startOfWeek(now).getTime();
  const previousWeek = currentWeek - 7 * 24 * 60 * 60 * 1000;
  let volumeKg = 0;
  let completedSets = 0;
  let personalRecords = 0;

  for (const set of sets) {
    if (!set.completed) continue;
    completedSets += 1;
    const date = new Date(set.startedAt);
    const dayKey = localDateKey(date);
    const volume = Math.max(0, set.weightKg) * Math.max(0, set.reps);
    volumeKg += volume;
    volumeByDate[dayKey] = (volumeByDate[dayKey] || 0) + volume;
    const week = startOfWeek(date);
    const weekKey = localDateKey(week);
    const point = weekly.get(weekKey) || { label: week.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), volumeKg: 0, sessions: 0 };
    point.volumeKg += volume;
    weekly.set(weekKey, point);
    const previousMax = exerciseMaxes[set.exerciseKey] || 0;
    if (set.weightKg > previousMax) {
      exerciseMaxes[set.exerciseKey] = set.weightKg;
      personalRecords += 1;
    }
  }

  for (const session of sessions) {
    const week = startOfWeek(new Date(session.started_at));
    const key = localDateKey(week);
    const point = weekly.get(key) || { label: week.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), volumeKg: 0, sessions: 0 };
    point.sessions += 1;
    weekly.set(key, point);
  }

  const weeklyPoints = [...weekly.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([, point]) => point);
  const currentWeekVolumeKg = [...sets].filter((set) => set.completed && startOfWeek(new Date(set.startedAt)).getTime() === currentWeek).reduce((sum, set) => sum + Math.max(0, set.weightKg) * Math.max(0, set.reps), 0);
  const previousWeekVolumeKg = [...sets].filter((set) => set.completed && startOfWeek(new Date(set.startedAt)).getTime() === previousWeek).reduce((sum, set) => sum + Math.max(0, set.weightKg) * Math.max(0, set.reps), 0);

  return {
    sessions: sessions.length,
    volumeKg,
    completedSets,
    durationSeconds: sessions.reduce((total, session) => total + (session.duration_seconds || 0), 0),
    personalRecords,
    currentWeekVolumeKg,
    previousWeekVolumeKg,
    weeklyPoints,
    volumeByDate,
    exerciseMaxes,
  };
}
