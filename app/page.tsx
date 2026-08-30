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
type Routine = { id: string; code: string; color: string; name: string; focus: string; exercises: ExerciseLog[]; lastTrained: string };
type RecentSession = { id: string; name: string; started_at: string; duration_seconds: number | null };

const weekdayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const fallbackTrainedDays = new Set([2, 4, 8, 11, 14, 18, 21, 25, 27]);
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

export default function Home() {
  const [tab, setTab] = useState<Tab>('overview');
  const [showStart, setShowStart] = useState(false);
  const [showPrograms, setShowPrograms] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [replaceExerciseId, setReplaceExerciseId] = useState<string | null>(null);
  const [showCreateRoutine, setShowCreateRoutine] = useState(false);
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
  const [authOpen, setAuthOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('prog-theme');
    if (storedTheme === 'dark' || storedTheme === 'light') window.setTimeout(() => setTheme(storedTheme), 0);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('prog-theme', theme);
  }, [theme]);
  useEffect(() => {
    try {
      const draft = JSON.parse(window.localStorage.getItem('prog-workout-draft') || 'null') as { routineId?: string; startedAt?: number; logs?: ExerciseLog[] } | null;
      const routine = draft?.routineId ? initialRoutines.find((item) => item.id === draft.routineId) : undefined;
      if (routine && draft?.startedAt && draft.logs) {
        window.setTimeout(() => {
          setActiveRoutine(routine);
          setLogs(draft.logs || []);
          setWorkoutStartedAt(draft.startedAt || null);
          setTab('workout');
        }, 0);
      }
    } catch {
      window.localStorage.removeItem('prog-workout-draft');
    } finally {
      window.setTimeout(() => setDraftReady(true), 0);
    }
  }, []);
  useEffect(() => {
    if (!draftReady) return;
    if (workoutStartedAt) window.localStorage.setItem('prog-workout-draft', JSON.stringify({ routineId: activeRoutine.id, startedAt: workoutStartedAt, logs }));
    else window.localStorage.removeItem('prog-workout-draft');
  }, [activeRoutine.id, draftReady, logs, workoutStartedAt]);
  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);
  useEffect(() => {
    if (!supabase || !user) return;
    supabase.from('workout_sessions').select('id,name,started_at,duration_seconds').eq('owner_id', user.id).eq('status', 'completed').order('started_at', { ascending: false }).limit(60)
      .then(({ data }) => setRecentSessions((data ?? []) as RecentSession[]));
    supabase.from('exercises').select('id,name,primary_muscle,equipment,default_weight_unit').eq('owner_id', user.id).is('archived_at', null).order('name').limit(200)
      .then(({ data }) => setExerciseLibrary((data ?? []) as LibraryExercise[]));
  }, [supabase, user, saved]);

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

  function startWorkout(routine = activeRoutine) {
    setActiveRoutine(routine);
    setLogs(cloneLogs(routine.exercises));
    setWorkoutStartedAt(Date.now());
    setSaved(false); setSaveError(''); setShowStart(false); setShowPrograms(false); setShowCreateRoutine(false); setTab('workout');
  }

  function createRoutine() {
    const name = routineName.trim() || 'New routine';
    const routine: Routine = { id: crypto.randomUUID(), code: name.split(/\s+/).map((word) => word[0]).join('').slice(0, 3).toUpperCase(), color: 'green', name, focus: routineFocus.trim() || 'Custom training day', exercises: [], lastTrained: 'Not trained yet' };
    setRoutines((current) => [...current, routine]);
    setRoutineName(''); setRoutineFocus(''); setShowCreateRoutine(false); startWorkout(routine);
  }

  async function finishWorkout() {
    if (saveBusy) return;
    if (!supabase || !user) { setAuthMessage('Sign in to save this workout to your history.'); setAuthOpen(true); return; }
    setSaveBusy(true); setSaveError('');
    const startedAtMs = workoutStartedAt ?? Date.now();
    const sessionId = crypto.randomUUID();
    const { error: sessionError } = await supabase.from('workout_sessions').insert({ id: sessionId, owner_id: user.id, name: activeRoutine.name, started_at: new Date(startedAtMs).toISOString(), completed_at: new Date().toISOString(), duration_seconds: Math.max(1, Math.round((Date.now() - startedAtMs) / 1000)), status: 'completed' });
    if (sessionError) { setSaveError(sessionError.message); setSaveBusy(false); return; }
    const workoutExercises = logs.map((exercise, position) => ({ id: crypto.randomUUID(), session_id: sessionId, exercise_id: null, exercise_name_snapshot: exercise.name, muscle_snapshot: exercise.muscle, position }));
    const { error: exerciseError } = await supabase.from('workout_exercises').insert(workoutExercises);
    if (exerciseError) { await supabase.from('workout_sessions').delete().eq('id', sessionId); setSaveError(exerciseError.message); setSaveBusy(false); return; }
    const workoutSets = logs.flatMap((exercise, exerciseIndex) => exercise.sets.map((set, position) => ({ id: crypto.randomUUID(), workout_exercise_id: workoutExercises[exerciseIndex].id, position, set_type: set.kind, weight_value: set.weight, weight_unit: set.unit, normalized_weight_kg: set.unit === 'lb' ? set.weight / 2.20462 : set.weight, reps: set.reps, rest_seconds: exercise.restSeconds || null, completed_at: set.done ? new Date().toISOString() : null })));
    const { error: setsError } = await supabase.from('workout_sets').insert(workoutSets);
    if (setsError) { await supabase.from('workout_sessions').delete().eq('id', sessionId); setSaveError(setsError.message); setSaveBusy(false); return; }
    setSaved(true); setSaveBusy(false); setWorkoutStartedAt(null); setTab('overview');
  }

  async function signIn() {
    if (!supabase || !authEmail.trim()) return;
    setAuthBusy(true); setAuthMessage('Sending your sign-in link…');
    const { error } = await supabase.auth.signInWithOtp({ email: authEmail.trim(), options: { emailRedirectTo: window.location.origin } });
    setAuthMessage(error ? error.message : 'Check your email for the secure sign-in link.'); setAuthBusy(false);
  }
  async function signOut() { await supabase?.auth.signOut(); setUser(null); setRecentSessions([]); }

  return <main className="app-shell">
    <aside className="sidebar"><Logo /><Kicker>TRAIN</Kicker><nav className="side-nav" aria-label="Primary navigation">
      <button className={tab === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('overview')}><Icon>⌂</Icon>Overview</button>
      <button className={tab === 'workout' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('workout')}><Icon>◉</Icon>Workout {workoutStartedAt && <span className="status-dot" />}</button>
      <button className="nav-item" onClick={() => setShowPrograms(true)}><Icon>▤</Icon>Programs</button>
      <button className={tab === 'calendar' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('calendar')}><Icon>▦</Icon>Calendar</button>
      <button className={tab === 'progress' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('progress')}><Icon>↗</Icon>Progress</button>
    </nav><Kicker>LIBRARY</Kicker><nav className="side-nav library-nav"><button className="nav-item" onClick={() => setShowPrograms(true)}><Icon>＋</Icon>Exercises</button><button className="nav-item"><Icon>⚙</Icon>Settings</button></nav><div className="profile"><div className="avatar">BS</div><div><strong>Boa Sorawit</strong><span>Personal space</span></div><button aria-label="More profile actions">•••</button></div></aside>
    <section className="main-column"><header className="topbar"><div className="mobile-logo"><Logo /></div><div className="top-date"><Kicker>SUNDAY, AUGUST 30, 2026</Kicker><span className="saved-state"><i /> {user ? 'Supabase connected' : 'Preview mode'}</span></div><div className="top-actions"><button className="theme-toggle" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? '☾' : '☀'}</button>{user ? <button className="user-pill" onClick={signOut}>{user.email?.split('@')[0]} · sign out</button> : <button className="sign-in-button" onClick={() => { setAuthMessage(''); setAuthOpen(true); }}>Sign in</button>}<div className="avatar small">BS</div></div></header>
      {tab === 'overview' && <Overview onStart={() => setShowStart(true)} onCalendar={() => setTab('calendar')} saved={saved} saveError={saveError} recentSessions={recentSessions} onPrograms={() => setShowPrograms(true)} />}
      {tab === 'workout' && <Workout routine={activeRoutine} startedAt={workoutStartedAt} logs={logs} completed={completed} progress={progress} volumeKg={volumeKg} saveBusy={saveBusy} timerRequest={timerRequest} onToggle={toggleSet} onUnit={toggleUnit} onUpdate={updateSet} onAddSet={addSet} onRemoveSet={removeSet} onRename={renameExercise} onRestDurationChange={(exerciseId, restSeconds) => setLogs((current) => current.map((exercise) => exercise.id === exerciseId ? { ...exercise, restSeconds } : exercise))} onReorder={(exerciseId) => setLogs((current) => { const index = current.findIndex((exercise) => exercise.id === exerciseId); if (index < 0 || index === current.length - 1) return current; const next = [...current]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })} onReplace={(exerciseId) => { setReplaceExerciseId(exerciseId); setExerciseMessage(''); setShowExercisePicker(true); }} onRemove={(exerciseId) => setLogs((current) => current.filter((exercise) => exercise.id !== exerciseId))} onAddExercise={() => { setReplaceExerciseId(null); setExerciseMessage(''); setShowExercisePicker(true); }} onFinish={finishWorkout} onBack={() => setTab('overview')} />}
      {tab === 'calendar' && <Calendar recentSessions={recentSessions} onOpen={() => startWorkout(activeRoutine)} />}
      {tab === 'progress' && <Progress />}
    </section>
    {showStart && <Modal title="What are you training today?" kicker="START A SESSION" close={() => setShowStart(false)}><div className="modal-list">{routines.map((routine) => <RoutineOption key={routine.id} routine={routine} onClick={() => startWorkout(routine)} />)}<button className="empty-option" onClick={() => startWorkout({ id: 'empty', code: '＋', color: 'green', name: 'Empty workout', focus: 'Add exercises as you go', exercises: [], lastTrained: 'Not trained yet' })}>＋ Start empty workout</button></div></Modal>}
    {showPrograms && <Modal title="Your routines" kicker="PROGRAM LIBRARY" close={() => setShowPrograms(false)}><div className="program-heading"><span className="program-icon">◈</span><div><strong>Personal training plan</strong><span>{routines.length} routines · Add as many as you need</span></div><button className="text-button" onClick={() => setShowCreateRoutine((open) => !open)}>{showCreateRoutine ? 'Cancel' : '＋ New'}</button></div>{showCreateRoutine && <div className="routine-form"><label>Routine name<input value={routineName} onChange={(event) => setRoutineName(event.target.value)} placeholder="e.g. Pull B" /></label><label>Focus <input value={routineFocus} onChange={(event) => setRoutineFocus(event.target.value)} placeholder="e.g. Back · biceps" /></label><button className="primary-button" onClick={createRoutine}>Create routine</button></div>}<div className="modal-list">{routines.map((routine) => <RoutineOption key={routine.id} routine={routine} onClick={() => startWorkout(routine)} />)}</div></Modal>}
    {showExercisePicker && <ExercisePickerModal library={exerciseLibrary} search={exerciseSearch} name={exerciseName} muscle={exerciseMuscle} message={exerciseMessage} onSearch={setExerciseSearch} onName={setExerciseName} onMuscle={setExerciseMuscle} onPick={addExerciseToWorkout} onCreate={createExercise} close={() => setShowExercisePicker(false)} />}
    {authOpen && <AuthModal email={authEmail} message={authMessage} busy={authBusy} onEmail={setAuthEmail} onSubmit={signIn} close={() => setAuthOpen(false)} />}
  </main>;
}

