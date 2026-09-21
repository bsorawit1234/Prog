'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '../lib/supabase/browser';

type Tab = 'overview' | 'workout' | 'calendar' | 'progress';
type Unit = 'kg' | 'lb';
type Theme = 'light' | 'dark';
type SetKind = 'warmup' | 'working' | 'backoff' | 'drop' | 'failure';
type SetLog = { id: string; weight: number; reps: number; unit: Unit; kind: SetKind; done: boolean };
type ExerciseLog = { id: string; dbId?: string; name: string; muscle: string; restSeconds: number; sets: SetLog[] };
type LibraryExercise = { id: string; name: string; primary_muscle: string; equipment: string; default_weight_unit?: Unit };
type Routine = { id: string; dbId?: string; programId?: string; code: string; color: string; name: string; focus: string; exercises: ExerciseLog[]; lastTrained: string };
type RecentSession = { id: string; name: string; started_at: string; duration_seconds: number | null };
type PreviousPerformance = { weight: number; reps: number; unit: Unit; kind: SetKind };
type TrainingStats = { sessions: number; volumeKg: number; completedSets: number; durationSeconds: number; personalRecords: number };
type HistoryExercise = { name: string; muscle: string; sets: PreviousPerformance[] };
type HistorySession = RecentSession & { completed_at: string | null; notes: string | null; exercises: HistoryExercise[] };
type WorkoutDraft = { routine: Routine; startedAt: number; logs: ExerciseLog[] };

const weekdayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const restDurationOptions = [0, ...Array.from({ length: 60 }, (_, index) => (index + 1) * 5)];