function Overview({ onStart, onCalendar, onPrograms, saved, saveError, recentSessions }: { onStart: () => void; onCalendar: () => void; onPrograms: () => void; saved: boolean; saveError: string; recentSessions: RecentSession[] }) {
  const activity = recentSessions.length ? recentSessions.slice(0, 5).map((session) => ({ day: new Date(session.started_at).getDate().toString(), month: new Date(session.started_at).toLocaleString('en-US', { month: 'short' }).toUpperCase(), code: session.name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2), color: 'coral', name: session.name, detail: `${formatDuration(session.duration_seconds)} · saved session`, volume: 'Tracked', records: 'View →' })) : [
    { day: '27', month: 'AUG', code: 'UA', color: 'coral', name: 'Upper A', detail: '6 exercises · 19 sets · 1h 12m', volume: '9,240 kg', records: '2 PRs' },
    { day: '25', month: 'AUG', code: 'LA', color: 'violet', name: 'Lower A', detail: '5 exercises · 16 sets · 58m', volume: '11,680 kg', records: '1 PR' },
    { day: '22', month: 'AUG', code: 'PB', color: 'amber', name: 'Push B', detail: '7 exercises · 21 sets · 1h 04m', volume: '8,420 kg', records: '—' },
  ];
  return <div className="page"><div className="page-heading"><div><Kicker>SUNDAY CHECK-IN</Kicker><h1>Good morning, Boa.</h1><p>Keep the streak alive. Your next session is ready when you are.</p></div><button className="primary-button" onClick={onStart}>＋ Start workout</button></div>{saved && <div className="saved-banner">✓ Workout saved to your history. Nice work.</div>}{saveError && <div className="error-banner">Couldn’t save that session yet. {saveError}</div>}{recentSessions.length > 0 && <div className="live-data-note"><span /> Live history connected · {recentSessions.length} saved session{recentSessions.length === 1 ? '' : 's'}</div>}<div className="quick-actions"><button onClick={onStart}><span>◉</span><strong>Start workout</strong><small>Log today’s sets</small></button><button onClick={onPrograms}><span>▤</span><strong>Routines</strong><small>{recentSessions.length ? 'Choose a routine' : 'Build your split'}</small></button><button onClick={onCalendar}><span>▦</span><strong>Calendar</strong><small>See your consistency</small></button></div><div className="overview-grid"><article className="next-card"><div className="card-line"><span className="pill">UPPER A</span><Kicker>NEXT UP · TODAY</Kicker><button aria-label="Routine actions">•••</button></div><h2>Upper A</h2><div className="routine-meta">◷ 58–72 min <span>↗ 6 exercises</span></div><Preview code="BP" color="coral" name="Barbell Bench Press" detail="4 sets · 6–8 reps" last="80 kg × 8" /><Preview code="SR" color="violet" name="Seated Cable Row" detail="3 sets · 8–12 reps" last="145 lb × 10" /><button className="card-action" onClick={onStart}>Start Upper A <span>→</span></button></article><article className="streak-card"><div className="card-line"><Kicker>CONSISTENCY</Kicker><b>✦</b></div><div className="streak-value">12<small>days</small></div><p>Your longest streak this year.<br />One session at a time.</p><div className="mini-calendar">{Array.from({ length: 35 }, (_, i) => <i className={i > 5 && (i % 4 === 0 || i % 7 === 0) ? 'filled' : ''} key={i} />)}</div></article><StatCard icon="↗" title="WEEKLY VOLUME" value="12,840" suffix="kg" change="↑ 8.4%" detail="vs last week" bars /><StatCard icon="✦" title="PERSONAL RECORDS" value="7" suffix="this month" change="↑ 3" detail="new this week" records /></div><div className="section-heading"><div><Kicker>YOUR TRAINING</Kicker><h2>Recent activity</h2></div><button className="text-button" onClick={onCalendar}>View calendar →</button></div><div className="activity-list">{activity.map((item) => <Activity key={`${item.day}-${item.name}`} {...item} />)}</div></div>;
}