function formatRestDuration(seconds: number) {
  if (seconds === 0) return 'Off';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s`;
  if (remainder === 0) return `${minutes}m`;
  return `${minutes}m ${remainder}s`;
}

function RestPicker({ value, onSelect, close }: { value: number; onSelect: (seconds: number) => void; close: () => void }) {
  const [pendingValue, setPendingValue] = useState(value);
  const wheelRef = useRef<HTMLDivElement>(null);
  const rowHeight = 44;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const index = Math.max(0, restDurationOptions.indexOf(value));
      wheelRef.current?.scrollTo({ top: index * rowHeight });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  function handleWheelScroll() {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const index = Math.max(0, Math.min(restDurationOptions.length - 1, Math.round(wheel.scrollTop / rowHeight)));
    setPendingValue(restDurationOptions[index]);
  }

  return <div className="rest-picker-backdrop" onClick={close}><div className="rest-picker-sheet" role="dialog" aria-modal="true" aria-label="Choose rest time" onClick={(event) => event.stopPropagation()}><div className="rest-picker-handle" /><div className="rest-picker-header"><div><Kicker>REST TIMER</Kicker><h2>Auto rest</h2></div><button className="rest-picker-done" onClick={() => { onSelect(pendingValue); close(); }}>Done</button></div><p className="rest-picker-copy">Scroll to choose the time after each completed set.</p><div className="rest-picker-wheel-frame"><div className="rest-picker-fade top" /><div className="rest-picker-selection" /><div className="rest-picker-fade bottom" /><div className="rest-picker-wheel" ref={wheelRef} onScroll={handleWheelScroll} role="listbox" aria-label="Rest duration"><div aria-hidden="true" className="rest-picker-spacer" />{restDurationOptions.map((seconds) => <button className={seconds === pendingValue ? 'rest-option selected' : 'rest-option'} key={seconds} role="option" aria-selected={seconds === pendingValue} onClick={() => { setPendingValue(seconds); wheelRef.current?.scrollTo({ top: restDurationOptions.indexOf(seconds) * rowHeight, behavior: 'smooth' }); }}>{formatRestDuration(seconds)}</button>)}<div aria-hidden="true" className="rest-picker-spacer" /></div></div></div></div>;
}

const starterExercises: ExerciseLog[] = [
  { id: 'bench', name: 'Barbell Bench Press', muscle: 'Chest · Barbell', restSeconds: 120, sets: [
    { id: 'b1', weight: 80, reps: 8, unit: 'kg', kind: 'working', done: true },
    { id: 'b2', weight: 80, reps: 8, unit: 'kg', kind: 'working', done: true },
    { id: 'b3', weight: 80, reps: 7, unit: 'kg', kind: 'working', done: false },
  ] },
  { id: 'row', name: 'Seated Cable Row', muscle: 'Back · Machine', restSeconds: 120, sets: [
    { id: 'r1', weight: 145, reps: 10, unit: 'lb', kind: 'working', done: true },
    { id: 'r2', weight: 145, reps: 10, unit: 'lb', kind: 'working', done: false },
    { id: 'r3', weight: 145, reps: 10, unit: 'lb', kind: 'working', done: false },
  ] },
  { id: 'shoulder', name: 'Dumbbell Shoulder Press', muscle: 'Shoulders · Dumbbell', restSeconds: 90, sets: [
    { id: 's1', weight: 24, reps: 10, unit: 'kg', kind: 'working', done: false },
    { id: 's2', weight: 24, reps: 10, unit: 'kg', kind: 'working', done: false },
    { id: 's3', weight: 24, reps: 10, unit: 'kg', kind: 'working', done: false },
  ] },
];

const initialRoutines: Routine[] = [
  { id: 'upper-a', code: 'UA', color: 'coral', name: 'Upper A', focus: 'Chest · back · shoulders', exercises: starterExercises, lastTrained: 'Aug 27' },
  { id: 'lower-a', code: 'LA', color: 'violet', name: 'Lower A', focus: 'Quads · hamstrings · core', exercises: starterExercises.slice(0, 2), lastTrained: 'Aug 25' },
  { id: 'push-b', code: 'PB', color: 'amber', name: 'Push B', focus: 'Chest · shoulders · triceps', exercises: starterExercises.slice(0, 1), lastTrained: 'Aug 22' },
];

function Logo() { return <div className="brand"><span className="brand-bars"><i /><i /><i /></span><span>prog</span></div>; }
function Icon({ children }: { children: ReactNode }) { return <span className="icon" aria-hidden="true">{children}</span>; }
function Kicker({ children }: { children: ReactNode }) { return <p className="kicker">{children}</p>; }
function cloneLogs(logs: ExerciseLog[]) { return logs.map((exercise) => ({ ...exercise, id: crypto.randomUUID(), sets: exercise.sets.map((set) => ({ ...set, id: crypto.randomUUID(), done: false })) })); }
function draftKey(userId?: string) { return `prog-workout-draft:${userId || 'guest'}`; }
function dateKey(value: Date | string) { const date = value instanceof Date ? value : new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function emptyStats(): TrainingStats { return { sessions: 0, volumeKg: 0, completedSets: 0, durationSeconds: 0, personalRecords: 0 }; }

export default function Home() {
  const [tab, setTab] = useState<Tab>('overview');
  const [showStart, setShowStart] = useState(false);
  const [showPrograms, setShowPrograms] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [replaceExerciseId, setReplaceExerciseId] = useState<string | null>(null);
  const [showCreateRoutine, setShowCreateRoutine] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [showFinishReview, setShowFinishReview] = useState(false);
  const [pendingStartRoutine, setPendingStartRoutine] = useState<Routine | null>(null);
  const [historyDetail, setHistoryDetail] = useState<HistorySession | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const [routineFocus, setRoutineFocus] = useState('');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseMuscle, setExerciseMuscle] = useState('');
  const [exerciseMessage, setExerciseMessage] = useState('');
  const [routines, setRoutines] = useState(initialRoutines);
  const [activeRoutine, setActiveRoutine] = useState(initialRoutines[0]);
  const [logs, setLogs] = useState(starterExercises);
  const [exerciseLibrary, setExerciseLibrary] = useState<LibraryExercise[]>([]);
  const [timerRequest, setTimerRequest] = useState<{ seconds: number; token: number; label: string } | null>(null);
  const [workoutStartedAt, setWorkoutStartedAt] = useState<number | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [theme, setTheme] = useState<Theme>('light');
  const [supabase] = useState<SupabaseClient | null>(() => {
    if (typeof window === 'undefined') return null;
    try { return createClient(); } catch { return null; }
  });
  const [user, setUser] = useState<User | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [previousByExercise, setPreviousByExercise] = useState<Record<string, PreviousPerformance[]>>({});
  const [trainingStats, setTrainingStats] = useState<TrainingStats>(emptyStats());
  const [authOpen, setAuthOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [todayLabel, setTodayLabel] = useState('TODAY');

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('prog-theme');
    if (storedTheme === 'dark' || storedTheme === 'light') window.setTimeout(() => setTheme(storedTheme), 0);
    window.setTimeout(() => setTodayLabel(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()), 0);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('prog-theme', theme);
  }, [theme]);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(draftKey()) || window.localStorage.getItem('prog-workout-draft');
      const draft = JSON.parse(stored || 'null') as (Partial<WorkoutDraft> & { routineId?: string }) | null;
      const routine = draft?.routine || (draft?.routineId ? initialRoutines.find((item) => item.id === draft.routineId) : undefined);
      if (routine && draft?.startedAt && draft.logs) {
        window.setTimeout(() => {
          setActiveRoutine(routine);
          setLogs(draft.logs || []);
          setWorkoutStartedAt(draft.startedAt || null);
          setTab('workout');
        }, 0);
      }
    } catch {
      window.localStorage.removeItem(draftKey());
      window.localStorage.removeItem('prog-workout-draft');
    } finally {
      window.setTimeout(() => setDraftReady(true), 0);
    }
  }, []);
  useEffect(() => {
    if (!draftReady) return;
    if (workoutStartedAt) {
      const draft: WorkoutDraft = { routine: activeRoutine, startedAt: workoutStartedAt, logs };
      window.localStorage.setItem(draftKey(user?.id), JSON.stringify(draft));
    } else {
      window.localStorage.removeItem(draftKey(user?.id));
    }
  }, [activeRoutine, draftReady, logs, user?.id, workoutStartedAt]);

  useEffect(() => {
    if (!draftReady || !user?.id || workoutStartedAt) return;
    try {
      const stored = window.localStorage.getItem(draftKey(user.id));
      const draft = JSON.parse(stored || 'null') as WorkoutDraft | null;
      if (draft?.routine && draft.startedAt && draft.logs?.length >= 0) {
        window.setTimeout(() => {
          setActiveRoutine(draft.routine);
          setLogs(draft.logs);
          setWorkoutStartedAt(draft.startedAt);
          setTab('workout');
        }, 0);
      }
    } catch {
      window.localStorage.removeItem(draftKey(user.id));
    }
  }, [draftReady, user?.id, workoutStartedAt]);
  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);
  useEffect(() => {
    if (!supabase || !user) return;
    let cancelled = false;
    async function loadTrainingData() {
      const [{ data: sessions }, { data: library }, { data: programs }, { data: routines }, { data: routineExercises }] = await Promise.all([
        supabase.from('workout_sessions').select('id,name,started_at,duration_seconds').eq('owner_id', user.id).eq('status', 'completed').order('started_at', { ascending: false }).limit(100),
        supabase.from('exercises').select('id,name,primary_muscle,equipment,default_weight_unit').eq('owner_id', user.id).is('archived_at', null).order('name').limit(200),
        supabase.from('programs').select('id,name').eq('owner_id', user.id).eq('status', 'active').order('created_at'),
        supabase.from('routines').select('id,program_id,name,sequence_position,estimated_minutes,notes').eq('owner_id', user.id).order('sequence_position'),
        supabase.from('routine_exercises').select('id,routine_id,exercise_id,position,rest_seconds,exercises(id,name,primary_muscle,equipment,default_weight_unit)').order('position'),
      ]);
      if (cancelled) return;
      const nextSessions = (sessions ?? []) as RecentSession[];
      setRecentSessions(nextSessions);
      setExerciseLibrary((library ?? []) as LibraryExercise[]);
      const programNames = new Map((programs ?? []).map((program) => [program.id, program.name]));
      const grouped = new Map<string, ExerciseLog[]>();
      (routineExercises ?? []).forEach((item) => {
        const exercise = Array.isArray(item.exercises) ? item.exercises[0] : item.exercises;
        if (!exercise) return;
        const list = grouped.get(item.routine_id) || [];
        list.push({ id: `${item.routine_id}-${item.position}`, dbId: exercise.id, name: exercise.name, muscle: `${exercise.primary_muscle} · ${exercise.equipment}`, restSeconds: item.rest_seconds || 120, sets: [{ id: `${item.routine_id}-${item.position}-1`, weight: 0, reps: 0, unit: exercise.default_weight_unit || 'kg', kind: 'working', done: false }] });
        grouped.set(item.routine_id, list);
      });
      const remoteRoutines: Routine[] = (routines ?? []).map((routine) => ({ id: routine.id, dbId: routine.id, programId: routine.program_id, code: routine.name.split(/\s+/).map((word) => word[0]).join('').slice(0, 3).toUpperCase(), color: 'coral', name: routine.name, focus: routine.notes || programNames.get(routine.program_id) || 'Custom training day', exercises: grouped.get(routine.id) || [], lastTrained: 'Not trained yet' }));
      if (!workoutStartedAt) {
        setRoutines(remoteRoutines);
        setActiveRoutine(remoteRoutines[0] || { id: 'empty', code: '＋', color: 'green', name: 'Empty workout', focus: 'Add exercises as you go', exercises: [], lastTrained: 'Not trained yet' });
      }

      const sessionIds = nextSessions.map((session) => session.id);
      if (!sessionIds.length) { setPreviousByExercise({}); setTrainingStats(emptyStats()); return; }
      const { data: exerciseRows } = await supabase.from('workout_exercises').select('session_id,exercise_id,exercise_name_snapshot,muscle_snapshot,position,workout_sets(position,set_type,weight_value,weight_unit,reps,completed_at,normalized_weight_kg)').in('session_id', sessionIds).order('position');
      if (cancelled) return;
      const previous: Record<string, PreviousPerformance[]> = {};
      const seen = new Set<string>();
      let volumeKgTotal = 0;
      let completedSetsTotal = 0;
      let personalRecords = 0;
      const sessionOrder = new Map(nextSessions.map((session, index) => [session.id, index]));
      const orderedExerciseRows = [...(exerciseRows ?? [])].sort((a, b) => (sessionOrder.get(a.session_id) ?? 999) - (sessionOrder.get(b.session_id) ?? 999));
      orderedExerciseRows.forEach((row) => {
        const key = row.exercise_id || row.exercise_name_snapshot;
        const sets = (Array.isArray(row.workout_sets) ? row.workout_sets : []).map((set) => ({ weight: Number(set.weight_value || 0), reps: Number(set.reps || 0), unit: (set.weight_unit || 'kg') as Unit, kind: set.set_type as SetKind }));
        if (!seen.has(key)) { previous[key] = sets; seen.add(key); }
        (Array.isArray(row.workout_sets) ? row.workout_sets : []).forEach((set) => {
          if (!set.completed_at) return;
          completedSetsTotal += 1;
          volumeKgTotal += Number(set.normalized_weight_kg || 0) * Number(set.reps || 0);
        });
      });
      const maxByExercise = new Map<string, number>();
      orderedExerciseRows.forEach((row) => (Array.isArray(row.workout_sets) ? row.workout_sets : []).forEach((set) => { if (set.completed_at) { const key = row.exercise_id || row.exercise_name_snapshot; const weight = Number(set.normalized_weight_kg || 0); if (weight > (maxByExercise.get(key) || 0)) { maxByExercise.set(key, weight); personalRecords += 1; } } }));
      setPreviousByExercise(previous);
      setTrainingStats({ sessions: nextSessions.length, volumeKg: volumeKgTotal, completedSets: completedSetsTotal, durationSeconds: nextSessions.reduce((total, session) => total + (session.duration_seconds || 0), 0), personalRecords });
    }
    void loadTrainingData();
    return () => { cancelled = true; };
  }, [saved, supabase, user, workoutStartedAt]);

  const allSets = logs.flatMap((exercise) => exercise.sets);
  const completed = allSets.filter((set) => set.done).length;
  const volumeKg = allSets.reduce((total, set) => total + (set.done ? (set.unit === 'lb' ? set.weight / 2.20462 : set.weight) * set.reps : 0), 0);
  const progress = allSets.length ? Math.round((completed / allSets.length) * 100) : 0;

  function toggleSet(exerciseId: string, setId: string) {
    const exercise = logs.find((item) => item.id === exerciseId);
    const set = exercise?.sets.find((item) => item.id === setId);
    if (exercise && set && !set.done) setTimerRequest(exercise.restSeconds > 0 ? { seconds: exercise.restSeconds, token: Date.now(), label: exercise.name } : null);
    setLogs((current) => current.map((item) => item.id !== exerciseId ? item : { ...item, sets: item.sets.map((itemSet) => itemSet.id === setId ? { ...itemSet, done: !itemSet.done } : itemSet) }));
  }
  function toggleUnit(exerciseId: string) {
    const exercise = logs.find((item) => item.id === exerciseId);
    const targetUnit: Unit = exercise?.sets[0]?.unit === 'lb' ? 'kg' : 'lb';
    setLogs((current) => current.map((item) => item.id !== exerciseId ? item : { ...item, sets: item.sets.map((set) => {
      if (set.unit === targetUnit) return set;
      const convertedWeight = targetUnit === 'lb' ? set.weight * 2.20462 : set.weight / 2.20462;
      return { ...set, unit: targetUnit, weight: Math.round(convertedWeight * 10) / 10 };
    }) }));
  }
  function updateSet(exerciseId: string, setId: string, patch: Partial<SetLog>) { setLogs((current) => current.map((exercise) => exercise.id !== exerciseId ? exercise : { ...exercise, sets: exercise.sets.map((set) => set.id === setId ? { ...set, ...patch } : set) })); }
  function addSet(exerciseId: string) { setLogs((current) => current.map((exercise) => { if (exercise.id !== exerciseId) return exercise; const last = exercise.sets[exercise.sets.length - 1]; return { ...exercise, sets: [...exercise.sets, { ...last, id: crypto.randomUUID(), done: false, kind: 'working' }] }; })); }
  function removeSet(exerciseId: string, setId: string) { setLogs((current) => current.map((exercise) => exercise.id !== exerciseId ? exercise : { ...exercise, sets: exercise.sets.length > 1 ? exercise.sets.filter((set) => set.id !== setId) : exercise.sets })); }
  function renameExercise(exerciseId: string, name: string) { setLogs((current) => current.map((exercise) => exercise.id === exerciseId ? { ...exercise, name } : exercise)); }
  function addExerciseToWorkout(exercise: LibraryExercise) {
    setLogs((current) => {
      if (replaceExerciseId) return current.map((item) => item.id === replaceExerciseId ? { ...item, dbId: exercise.id, name: exercise.name, muscle: `${exercise.primary_muscle} · ${exercise.equipment}`, sets: [{ id: crypto.randomUUID(), weight: 0, reps: 0, unit: exercise.default_weight_unit || 'kg', kind: 'working', done: false }] } : item);
      return [...current, { id: crypto.randomUUID(), dbId: exercise.id, name: exercise.name, muscle: `${exercise.primary_muscle} · ${exercise.equipment}`, restSeconds: 120, sets: [{ id: crypto.randomUUID(), weight: 0, reps: 0, unit: exercise.default_weight_unit || 'kg', kind: 'working', done: false }] }];
    });
    setReplaceExerciseId(null); setShowExercisePicker(false); setExerciseSearch(''); setExerciseMessage('');
  }
  async function createExercise() {
    const name = exerciseName.trim();
    if (!name) { setExerciseMessage('Give the exercise a name first.'); return; }
    const muscle = exerciseMuscle.trim() || 'Other';
    if (!supabase || !user) { setExerciseMessage('Sign in first so this exercise can be saved to Supabase.'); return; }
    const { data, error } = await supabase.from('exercises').insert({ owner_id: user.id, name, primary_muscle: muscle, equipment: 'Other', tracking_type: 'weight_reps', default_weight_unit: 'kg' }).select('id,name,primary_muscle,equipment,default_weight_unit').single();
    if (error || !data) { setExerciseMessage(error?.message || 'Could not create this exercise.'); return; }
    const created = data as LibraryExercise;
    setExerciseLibrary((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
    setExerciseName(''); setExerciseMuscle(''); addExerciseToWorkout(created);
  }

  function startWorkout(routine = activeRoutine, force = false) {
    if (!force && workoutStartedAt) {
      setPendingStartRoutine(routine);
      setShowResumePrompt(true);
      return;
    }
    setActiveRoutine(routine);
    setLogs(cloneLogs(routine.exercises));
    setWorkoutStartedAt(Date.now());
    setSaved(false); setSaveError(''); setShowStart(false); setShowPrograms(false); setShowCreateRoutine(false); setShowResumePrompt(false); setPendingStartRoutine(null); setTab('workout');
  }

  async function createRoutine() {
    const name = routineName.trim() || 'New routine';
    const focus = routineFocus.trim() || 'Custom training day';
    let routine: Routine = { id: crypto.randomUUID(), code: name.split(/\s+/).map((word) => word[0]).join('').slice(0, 3).toUpperCase(), color: 'green', name, focus, exercises: [], lastTrained: 'Not trained yet' };
    if (supabase && user) {
      const { data: existingPrograms } = await supabase.from('programs').select('id,name').eq('owner_id', user.id).eq('status', 'active').order('created_at').limit(1);
      let program = existingPrograms?.[0];
      let programError: { message: string } | null = null;
      if (!program) {
        const response = await supabase.from('programs').insert({ owner_id: user.id, name: 'My training plan', description: 'Personal routines' }).select('id,name').single();
        program = response.data;
        programError = response.error;
      }
      if (!programError && program) {
        const { data: remoteRoutine, error: routineError } = await supabase.from('routines').insert({ owner_id: user.id, program_id: program.id, name, notes: focus, sequence_position: routines.length }).select('id,program_id,name,notes').single();
        if (!routineError && remoteRoutine) routine = { ...routine, id: remoteRoutine.id, dbId: remoteRoutine.id, programId: remoteRoutine.program_id };
        else setSaveError(routineError?.message || 'Routine was created locally only.');
      } else if (programError) setSaveError(programError.message);
    }
    setRoutines((current) => [...current, routine]);
    setRoutineName(''); setRoutineFocus(''); setShowCreateRoutine(false); startWorkout(routine);
  }

  async function saveRoutineTemplate() {
    if (!supabase || !user || !activeRoutine.dbId) { setSaveError('Sign in and save this routine before applying workout changes to its template.'); return; }
    const routineExercises = logs.filter((exercise) => exercise.dbId).map((exercise, position) => ({ routine_id: activeRoutine.dbId, exercise_id: exercise.dbId, position, rest_seconds: exercise.restSeconds }));
    setSaveBusy(true); setSaveError('');
    const { error: deleteError } = await supabase.from('routine_exercises').delete().eq('routine_id', activeRoutine.dbId);
    if (deleteError) { setSaveError(deleteError.message); setSaveBusy(false); return; }
    const { error: insertError } = routineExercises.length ? await supabase.from('routine_exercises').insert(routineExercises) : { error: null };
    if (insertError) { setSaveError(insertError.message); setSaveBusy(false); return; }
    const updatedRoutine = { ...activeRoutine, exercises: logs.map((exercise) => ({ ...exercise, sets: exercise.sets.map((set) => ({ ...set, done: false })) })) };
    setActiveRoutine(updatedRoutine);
    setRoutines((current) => current.map((routine) => routine.id === updatedRoutine.id ? updatedRoutine : routine));
    setSaveBusy(false);
    setSaved(true);
  }

  async function finishWorkout() {
    if (saveBusy) return;
    if (!supabase || !user) { setAuthMessage('Sign in to save this workout to your history.'); setAuthOpen(true); return; }
    setSaveBusy(true); setSaveError('');
    const startedAtMs = workoutStartedAt ?? Date.now();
    const sessionId = crypto.randomUUID();
    const { error: sessionError } = await supabase.from('workout_sessions').insert({ id: sessionId, owner_id: user.id, program_id: activeRoutine.programId || null, routine_id: activeRoutine.dbId || null, name: activeRoutine.name, started_at: new Date(startedAtMs).toISOString(), completed_at: new Date().toISOString(), duration_seconds: Math.max(1, Math.round((Date.now() - startedAtMs) / 1000)), status: 'completed' });
    if (sessionError) { setSaveError(sessionError.message); setSaveBusy(false); return; }
    const workoutExercises = logs.map((exercise, position) => ({ id: crypto.randomUUID(), session_id: sessionId, exercise_id: exercise.dbId || null, exercise_name_snapshot: exercise.name, muscle_snapshot: exercise.muscle, position }));
    const { error: exerciseError } = await supabase.from('workout_exercises').insert(workoutExercises);
    if (exerciseError) { await supabase.from('workout_sessions').delete().eq('id', sessionId); setSaveError(exerciseError.message); setSaveBusy(false); return; }
    const workoutSets = logs.flatMap((exercise, exerciseIndex) => exercise.sets.map((set, position) => ({ id: crypto.randomUUID(), workout_exercise_id: workoutExercises[exerciseIndex].id, position, set_type: set.kind, weight_value: set.weight, weight_unit: set.unit, normalized_weight_kg: set.unit === 'lb' ? set.weight / 2.20462 : set.weight, reps: set.reps, rest_seconds: exercise.restSeconds || null, completed_at: set.done ? new Date().toISOString() : null })));
    const { error: setsError } = await supabase.from('workout_sets').insert(workoutSets);
    if (setsError) { await supabase.from('workout_sessions').delete().eq('id', sessionId); setSaveError(setsError.message); setSaveBusy(false); return; }
    setSaved(true); setSaveBusy(false); setWorkoutStartedAt(null); setTimerRequest(null); setShowFinishReview(false); setTab('overview');
  }

  async function signIn() {
    if (!supabase || !authEmail.trim()) return;
    setAuthBusy(true); setAuthMessage('Sending your sign-in link…');
    const { error } = await supabase.auth.signInWithOtp({ email: authEmail.trim(), options: { emailRedirectTo: window.location.origin } });
    setAuthMessage(error ? error.message : 'Check your email for the secure sign-in link.'); setAuthBusy(false);
  }
  async function openHistory(sessionId: string) {
    if (!supabase || !user) return;
    setHistoryBusy(true);
    const { data: session } = await supabase.from('workout_sessions').select('id,name,started_at,duration_seconds,completed_at,notes').eq('id', sessionId).eq('owner_id', user.id).single();
    const { data: exercises } = await supabase.from('workout_exercises').select('exercise_name_snapshot,muscle_snapshot,position,workout_sets(position,set_type,weight_value,weight_unit,reps,completed_at,normalized_weight_kg)').eq('session_id', sessionId).order('position');
    if (session) setHistoryDetail({ ...(session as RecentSession & { completed_at: string | null; notes: string | null }), exercises: (exercises ?? []).map((exercise) => ({ name: exercise.exercise_name_snapshot, muscle: exercise.muscle_snapshot, sets: (Array.isArray(exercise.workout_sets) ? exercise.workout_sets : []).map((set) => ({ weight: Number(set.weight_value || 0), reps: Number(set.reps || 0), unit: (set.weight_unit || 'kg') as Unit, kind: set.set_type as SetKind })) })) });
    setHistoryBusy(false);
  }
  async function deleteHistory(sessionId: string) {
    if (!supabase || !user || !window.confirm('Delete this saved workout from your history?')) return;
    setHistoryBusy(true);
    const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId).eq('owner_id', user.id);
    if (!error) { setHistoryDetail(null); setRecentSessions((current) => current.filter((session) => session.id !== sessionId)); setSaved(false); }
    else setSaveError(error.message);
    setHistoryBusy(false);
  }
  async function signOut() { await supabase?.auth.signOut(); setUser(null); setRecentSessions([]); setPreviousByExercise({}); setTrainingStats(emptyStats()); }
  function requestFinishWorkout() { setShowFinishReview(true); }

  return <main className="app-shell">
    <aside className="sidebar"><Logo /><Kicker>TRAIN</Kicker><nav className="side-nav" aria-label="Primary navigation">
      <button className={tab === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('overview')}><Icon>⌂</Icon>Overview</button>
      <button className={tab === 'workout' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('workout')}><Icon>◉</Icon>Workout {workoutStartedAt && <span className="status-dot" />}</button>
      <button className="nav-item" onClick={() => setShowPrograms(true)}><Icon>▤</Icon>Programs</button>
      <button className={tab === 'calendar' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('calendar')}><Icon>▦</Icon>Calendar</button>
      <button className={tab === 'progress' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('progress')}><Icon>↗</Icon>Progress</button>
    </nav><Kicker>LIBRARY</Kicker><nav className="side-nav library-nav"><button className="nav-item" onClick={() => setShowPrograms(true)}><Icon>＋</Icon>Exercises</button><button className="nav-item"><Icon>⚙</Icon>Settings</button></nav><div className="profile"><div className="avatar">BS</div><div><strong>Boa Sorawit</strong><span>Personal space</span></div><button aria-label="More profile actions">•••</button></div></aside>
    <section className="main-column"><header className="topbar"><div className="mobile-logo"><Logo /></div><div className="top-date"><Kicker>{todayLabel}</Kicker><span className="saved-state"><i /> {user ? 'Supabase connected' : 'Preview mode'}</span></div><div className="top-actions"><button className="theme-toggle" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? '☾' : '☀'}</button>{user ? <button className="user-pill" onClick={signOut}>{user.email?.split('@')[0]} · sign out</button> : <button className="sign-in-button" onClick={() => { setAuthMessage(''); setAuthOpen(true); }}>Sign in</button>}<div className="avatar small">BS</div></div></header>
      {tab === 'overview' && <Overview nextRoutine={activeRoutine} onStart={() => setShowStart(true)} onCalendar={() => setTab('calendar')} saved={saved} saveError={saveError} recentSessions={recentSessions} stats={trainingStats} onPrograms={() => setShowPrograms(true)} onOpenSession={openHistory} />}
      {tab === 'workout' && <Workout routine={activeRoutine} startedAt={workoutStartedAt} logs={logs} previousByExercise={previousByExercise} completed={completed} progress={progress} volumeKg={volumeKg} saveBusy={saveBusy} timerRequest={timerRequest} onToggle={toggleSet} onUnit={toggleUnit} onUpdate={updateSet} onAddSet={addSet} onRemoveSet={removeSet} onRename={renameExercise} onRestDurationChange={(exerciseId, restSeconds) => setLogs((current) => current.map((exercise) => exercise.id === exerciseId ? { ...exercise, restSeconds } : exercise))} onReorder={(exerciseId) => setLogs((current) => { const index = current.findIndex((exercise) => exercise.id === exerciseId); if (index < 0 || index === current.length - 1) return current; const next = [...current]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })} onReplace={(exerciseId) => { setReplaceExerciseId(exerciseId); setExerciseMessage(''); setShowExercisePicker(true); }} onRemove={(exerciseId) => setLogs((current) => current.filter((exercise) => exercise.id !== exerciseId))} onAddExercise={() => { setReplaceExerciseId(null); setExerciseMessage(''); setShowExercisePicker(true); }} onSaveRoutine={saveRoutineTemplate} onTimerClear={() => setTimerRequest(null)} onFinish={requestFinishWorkout} onBack={() => setTab('overview')} />}
      {tab === 'calendar' && <Calendar recentSessions={recentSessions} onOpenSession={openHistory} onOpen={() => startWorkout(activeRoutine)} />}
      {tab === 'progress' && <Progress stats={trainingStats} />}
    </section>
    {showStart && <Modal title="What are you training today?" kicker="START A SESSION" close={() => setShowStart(false)}><div className="modal-list">{routines.map((routine) => <RoutineOption key={routine.id} routine={routine} onClick={() => startWorkout(routine)} />)}<button className="empty-option" onClick={() => startWorkout({ id: 'empty', code: '＋', color: 'green', name: 'Empty workout', focus: 'Add exercises as you go', exercises: [], lastTrained: 'Not trained yet' })}>＋ Start empty workout</button></div></Modal>}
    {showPrograms && <Modal title="Your routines" kicker="PROGRAM LIBRARY" close={() => setShowPrograms(false)}><div className="program-heading"><span className="program-icon">◈</span><div><strong>Personal training plan</strong><span>{routines.length} routines · Add as many as you need</span></div><button className="text-button" onClick={() => setShowCreateRoutine((open) => !open)}>{showCreateRoutine ? 'Cancel' : '＋ New'}</button></div>{showCreateRoutine && <div className="routine-form"><label>Routine name<input value={routineName} onChange={(event) => setRoutineName(event.target.value)} placeholder="e.g. Pull B" /></label><label>Focus <input value={routineFocus} onChange={(event) => setRoutineFocus(event.target.value)} placeholder="e.g. Back · biceps" /></label><button className="primary-button" onClick={createRoutine}>Create routine</button></div>}<div className="modal-list">{routines.map((routine) => <RoutineOption key={routine.id} routine={routine} onClick={() => startWorkout(routine)} />)}</div></Modal>}
    {showExercisePicker && <ExercisePickerModal library={exerciseLibrary} search={exerciseSearch} name={exerciseName} muscle={exerciseMuscle} message={exerciseMessage} onSearch={setExerciseSearch} onName={setExerciseName} onMuscle={setExerciseMuscle} onPick={addExerciseToWorkout} onCreate={createExercise} close={() => setShowExercisePicker(false)} />}
    {authOpen && <AuthModal email={authEmail} message={authMessage} busy={authBusy} onEmail={setAuthEmail} onSubmit={signIn} close={() => setAuthOpen(false)} />}
    {showResumePrompt && <Modal title="Workout already in progress" kicker="UNFINISHED SESSION" close={() => setShowResumePrompt(false)}><p className="auth-copy">You have an active {activeRoutine.name} session with {completed} completed sets. Resume it or discard it before starting another routine.</p><div className="review-actions"><button className="secondary-button" onClick={() => { setShowResumePrompt(false); setTab('workout'); }}>Resume workout</button><button className="primary-button" onClick={() => { setWorkoutStartedAt(null); setLogs([]); setShowResumePrompt(false); if (pendingStartRoutine) startWorkout(pendingStartRoutine, true); }}>Discard and start</button></div></Modal>}
    {showFinishReview && <Modal title="Review workout" kicker="READY TO SAVE" close={() => setShowFinishReview(false)}><div className="finish-review"><div><span>Completed sets</span><strong>{completed}</strong></div><div><span>Total sets</span><strong>{allSets.length}</strong></div><div><span>Volume</span><strong>{Math.round(volumeKg).toLocaleString()} kg</strong></div><div><span>Duration</span><strong><WorkoutClock startedAt={workoutStartedAt} /></strong></div></div><p className="auth-copy">Save this session to your history. You can review it later and use it for your next workout.</p><div className="review-actions"><button className="secondary-button" onClick={() => setShowFinishReview(false)}>Keep training</button><button className="primary-button" onClick={finishWorkout} disabled={saveBusy}>{saveBusy ? 'Saving…' : 'Save workout'}</button></div></Modal>}
    {historyBusy && <div className="history-loading" role="status">Loading workout history…</div>}
    {historyDetail && <HistoryModal session={historyDetail} close={() => setHistoryDetail(null)} onDelete={() => deleteHistory(historyDetail.id)} />}
  </main>;
}

function Overview({ nextRoutine, onStart, onCalendar, onPrograms, saved, saveError, recentSessions, stats, onOpenSession }: { nextRoutine: Routine; onStart: () => void; onCalendar: () => void; onPrograms: () => void; saved: boolean; saveError: string; recentSessions: RecentSession[]; stats: TrainingStats; onOpenSession: (sessionId: string) => void }) {
  const activity = recentSessions.slice(0, 5).map((session) => ({ id: session.id, day: new Date(session.started_at).getDate().toString(), month: new Date(session.started_at).toLocaleString('en-US', { month: 'short' }).toUpperCase(), code: session.name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2), color: 'coral', name: session.name, detail: `${formatDuration(session.duration_seconds)} · saved session`, volume: 'Tracked', records: 'View →' }));
  const routineExercises = nextRoutine.exercises.slice(0, 2);
  return <div className="page"><div className="page-heading"><div><Kicker>SUNDAY CHECK-IN</Kicker><h1>Good morning, Boa.</h1><p>Keep the streak alive. Your next session is ready when you are.</p></div><button className="primary-button" onClick={onStart}>＋ Start workout</button></div>{saved && <div className="saved-banner">✓ Workout saved to your history. Nice work.</div>}{saveError && <div className="error-banner">Couldn’t save that session yet. {saveError}</div>}{recentSessions.length > 0 && <div className="live-data-note"><span /> Live history connected · {recentSessions.length} saved session{recentSessions.length === 1 ? '' : 's'}</div>}<div className="quick-actions"><button onClick={onStart}><span>◉</span><strong>Start workout</strong><small>Log today’s sets</small></button><button onClick={onPrograms}><span>▤</span><strong>Routines</strong><small>{recentSessions.length ? 'Choose a routine' : 'Build your split'}</small></button><button onClick={onCalendar}><span>▦</span><strong>Calendar</strong><small>See your consistency</small></button></div><div className="overview-grid"><article className="next-card"><div className="card-line"><span className="pill">{nextRoutine.code}</span><Kicker>NEXT UP · TODAY</Kicker><button aria-label="Routine actions">•••</button></div><h2>{nextRoutine.name}</h2><div className="routine-meta">{nextRoutine.focus} <span>↗ {nextRoutine.exercises.length} exercises</span></div>{routineExercises.length ? routineExercises.map((exercise) => <Preview key={exercise.id} code={exercise.name.split(' ').map((word) => word[0]).slice(0, 2).join('')} color="coral" name={exercise.name} detail={`${exercise.sets.length} sets · ${formatRestDuration(exercise.restSeconds)} rest`} last={exercise.sets[0] ? `${exercise.sets[0].weight} ${exercise.sets[0].unit} × ${exercise.sets[0].reps}` : 'Not configured'} />) : <div className="empty-option">No exercises yet. Add them after starting this routine.</div>}<button className="card-action" onClick={onStart}>Start {nextRoutine.name} <span>→</span></button></article><article className="streak-card"><div className="card-line"><Kicker>CONSISTENCY</Kicker><b>✦</b></div><div className="streak-value">{stats.sessions}<small>sessions</small></div><p>{stats.completedSets ? `${stats.completedSets} completed sets logged.` : 'Your completed workouts will appear here.'}<br />One session at a time.</p><div className="mini-calendar">{Array.from({ length: 35 }, (_, i) => <i className={i > 5 && (i % 4 === 0 || i % 7 === 0) ? 'filled' : ''} key={i} />)}</div></article><StatCard icon="↗" title="TOTAL VOLUME" value={Math.round(stats.volumeKg).toLocaleString()} suffix="kg" change={stats.sessions ? `${stats.sessions} sessions` : 'No data yet'} detail="from completed workouts" bars /><StatCard icon="✦" title="PERSONAL RECORDS" value={stats.personalRecords.toString()} suffix="tracked" change={stats.completedSets ? `${stats.completedSets} completed sets` : 'No data yet'} detail="calculated from history" records /></div><div className="section-heading"><div><Kicker>YOUR TRAINING</Kicker><h2>Recent activity</h2></div><button className="text-button" onClick={onCalendar}>View calendar →</button></div><div className="activity-list">{activity.length ? activity.map((item) => <Activity key={`${item.day}-${item.name}`} {...item} onClick={() => onOpenSession(item.id)} />) : <div className="empty-option">No completed workouts yet. Finish a session to build your history.</div>}</div></div>;
}

function formatDuration(seconds: number | null) { if (!seconds) return 'Duration not recorded'; const minutes = Math.round(seconds / 60); return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`; }
function Preview({ code, color, name, detail, last }: { code: string; color: string; name: string; detail: string; last: string }) { return <div className="preview"><span className={`code ${color}`}>{code}</span><div><strong>{name}</strong><span>{detail}</span></div><em>{last}</em></div>; }
function StatCard({ icon, title, value, suffix, change, detail, bars, records }: { icon: string; title: string; value: string; suffix: string; change: string; detail: string; bars?: boolean; records?: boolean }) { return <article className="stat-card"><div className="stat-label"><span className="stat-icon">{icon}</span>{title}<button aria-label={`${title} options`}>•••</button></div><div className="stat-value">{value} <small>{suffix}</small></div><div className="stat-change">{change} <span>{detail}</span></div>{bars && <div className="micro-bars">{[34, 45, 30, 55, 48, 75, 61, 92, 68, 81, 75, 100].map((height, i) => <i style={{ height: `${height}%` }} key={i} />)}</div>}{records && <div className="record-list"><div><b>Highest recorded sets</b><span>Calculated from saved history</span></div></div>}</article>; }
function Activity({ day, month, code, color, name, detail, volume, records, onClick }: { day: string; month: string; code: string; color: string; name: string; detail: string; volume: string; records: string; onClick: () => void }) { return <button className="activity" onClick={onClick}><div className="activity-date"><b>{day}</b><span>{month}</span></div><span className={`code activity-code ${color}`}>{code}</span><div className="activity-name"><strong>{name}</strong><span>{detail}</span></div><div className="activity-stats"><b>{volume}</b><span>{records}</span></div><span className="arrow">→</span></button>; }

function Workout({ routine, startedAt, logs, previousByExercise, completed, progress, volumeKg, saveBusy, timerRequest, onToggle, onUnit, onUpdate, onAddSet, onRemoveSet, onRename, onRestDurationChange, onReorder, onReplace, onRemove, onAddExercise, onSaveRoutine, onTimerClear, onFinish, onBack }: { routine: Routine; startedAt: number | null; logs: ExerciseLog[]; previousByExercise: Record<string, PreviousPerformance[]>; completed: number; progress: number; volumeKg: number; saveBusy: boolean; timerRequest: { seconds: number; token: number; label: string } | null; onToggle: (exerciseId: string, setId: string) => void; onUnit: (exerciseId: string) => void; onUpdate: (exerciseId: string, setId: string, patch: Partial<SetLog>) => void; onAddSet: (exerciseId: string) => void; onRemoveSet: (exerciseId: string, setId: string) => void; onRename: (exerciseId: string, name: string) => void; onRestDurationChange: (exerciseId: string, restSeconds: number) => void; onReorder: (exerciseId: string) => void; onReplace: (exerciseId: string) => void; onRemove: (exerciseId: string) => void; onAddExercise: () => void; onSaveRoutine: () => void | Promise<void>; onTimerClear: () => void; onFinish: () => void | Promise<void>; onBack: () => void }) {
  const [timerSeconds, setTimerSeconds] = useState(() => { try { const savedTimer = JSON.parse(window.localStorage.getItem('prog-active-rest') || 'null') as { seconds?: number; total?: number; label?: string; running?: boolean } | null; return savedTimer?.seconds || logs[0]?.restSeconds || 120; } catch { return logs[0]?.restSeconds || 120; } });
  const [timerRunning, setTimerRunning] = useState(() => { try { return Boolean((JSON.parse(window.localStorage.getItem('prog-active-rest') || 'null') as { running?: boolean } | null)?.running); } catch { return false; } });
  const [timerLabel, setTimerLabel] = useState(() => { try { return (JSON.parse(window.localStorage.getItem('prog-active-rest') || 'null') as { label?: string } | null)?.label || 'Rest'; } catch { return 'Rest'; } });
  const [timerTotal, setTimerTotal] = useState(() => { try { return (JSON.parse(window.localStorage.getItem('prog-active-rest') || 'null') as { total?: number } | null)?.total || logs[0]?.restSeconds || 120; } catch { return logs[0]?.restSeconds || 120; } });
  const handledTimerToken = useRef<number | null>(null);
  useEffect(() => { if (!timerRequest || handledTimerToken.current === timerRequest.token) return undefined; let savedToken: number | undefined; try { savedToken = (JSON.parse(window.localStorage.getItem('prog-active-rest') || 'null') as { token?: number } | null)?.token; } catch { savedToken = undefined; } if (savedToken === timerRequest.token) { handledTimerToken.current = timerRequest.token; return undefined; } handledTimerToken.current = timerRequest.token; const timer = window.setTimeout(() => { setTimerSeconds(timerRequest.seconds); setTimerTotal(timerRequest.seconds); setTimerLabel(timerRequest.label); setTimerRunning(timerRequest.seconds > 0); }, 0); return () => window.clearTimeout(timer); }, [timerRequest]);
  useEffect(() => { if (!timerRunning) return undefined; const interval = window.setInterval(() => setTimerSeconds((current) => { if (current <= 1) { setTimerRunning(false); onTimerClear(); return 0; } return current - 1; }), 1000); return () => window.clearInterval(interval); }, [onTimerClear, timerRunning]);
  useEffect(() => { if (timerRequest && timerSeconds > 0) window.localStorage.setItem('prog-active-rest', JSON.stringify({ token: timerRequest.token, seconds: timerSeconds, total: timerTotal, label: timerLabel, running: timerRunning })); else if (!timerRequest || timerSeconds <= 0) window.localStorage.removeItem('prog-active-rest'); }, [timerLabel, timerRequest, timerRunning, timerSeconds, timerTotal]);
  const timerMinutes = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const timerRemainder = String(timerSeconds % 60).padStart(2, '0');
  const timerPercent = timerTotal ? Math.max(0, Math.min(100, (timerSeconds / timerTotal) * 100)) : 0;
  return <div className="page workout-page"><button className="back-button" onClick={onBack}>← Overview</button><div className="workout-heading"><div><Kicker>IN PROGRESS · {routine.name.toUpperCase()}</Kicker><h1>{routine.name} <span className="live-chip"><i /> Live</span></h1><p><WorkoutClock startedAt={startedAt} /> · {routine.focus}</p></div><div className="workout-actions"><button className="finish-button" onClick={onFinish} disabled={saveBusy}>{saveBusy ? 'Saving…' : 'Finish workout'}</button></div></div><div className="workout-summary"><div><Kicker>COMPLETION</Kicker><b>{completed}/{logs.reduce((sum, exercise) => sum + exercise.sets.length, 0)} sets</b></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong><div className="summary-divider" /><div><Kicker>VOLUME</Kicker><b>{Math.round(volumeKg).toLocaleString()} kg</b></div><span className="summary-note">Mixed units supported</span></div><div className="exercise-list">{logs.length ? logs.map((exercise, index) => <ExerciseCard exercise={exercise} previous={previousByExercise[exercise.dbId || exercise.name]} index={index} onToggle={onToggle} onUnit={onUnit} onUpdate={onUpdate} onAddSet={onAddSet} onRemoveSet={onRemoveSet} onRename={onRename} onRestDurationChange={onRestDurationChange} onReorder={onReorder} onReplace={onReplace} onRemove={onRemove} key={exercise.id} />) : <div className="empty-workout"><span>＋</span><strong>Your workout is empty</strong><p>Add an exercise below to start logging.</p></div>}</div><button className="add-exercise-button" onClick={onAddExercise}>＋ Add exercise</button>{timerRequest && timerSeconds > 0 && <div className="floating-rest-gauge" role="status"><div className="floating-rest-head"><div><Kicker>RESTING · {timerLabel.toUpperCase()}</Kicker><strong>{timerMinutes}:{timerRemainder}</strong></div><button onClick={() => setTimerRunning((running) => !running)}>{timerRunning ? 'Pause' : 'Resume'}</button><button onClick={() => { setTimerRunning(false); setTimerSeconds(0); onTimerClear(); }}>Skip</button></div><div className="gauge-track"><i style={{ width: `${timerPercent}%` }} /></div></div>}<div className="mobile-workout-bar"><button onClick={() => document.querySelector('.exercise-rest-strip')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>⏱ Rest</button><button onClick={onFinish} disabled={saveBusy}>{saveBusy ? 'Saving…' : 'Finish workout'}</button></div><div className="workout-tip"><span>Set type, weight, unit, and exercise order can all be edited while you train.</span><button className="text-button" onClick={onSaveRoutine}>Save changes to routine →</button></div></div>;
}
function WorkoutClock({ startedAt }: { startedAt: number | null }) { const [elapsed, setElapsed] = useState(0); useEffect(() => { if (!startedAt) return undefined; const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000))); tick(); const interval = window.setInterval(tick, 1000); return () => window.clearInterval(interval); }, [startedAt]); const h = String(Math.floor(elapsed / 3600)).padStart(2, '0'); const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0'); const s = String(elapsed % 60).padStart(2, '0'); return <span>{h}:{m}:{s}</span>; }
function ExerciseCard({ exercise, previous, index, onToggle, onUnit, onUpdate, onAddSet, onRemoveSet, onRename, onRestDurationChange, onReorder, onReplace, onRemove }: { exercise: ExerciseLog; previous?: PreviousPerformance[]; index: number; onToggle: (exerciseId: string, setId: string) => void; onUnit: (exerciseId: string) => void; onUpdate: (exerciseId: string, setId: string, patch: Partial<SetLog>) => void; onAddSet: (exerciseId: string) => void; onRemoveSet: (exerciseId: string, setId: string) => void; onRename: (exerciseId: string, name: string) => void; onRestDurationChange: (exerciseId: string, restSeconds: number) => void; onReorder: (exerciseId: string) => void; onReplace: (exerciseId: string) => void; onRemove: (exerciseId: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [restPickerOpen, setRestPickerOpen] = useState(false);
  const displayUnit = exercise.sets[0]?.unit || 'kg';
  return <article className="exercise-card"><div className="exercise-heading"><span className="code coral">{exercise.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span><div><input className="exercise-name-input" value={`${index + 1}. ${exercise.name}`} aria-label="Exercise name" onChange={(event) => onRename(exercise.id, event.target.value.replace(/^\d+\.\s*/, ''))} /><p>{exercise.muscle}</p></div><div className="exercise-menu"><button className="exercise-menu-trigger" aria-label="Exercise options" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>•••</button>{menuOpen && <div className="exercise-menu-popover"><button className="menu-action" onClick={() => { onReorder(exercise.id); setMenuOpen(false); }}>↕ <span>Reorder</span></button><button className="menu-action" onClick={() => { onReplace(exercise.id); setMenuOpen(false); }}>↔ <span>Replace exercise</span></button><button className="menu-action destructive" onClick={() => { onRemove(exercise.id); setMenuOpen(false); }}>× <span>Remove exercise</span></button></div>}</div></div><div className="exercise-rest-strip"><span className="rest-strip-icon">⏱</span><div><strong>Auto rest</strong><small>after each completed set</small></div><button className="rest-picker-trigger" aria-label={`Change auto rest, currently ${formatRestDuration(exercise.restSeconds)}`} onClick={() => setRestPickerOpen(true)}><span className="rest-trigger-value">{formatRestDuration(exercise.restSeconds)}</span><span className="rest-picker-chevron">⌄</span></button></div>{restPickerOpen && <RestPicker value={exercise.restSeconds} onSelect={(seconds) => onRestDurationChange(exercise.id, seconds)} close={() => setRestPickerOpen(false)} />}<div className="set-header"><span>SET</span><span className="previous-heading"><span className="full-label">PREVIOUS</span><span className="short-label">LAST</span></span><div className="weight-heading"><span>WEIGHT</span><button className="unit-toggle" onClick={() => onUnit(exercise.id)} aria-label={`Switch all weights to ${displayUnit === 'kg' ? 'lb' : 'kg'}`}>{displayUnit.toUpperCase()}</button></div><span>REPS</span><span>DONE</span><span /></div>{exercise.sets.map((set, i) => { const last = previous?.[i]; return <div className={set.done ? 'set-row complete' : 'set-row'} key={set.id}><div className="set-id"><b>{i + 1}</b><select className={`set-kind-select ${set.kind}`} value={set.kind} aria-label="Set type" title="Set type" onChange={(event) => onUpdate(exercise.id, set.id, { kind: event.target.value as SetKind })}><option value="warmup">Warm-up</option><option value="working">Working</option><option value="backoff">Back-off</option><option value="drop">Drop</option><option value="failure">Failure</option></select></div><span>{last ? `${last.weight || 0} ${last.unit} × ${last.reps || 0}` : '—'}</span><div className="weight-edit"><input type="number" min="0" step="0.5" value={set.weight} aria-label="Weight" onChange={(event) => onUpdate(exercise.id, set.id, { weight: Number(event.target.value) || 0 })} /><span className="weight-unit">{set.unit}</span></div><input className="reps-edit" type="number" min="0" value={set.reps} aria-label="Reps" onChange={(event) => onUpdate(exercise.id, set.id, { reps: Number(event.target.value) || 0 })} /><button className="done" onClick={() => onToggle(exercise.id, set.id)} aria-label={set.done ? 'Uncomplete set' : 'Complete set'}>{set.done ? '✓' : ''}<span className="done-label">{set.done ? 'Done' : 'Tap'}</span></button><button className="remove-set" onClick={() => onRemoveSet(exercise.id, set.id)} aria-label="Remove set">×</button></div>; })}<div className="set-actions"><button className="add-set" onClick={() => onAddSet(exercise.id)}>＋ Add set</button><span>{exercise.sets.filter((set) => set.kind === 'warmup').length} warm-up · {exercise.sets.filter((set) => set.kind === 'working').length} working</span></div></article>;
}

function Calendar({ recentSessions, onOpenSession, onOpen }: { recentSessions: RecentSession[]; onOpenSession: (sessionId: string) => void; onOpen: () => void }) {
  const [month, setMonth] = useState(() => new Date());
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const sessionsByDay = useMemo(() => recentSessions.reduce((map, session) => { const key = dateKey(session.started_at); const list = map.get(key) || []; list.push(session); map.set(key, list); return map; }, new Map<string, RecentSession[]>()), [recentSessions]);
  const monthSessions = recentSessions.filter((session) => { const date = new Date(session.started_at); return date.getFullYear() === year && date.getMonth() === monthIndex; });
  return <div className="page"><div className="page-heading"><div><Kicker>TRAINING HISTORY</Kicker><h1>Your calendar</h1><p>Every session counts. Keep building the picture.</p></div><button className="secondary-button" onClick={() => setMonth(new Date())}>Today</button></div><div className="calendar-layout"><article className="calendar-card"><div className="calendar-title"><button aria-label="Previous month" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}>‹</button><h2>{month.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h2><button aria-label="Next month" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}>›</button></div><div className="weekday-row">{weekdayLabels.map((label) => <span key={label}>{label}</span>)}</div><div className="calendar-grid">{Array.from({ length: firstDay }, (_, i) => <span className="empty-day" key={`empty-${i}`} />)}{Array.from({ length: daysInMonth }, (_, i) => { const day = i + 1; const sessions = sessionsByDay.get(dateKey(new Date(year, monthIndex, day))) || []; return <button className={sessions.length ? 'calendar-day trained' : 'calendar-day'} key={day} onClick={() => sessions[0] && onOpenSession(sessions[0].id)}><span>{day}</span>{sessions.length > 0 && <i />}{sessions.length > 1 && <em>{sessions.length}</em>}</button>; })}</div><div className="legend"><span><i /> Workout</span><span><i /> Rest day</span></div></article><aside className="month-summary"><Kicker>{month.toLocaleString('en-US', { month: 'long' }).toUpperCase()} AT A GLANCE</Kicker><div className="month-stat">{monthSessions.length}<small>workouts</small></div>{[['Training days', `${new Set(monthSessions.map((session) => dateKey(session.started_at))).size}`], ['Total volume', monthSessions.length ? 'From saved sets' : '—'], ['Time trained', formatDuration(monthSessions.reduce((sum, session) => sum + (session.duration_seconds || 0), 0))], ['Personal records', 'Calculated per set']].map(([label, value]) => <div className="summary-row" key={label}><span>{label}</span><b>{value}</b></div>)}<Kicker>HOW TO READ IT</Kicker><p className="month-help">Tap a trained day to open the saved session and review every set.</p></aside></div><div className="section-heading calendar-session-heading"><div><Kicker>{monthSessions.length ? 'LATEST SAVED SESSION' : 'NO SESSIONS THIS MONTH'}</Kicker><h2>{monthSessions[0]?.name || 'Ready when you are'}</h2></div><button className="text-button" onClick={onOpen}>Start workout →</button></div>{monthSessions[0] ? <button className="session-card" onClick={() => onOpenSession(monthSessions[0].id)}><span className="code coral">{monthSessions[0].name.slice(0, 2).toUpperCase()}</span><div className="activity-name"><strong>{monthSessions[0].name}</strong><span>{formatDuration(monthSessions[0].duration_seconds)} · saved session</span></div><div className="session-stats"><b>Saved</b><span>Open details</span></div><span className="arrow">→</span></button> : <div className="empty-option">Complete your first workout to see it here.</div>}</div>;
}

function Progress({ stats }: { stats: TrainingStats }) { return <div className="page"><div className="page-heading"><div><Kicker>THE BIG PICTURE</Kicker><h1>Progress, measured.</h1><p>Strength is a trend, not a single number.</p></div><button className="secondary-button">Last 12 weeks⌄</button></div><div className="progress-grid"><article className="progress-card"><div className="stat-label"><span className="stat-icon">↗</span>TRAINING VOLUME<button aria-label="Chart options">•••</button></div><div className="progress-value">{Math.round(stats.volumeKg).toLocaleString()} <small>kg</small><span>{stats.sessions} sessions</span></div><div className="fake-chart">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ height: `${Math.max(12, Math.min(100, stats.volumeKg ? 24 + i * 7 : 12))}%` }} />)}</div><div className="chart-labels"><span>RECENT</span><span>{stats.completedSets} SETS</span><span>{formatDuration(stats.durationSeconds)}</span></div></article><article className="progress-card body-card"><div className="stat-label"><span className="stat-icon violet">◒</span>WORKOUT FREQUENCY<button aria-label="Frequency options">•••</button></div><div className="progress-value">{stats.sessions} <small>sessions</small></div><div className="body-change">{stats.completedSets} completed sets <span>from saved history</span></div><div className="weight-bars">{[20, 28, 36, 44, 52, 60, 68, 76, 84, 92].map((height, i) => <i style={{ height: `${stats.sessions ? height : 10}%` }} key={i} />)}</div><button className="card-action">Body measurements coming next ＋</button></article></div><div className="section-heading"><div><Kicker>PERFORMANCE</Kicker><h2>Personal records</h2></div><span className="text-button">Calculated from completed sets</span></div><div className="pr-table"><div className="pr-head"><span>METRIC</span><span>VALUE</span><span>DETAIL</span><span>STATUS</span></div><div className="pr-row"><strong>Completed sessions</strong><span>{stats.sessions}</span><span>{formatDuration(stats.durationSeconds)}</span><span>Saved</span></div><div className="pr-row"><strong>Completed sets</strong><span>{stats.completedSets}</span><span>{Math.round(stats.volumeKg).toLocaleString()} kg volume</span><span>Tracked</span></div><div className="pr-row"><strong>Personal records</strong><span>{stats.personalRecords}</span><span>High-weight milestones</span><span>{stats.sessions ? 'Calculated' : 'Waiting'}</span></div></div></div>; }