function formatDuration(seconds: number | null) { if (!seconds) return 'Duration not recorded'; const minutes = Math.round(seconds / 60); return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`; }
function Preview({ code, color, name, detail, last }: { code: string; color: string; name: string; detail: string; last: string }) { return <div className="preview"><span className={`code ${color}`}>{code}</span><div><strong>{name}</strong><span>{detail}</span></div><em>{last}</em></div>; }
function StatCard({ icon, title, value, suffix, change, detail, bars, records }: { icon: string; title: string; value: string; suffix: string; change: string; detail: string; bars?: boolean; records?: boolean }) { return <article className="stat-card"><div className="stat-label"><span className="stat-icon">{icon}</span>{title}<button aria-label={`${title} options`}>•••</button></div><div className="stat-value">{value} <small>{suffix}</small></div><div className="stat-change">{change} <span>{detail}</span></div>{bars && <div className="micro-bars">{[34, 45, 30, 55, 48, 75, 61, 92, 68, 81, 75, 100].map((height, i) => <i style={{ height: `${height}%` }} key={i} />)}</div>}{records && <div className="record-list"><div><b>Bench Press</b><span>95 kg × 5</span></div><div><b>Romanian Deadlift</b><span>120 kg × 8</span></div></div>}</article>; }
function Activity({ day, month, code, color, name, detail, volume, records }: { day: string; month: string; code: string; color: string; name: string; detail: string; volume: string; records: string }) { return <button className="activity"><div className="activity-date"><b>{day}</b><span>{month}</span></div><span className={`code activity-code ${color}`}>{code}</span><div className="activity-name"><strong>{name}</strong><span>{detail}</span></div><div className="activity-stats"><b>{volume}</b><span>{records}</span></div><span className="arrow">→</span></button>; }

function Workout({ routine, startedAt, logs, completed, progress, volumeKg, saveBusy, timerRequest, onToggle, onUnit, onUpdate, onAddSet, onRemoveSet, onRename, onRestDurationChange, onReorder, onReplace, onRemove, onAddExercise, onFinish, onBack }: { routine: Routine; startedAt: number | null; logs: ExerciseLog[]; completed: number; progress: number; volumeKg: number; saveBusy: boolean; timerRequest: { seconds: number; token: number; label: string } | null; onToggle: (exerciseId: string, setId: string) => void; onUnit: (exerciseId: string) => void; onUpdate: (exerciseId: string, setId: string, patch: Partial<SetLog>) => void; onAddSet: (exerciseId: string) => void; onRemoveSet: (exerciseId: string, setId: string) => void; onRename: (exerciseId: string, name: string) => void; onRestDurationChange: (exerciseId: string, restSeconds: number) => void; onReorder: (exerciseId: string) => void; onReplace: (exerciseId: string) => void; onRemove: (exerciseId: string) => void; onAddExercise: () => void; onFinish: () => void | Promise<void>; onBack: () => void }) {
  const [timerSeconds, setTimerSeconds] = useState(logs[0]?.restSeconds || 120);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerLabel, setTimerLabel] = useState('Rest');
  useEffect(() => { if (!timerRequest) return undefined; const timer = window.setTimeout(() => { setTimerSeconds(timerRequest.seconds); setTimerLabel(timerRequest.label); setTimerRunning(timerRequest.seconds > 0); }, 0); return () => window.clearTimeout(timer); }, [timerRequest]);
  useEffect(() => { if (!timerRunning) return undefined; const interval = window.setInterval(() => setTimerSeconds((current) => { if (current <= 1) { setTimerRunning(false); return 0; } return current - 1; }), 1000); return () => window.clearInterval(interval); }, [timerRunning]);
  const timerMinutes = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const timerRemainder = String(timerSeconds % 60).padStart(2, '0');
  const timerTotal = timerRequest?.seconds || logs[0]?.restSeconds || 120;
  const timerPercent = timerTotal ? Math.max(0, Math.min(100, (timerSeconds / timerTotal) * 100)) : 0;
  return <div className="page workout-page"><button className="back-button" onClick={onBack}>← Overview</button><div className="workout-heading"><div><Kicker>IN PROGRESS · {routine.name.toUpperCase()}</Kicker><h1>{routine.name} <span className="live-chip"><i /> Live</span></h1><p><WorkoutClock startedAt={startedAt} /> · {routine.focus}</p></div><div className="workout-actions"><button className="finish-button" onClick={onFinish} disabled={saveBusy}>{saveBusy ? 'Saving…' : 'Finish workout'}</button></div></div><div className="workout-summary"><div><Kicker>COMPLETION</Kicker><b>{completed}/{logs.reduce((sum, exercise) => sum + exercise.sets.length, 0)} sets</b></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong><div className="summary-divider" /><div><Kicker>VOLUME</Kicker><b>{Math.round(volumeKg).toLocaleString()} kg</b></div><span className="summary-note">Mixed units supported</span></div><div className="exercise-list">{logs.length ? logs.map((exercise, index) => <ExerciseCard exercise={exercise} index={index} onToggle={onToggle} onUnit={onUnit} onUpdate={onUpdate} onAddSet={onAddSet} onRemoveSet={onRemoveSet} onRename={onRename} onRestDurationChange={onRestDurationChange} onReorder={onReorder} onReplace={onReplace} onRemove={onRemove} key={exercise.id} />) : <div className="empty-workout"><span>＋</span><strong>Your workout is empty</strong><p>Add an exercise below to start logging.</p></div>}</div><button className="add-exercise-button" onClick={onAddExercise}>＋ Add exercise</button>{timerRequest && timerSeconds > 0 && <div className="floating-rest-gauge" role="status"><div className="floating-rest-head"><div><Kicker>RESTING · {timerLabel.toUpperCase()}</Kicker><strong>{timerMinutes}:{timerRemainder}</strong></div><button onClick={() => setTimerRunning((running) => !running)}>{timerRunning ? 'Pause' : 'Resume'}</button><button onClick={() => { setTimerRunning(false); setTimerSeconds(0); }}>Skip</button></div><div className="gauge-track"><i style={{ width: `${timerPercent}%` }} /></div></div>}<div className="mobile-workout-bar"><button onClick={() => document.querySelector('.exercise-rest-strip')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>⏱ Rest</button><button onClick={onFinish} disabled={saveBusy}>{saveBusy ? 'Saving…' : 'Finish workout'}</button></div><p className="workout-tip">Set type, weight, unit, and exercise order can all be edited while you train.</p></div>;
}
function WorkoutClock({ startedAt }: { startedAt: number | null }) { const [elapsed, setElapsed] = useState(0); useEffect(() => { if (!startedAt) return undefined; const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000))); tick(); const interval = window.setInterval(tick, 1000); return () => window.clearInterval(interval); }, [startedAt]); const h = String(Math.floor(elapsed / 3600)).padStart(2, '0'); const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0'); const s = String(elapsed % 60).padStart(2, '0'); return <span>{h}:{m}:{s}</span>; }
function ExerciseCard({ exercise, index, onToggle, onUnit, onUpdate, onAddSet, onRemoveSet, onRename, onRestDurationChange, onReorder, onReplace, onRemove }: { exercise: ExerciseLog; index: number; onToggle: (exerciseId: string, setId: string) => void; onUnit: (exerciseId: string) => void; onUpdate: (exerciseId: string, setId: string, patch: Partial<SetLog>) => void; onAddSet: (exerciseId: string) => void; onRemoveSet: (exerciseId: string, setId: string) => void; onRename: (exerciseId: string, name: string) => void; onRestDurationChange: (exerciseId: string, restSeconds: number) => void; onReorder: (exerciseId: string) => void; onReplace: (exerciseId: string) => void; onRemove: (exerciseId: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [restPickerOpen, setRestPickerOpen] = useState(false);
  const displayUnit = exercise.sets[0]?.unit || 'kg';
  return <article className="exercise-card"><div className="exercise-heading"><span className="code coral">{exercise.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span><div><input className="exercise-name-input" value={`${index + 1}. ${exercise.name}`} aria-label="Exercise name" onChange={(event) => onRename(exercise.id, event.target.value.replace(/^\d+\.\s*/, ''))} /><p>{exercise.muscle}</p></div><div className="exercise-menu"><button className="exercise-menu-trigger" aria-label="Exercise options" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>•••</button>{menuOpen && <div className="exercise-menu-popover"><button className="menu-action" onClick={() => { onReorder(exercise.id); setMenuOpen(false); }}>↕ <span>Reorder</span></button><button className="menu-action" onClick={() => { onReplace(exercise.id); setMenuOpen(false); }}>↔ <span>Replace exercise</span></button><button className="menu-action destructive" onClick={() => { onRemove(exercise.id); setMenuOpen(false); }}>× <span>Remove exercise</span></button></div>}</div></div><div className="exercise-rest-strip"><span className="rest-strip-icon">⏱</span><div><strong>Auto rest</strong><small>after each completed set</small></div><button className="rest-picker-trigger" aria-label={`Change auto rest, currently ${formatRestDuration(exercise.restSeconds)}`} onClick={() => setRestPickerOpen(true)}><span className="rest-trigger-value">{formatRestDuration(exercise.restSeconds)}</span><span className="rest-picker-chevron">⌄</span></button></div>{restPickerOpen && <RestPicker value={exercise.restSeconds} onSelect={(seconds) => onRestDurationChange(exercise.id, seconds)} close={() => setRestPickerOpen(false)} />}<div className="set-header"><span>SET</span><span className="previous-heading"><span className="full-label">PREVIOUS</span><span className="short-label">LAST</span></span><div className="weight-heading"><span>WEIGHT</span><button className="unit-toggle" onClick={() => onUnit(exercise.id)} aria-label={`Switch all weights to ${displayUnit === 'kg' ? 'lb' : 'kg'}`}>{displayUnit.toUpperCase()}</button></div><span>REPS</span><span>DONE</span><span /></div>{exercise.sets.map((set, i) => <div className={set.done ? 'set-row complete' : 'set-row'} key={set.id}><div className="set-id"><b>{i + 1}</b><select className={`set-kind-select ${set.kind}`} value={set.kind} aria-label="Set type" title="Set type" onChange={(event) => onUpdate(exercise.id, set.id, { kind: event.target.value as SetKind })}><option value="warmup">Warm-up</option><option value="working">Working</option><option value="backoff">Back-off</option><option value="drop">Drop</option><option value="failure">Failure</option></select></div><span>{set.weight || 0} {set.unit} × {set.reps || 0}</span><div className="weight-edit"><input type="number" min="0" step="0.5" value={set.weight} aria-label="Weight" onChange={(event) => onUpdate(exercise.id, set.id, { weight: Number(event.target.value) || 0 })} /><span className="weight-unit">{set.unit}</span></div><input className="reps-edit" type="number" min="0" value={set.reps} aria-label="Reps" onChange={(event) => onUpdate(exercise.id, set.id, { reps: Number(event.target.value) || 0 })} /><button className="done" onClick={() => onToggle(exercise.id, set.id)} aria-label={set.done ? 'Uncomplete set' : 'Complete set'}>{set.done ? '✓' : ''}<span className="done-label">{set.done ? 'Done' : 'Tap'}</span></button><button className="remove-set" onClick={() => onRemoveSet(exercise.id, set.id)} aria-label="Remove set">×</button></div>)}<div className="set-actions"><button className="add-set" onClick={() => onAddSet(exercise.id)}>＋ Add set</button><span>{exercise.sets.filter((set) => set.kind === 'warmup').length} warm-up · {exercise.sets.filter((set) => set.kind === 'working').length} working</span></div></article>;
}

function Calendar({ recentSessions, onOpen }: { recentSessions: RecentSession[]; onOpen: () => void }) { const trainedDays = useMemo(() => recentSessions.length ? new Set(recentSessions.map((session) => new Date(session.started_at).getDate())) : fallbackTrainedDays, [recentSessions]); return <div className="page"><div className="page-heading"><div><Kicker>TRAINING HISTORY</Kicker><h1>Your calendar</h1><p>Every session counts. Keep building the picture.</p></div><button className="secondary-button">2026⌄</button></div><div className="calendar-layout"><article className="calendar-card"><div className="calendar-title"><button aria-label="Previous month">‹</button><h2>August 2026</h2><button aria-label="Next month">›</button></div><div className="weekday-row">{weekdayLabels.map((label) => <span key={label}>{label}</span>)}</div><div className="calendar-grid">{Array.from({ length: 6 }, (_, i) => <span className="empty-day" key={`empty-${i}`} />)}{Array.from({ length: 31 }, (_, i) => { const day = i + 1; return <button className={trainedDays.has(day) ? 'calendar-day trained' : 'calendar-day'} key={day}><span>{day}</span>{trainedDays.has(day) && <i />}</button>; })}</div><div className="legend"><span><i /> Workout</span><span><i /> Rest day</span></div></article><aside className="month-summary"><Kicker>AUGUST AT A GLANCE</Kicker><div className="month-stat">{recentSessions.length || 9}<small>workouts</small></div>{[['Training days', `${recentSessions.length || 9} / 30`], ['Total volume', recentSessions.length ? 'From saved sets' : '78,420 kg'], ['Time trained', recentSessions.length ? formatDuration(recentSessions.reduce((sum, session) => sum + (session.duration_seconds || 0), 0)) : '9h 42m'], ['Personal records', '7 new']].map(([label, value]) => <div className="summary-row" key={label}><span>{label}</span><b>{value}</b></div>)}<Kicker>MUSCLE DISTRIBUTION</Kicker>{[['Upper body', '52%', 'coral-bar'], ['Lower body', '28%', 'violet-bar'], ['Core & other', '20%', 'amber-bar']].map(([label, value, color]) => <div className="distribution" key={label}><span>{label}</span><i><b className={color} style={{ width: value }} /></i><em>{value}</em></div>)}</aside></div><div className="section-heading calendar-session-heading"><div><Kicker>{recentSessions.length ? 'LATEST SAVED SESSION' : 'AUGUST 27'}</Kicker><h2>{recentSessions[0]?.name || 'Upper A'}</h2></div><button className="text-button" onClick={onOpen}>Open workout →</button></div><button className="session-card" onClick={onOpen}><span className="code coral">{recentSessions.length ? recentSessions[0].name.slice(0, 2).toUpperCase() : 'UA'}</span><div className="activity-name"><strong>{recentSessions[0]?.name || 'Upper A'}</strong><span>{recentSessions.length ? `${formatDuration(recentSessions[0].duration_seconds)} · saved in Supabase` : '6 exercises · 19 sets · 1h 12m'}</span></div><div className="session-stats"><b>{recentSessions.length ? 'Saved' : '9,240 kg'}</b><span>{recentSessions.length ? 'Complete session' : '2 personal records'}</span></div><span className="arrow">→</span></button></div>; }

function Progress() { return <div className="page"><div className="page-heading"><div><Kicker>THE BIG PICTURE</Kicker><h1>Progress, measured.</h1><p>Strength is a trend, not a single number.</p></div><button className="secondary-button">Last 12 weeks⌄</button></div><div className="progress-grid"><article className="progress-card"><div className="stat-label"><span className="stat-icon">↗</span>ESTIMATED 1RM · BARBELL BENCH PRESS<button aria-label="Chart options">•••</button></div><div className="progress-value">95 <small>kg</small><span>↑ 12.4%</span></div><div className="fake-chart">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</div><div className="chart-labels"><span>JUN 14</span><span>JUL 05</span><span>JUL 26</span><span>AUG 16</span></div></article><article className="progress-card body-card"><div className="stat-label"><span className="stat-icon violet">◒</span>BODYWEIGHT<button aria-label="Bodyweight options">•••</button></div><div className="progress-value">78.4 <small>kg</small></div><div className="body-change">— 0.6 kg <span>since June</span></div><div className="weight-bars">{[65, 60, 70, 58, 62, 48, 52, 40, 44, 32].map((height, i) => <i style={{ height: `${height}%` }} key={i} />)}</div><button className="card-action">Log measurement ＋</button></article></div><div className="section-heading"><div><Kicker>PERFORMANCE</Kicker><h2>Personal records</h2></div><button className="text-button">See all →</button></div><div className="pr-table"><div className="pr-head"><span>EXERCISE</span><span>BEST SET</span><span>EST. 1RM</span><span>CHANGE</span></div>{[['Barbell Bench Press', '95 kg × 5', '111 kg', '↑ 12.4%'], ['Romanian Deadlift', '120 kg × 8', '152 kg', '↑ 8.1%'], ['Seated Cable Row', '165 lb × 8', '209 lb', '↑ 5.5%'], ['Dumbbell Shoulder Press', '28 kg × 6', '34 kg', '↑ 4.2%']].map((row) => <div className="pr-row" key={row[0]}>{row.map((cell, i) => i === 0 ? <strong key={cell}>{cell}</strong> : <span key={cell}>{cell}</span>)}</div>)}</div></div>; }

function RoutineOption({ routine, onClick }: { routine: Routine; onClick: () => void }) { return <button className="routine-option" onClick={onClick}><span className={`code ${routine.color}`}>{routine.code}</span><div><strong>{routine.name}</strong><span>{routine.focus} · {routine.exercises.length || 'Add'} exercises · Last {routine.lastTrained}</span></div><b>→</b></button>; }
function ExercisePickerModal({ library, search, name, muscle, message, onSearch, onName, onMuscle, onPick, onCreate, close }: { library: LibraryExercise[]; search: string; name: string; muscle: string; message: string; onSearch: (value: string) => void; onName: (value: string) => void; onMuscle: (value: string) => void; onPick: (exercise: LibraryExercise) => void; onCreate: () => void; close: () => void }) {
  const filtered = library.filter((exercise) => `${exercise.name} ${exercise.primary_muscle} ${exercise.equipment}`.toLowerCase().includes(search.toLowerCase()));
  return <Modal title="Add an exercise" kicker="EXERCISE LIBRARY" close={close}><p className="picker-copy">Choose a movement from your library, or create one once and reuse it in every routine.</p><input className="auth-input exercise-search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search exercises…" aria-label="Search exercises" />{filtered.length > 0 && <div className="exercise-library-list">{filtered.map((exercise) => <button className="library-option" key={exercise.id} onClick={() => onPick(exercise)}><span className="code coral">{exercise.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span><div><strong>{exercise.name}</strong><span>{exercise.primary_muscle} · {exercise.equipment}</span></div><b>＋</b></button>)}</div>}{filtered.length === 0 && <p className="empty-option">No matching exercise yet. Create it below.</p>}<div className="create-exercise-box"><Kicker>NEW MOVEMENT</Kicker><label>Name<input value={name} onChange={(event) => onName(event.target.value)} placeholder="e.g. Cable lateral raise" /></label><label>Muscle group<input value={muscle} onChange={(event) => onMuscle(event.target.value)} placeholder="e.g. Shoulders" /></label><button className="primary-button" onClick={onCreate}>Create and add to workout</button>{message && <p className="auth-message" role="status">{message}</p>}</div></Modal>;
}
function Modal({ title, kicker, close, children }: { title: string; kicker: string; close: () => void; children: ReactNode }) { return <div className="modal-backdrop" onClick={close}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><Kicker>{kicker}</Kicker><h2>{title}</h2></div><button onClick={close} aria-label="Close">×</button></div>{children}</div></div>; }
function AuthModal({ email, message, busy, onEmail, onSubmit, close }: { email: string; message: string; busy: boolean; onEmail: (email: string) => void; onSubmit: () => void; close: () => void }) { return <Modal title="Save your progress" kicker="PRIVATE TRAINING LOG" close={close}><p className="auth-copy">Sign in with a secure email link so Prog can keep every set, calendar day and personal record safe.</p><label className="auth-label" htmlFor="auth-email">Email address</label><input id="auth-email" className="auth-input" type="email" value={email} onChange={(event) => onEmail(event.target.value)} placeholder="you@example.com" onKeyDown={(event) => { if (event.key === 'Enter') onSubmit(); }} /><button className="primary-button auth-submit" onClick={onSubmit} disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>{message && <p className="auth-message" role="status">{message}</p>}<p className="auth-footnote">Your data stays in your Supabase project. Never share a service-role key.</p></Modal>; }