function HistoryModal({ session, close, onDelete }: { session: HistorySession; close: () => void; onDelete: () => void }) { return <Modal title={session.name} kicker="SAVED WORKOUT" close={close}><div className="history-meta"><span>{new Date(session.started_at).toLocaleString()}</span><span>{formatDuration(session.duration_seconds)}</span></div><div className="history-exercises">{session.exercises.map((exercise) => <div className="history-exercise" key={`${exercise.name}-${exercise.muscle}`}><div><strong>{exercise.name}</strong><span>{exercise.muscle}</span></div><div className="history-set-list">{exercise.sets.map((set, index) => <span key={`${exercise.name}-${index}`}>{index + 1}. {set.weight || 0} {set.unit} × {set.reps || 0} <em>{set.kind}</em></span>)}</div></div>)}</div>{!session.exercises.length && <div className="empty-option">This session has no recorded exercises.</div>}<button className="history-delete" onClick={onDelete}>Delete saved workout</button></Modal>; }

function RoutineOption({ routine, onClick }: { routine: Routine; onClick: () => void }) { return <button className="routine-option" onClick={onClick}><span className={`code ${routine.color}`}>{routine.code}</span><div><strong>{routine.name}</strong><span>{routine.focus} · {routine.exercises.length || 'Add'} exercises · Last {routine.lastTrained}</span></div><b>→</b></button>; }
function ExercisePickerModal({ library, search, name, muscle, message, onSearch, onName, onMuscle, onPick, onCreate, close }: { library: LibraryExercise[]; search: string; name: string; muscle: string; message: string; onSearch: (value: string) => void; onName: (value: string) => void; onMuscle: (value: string) => void; onPick: (exercise: LibraryExercise) => void; onCreate: () => void; close: () => void }) {
  const filtered = library.filter((exercise) => `${exercise.name} ${exercise.primary_muscle} ${exercise.equipment}`.toLowerCase().includes(search.toLowerCase()));
  return <Modal title="Add an exercise" kicker="EXERCISE LIBRARY" close={close}><p className="picker-copy">Choose a movement from your library, or create one once and reuse it in every routine.</p><input className="auth-input exercise-search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search exercises…" aria-label="Search exercises" />{filtered.length > 0 && <div className="exercise-library-list">{filtered.map((exercise) => <button className="library-option" key={exercise.id} onClick={() => onPick(exercise)}><span className="code coral">{exercise.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span><div><strong>{exercise.name}</strong><span>{exercise.primary_muscle} · {exercise.equipment}</span></div><b>＋</b></button>)}</div>}{filtered.length === 0 && <p className="empty-option">No matching exercise yet. Create it below.</p>}<div className="create-exercise-box"><Kicker>NEW MOVEMENT</Kicker><label>Name<input value={name} onChange={(event) => onName(event.target.value)} placeholder="e.g. Cable lateral raise" /></label><label>Muscle group<input value={muscle} onChange={(event) => onMuscle(event.target.value)} placeholder="e.g. Shoulders" /></label><button className="primary-button" onClick={onCreate}>Create and add to workout</button>{message && <p className="auth-message" role="status">{message}</p>}</div></Modal>;
}
function Modal({ title, kicker, close, children }: { title: string; kicker: string; close: () => void; children: ReactNode }) { return <div className="modal-backdrop" onClick={close}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><Kicker>{kicker}</Kicker><h2>{title}</h2></div><button onClick={close} aria-label="Close">×</button></div>{children}</div></div>; }
function AuthModal({ email, message, busy, onEmail, onSubmit, close }: { email: string; message: string; busy: boolean; onEmail: (email: string) => void; onSubmit: () => void; close: () => void }) { return <Modal title="Save your progress" kicker="PRIVATE TRAINING LOG" close={close}><p className="auth-copy">Sign in with a secure email link so Prog can keep every set, calendar day and personal record safe.</p><label className="auth-label" htmlFor="auth-email">Email address</label><input id="auth-email" className="auth-input" type="email" value={email} onChange={(event) => onEmail(event.target.value)} placeholder="you@example.com" onKeyDown={(event) => { if (event.key === 'Enter') onSubmit(); }} /><button className="primary-button auth-submit" onClick={onSubmit} disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>{message && <p className="auth-message" role="status">{message}</p>}<p className="auth-footnote">Your data stays in your Supabase project. Never share a service-role key.</p></Modal>; }
