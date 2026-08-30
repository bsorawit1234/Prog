'use client';

import { useMemo, useState } from 'react';

type Tab = 'overview' | 'workout' | 'calendar' | 'progress';
type Unit = 'kg' | 'lb';
type SetLog = { id: string; weight: number; reps: number; unit: Unit; done: boolean };
type ExerciseLog = { id: string; name: string; muscle: string; sets: SetLog[] };

const weekdayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const trainedDays = new Set([2, 4, 8, 11, 14, 18, 21, 25, 27]);

const starterExercises: ExerciseLog[] = [
  { id: 'bench', name: 'Barbell Bench Press', muscle: 'Chest · Barbell', sets: [
    { id: 'b1', weight: 80, reps: 8, unit: 'kg', done: true },
    { id: 'b2', weight: 80, reps: 8, unit: 'kg', done: true },
    { id: 'b3', weight: 80, reps: 7, unit: 'kg', done: false },
  ] },
  { id: 'row', name: 'Seated Cable Row', muscle: 'Back · Machine', sets: [
    { id: 'r1', weight: 145, reps: 10, unit: 'lb', done: true },
    { id: 'r2', weight: 145, reps: 10, unit: 'lb', done: false },
    { id: 'r3', weight: 145, reps: 10, unit: 'lb', done: false },
  ] },
  { id: 'shoulder', name: 'Dumbbell Shoulder Press', muscle: 'Shoulders · Dumbbell', sets: [
    { id: 's1', weight: 24, reps: 10, unit: 'kg', done: false },
    { id: 's2', weight: 24, reps: 10, unit: 'kg', done: false },
    { id: 's3', weight: 24, reps: 10, unit: 'kg', done: false },
  ] },
];

function Logo() {
  return <div className="brand"><span className="brand-bars"><i /><i /><i /></span><span>prog</span></div>;
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="kicker">{children}</p>;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('overview');
  const [showStart, setShowStart] = useState(false);
  const [showPrograms, setShowPrograms] = useState(false);
  const [logs, setLogs] = useState(starterExercises);
  const [saved, setSaved] = useState(false);

  const allSets = logs.flatMap((exercise) => exercise.sets);
  const completed = allSets.filter((set) => set.done).length;
  const volumeKg = allSets.reduce((total, set) => total + (set.done ? (set.unit === 'lb' ? set.weight / 2.20462 : set.weight) * set.reps : 0), 0);
  const progress = Math.round((completed / allSets.length) * 100);

  function toggleSet(exerciseId: string, setId: string) {
    setLogs((current) => current.map((exercise) => exercise.id !== exerciseId ? exercise : {
      ...exercise,
      sets: exercise.sets.map((set) => set.id === setId ? { ...set, done: !set.done } : set),
    }));
  }

  function toggleUnit(exerciseId: string, setId: string) {
    setLogs((current) => current.map((exercise) => exercise.id !== exerciseId ? exercise : {
      ...exercise,
      sets: exercise.sets.map((set) => set.id === setId ? { ...set, unit: set.unit === 'kg' ? 'lb' : 'kg' } : set),
    }));
  }

  function startWorkout() {
    setShowStart(false);
    setTab('workout');
    setSaved(false);
  }

  function finishWorkout() {
    setSaved(true);
    setTab('overview');
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <Logo />
      <Kicker>TRAIN</Kicker>
      <nav className="side-nav" aria-label="Primary navigation">
        <button className={tab === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('overview')}><Icon>⌂</Icon>Overview</button>
        <button className={tab === 'workout' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('workout')}><Icon>◉</Icon>Workout <span className="status-dot" /></button>
        <button className="nav-item" onClick={() => setShowPrograms(true)}><Icon>▤</Icon>Programs</button>
        <button className={tab === 'calendar' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('calendar')}><Icon>▦</Icon>Calendar</button>
        <button className={tab === 'progress' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('progress')}><Icon>↗</Icon>Progress</button>
      </nav>
      <Kicker>LIBRARY</Kicker>
      <nav className="side-nav library-nav"><button className="nav-item" onClick={() => setShowPrograms(true)}><Icon>＋</Icon>Exercises</button><button className="nav-item"><Icon>⚙</Icon>Settings</button></nav>
      <div className="profile"><div className="avatar">BS</div><div><strong>Boa Sorawit</strong><span>Personal space</span></div><button>•••</button></div>
    </aside>

    <section className="main-column">
      <header className="topbar"><div className="mobile-logo"><Logo /></div><div className="top-date"><Kicker>SUNDAY, AUGUST 30, 2026</Kicker><span className="saved-state"><i /> All changes saved</span></div><div className="top-actions"><button aria-label="Notifications">♢</button><div className="avatar small">BS</div></div></header>

      {tab === 'overview' && <Overview onStart={() => setShowStart(true)} onCalendar={() => setTab('calendar')} saved={saved} />}
      {tab === 'workout' && <Workout logs={logs} completed={completed} progress={progress} volumeKg={volumeKg} onToggle={toggleSet} onUnit={toggleUnit} onFinish={finishWorkout} onBack={() => setTab('overview')} />}
      {tab === 'calendar' && <Calendar onOpen={() => setTab('workout')} />}
      {tab === 'progress' && <Progress />}
    </section>

    {showStart && <Modal title="What are you training today?" kicker="START A SESSION" close={() => setShowStart(false)}><div className="modal-list"><RoutineOption code="UA" color="coral" name="Upper A" detail="6 exercises · Last trained Aug 27" onClick={startWorkout} /><RoutineOption code="LA" color="violet" name="Lower A" detail="5 exercises · Last trained Aug 25" onClick={startWorkout} /><RoutineOption code="PB" color="amber" name="Push B" detail="7 exercises · Last trained Aug 22" onClick={startWorkout} /><button className="empty-option" onClick={startWorkout}>＋ Start empty workout</button></div></Modal>}
    {showPrograms && <Modal title="Your routines" kicker="PROGRAM LIBRARY" close={() => setShowPrograms(false)}><div className="program-heading"><span className="program-icon">◈</span><div><strong>Upper / Lower Strength</strong><span>4 routines · Active program</span></div><button className="text-button">Edit</button></div><div className="modal-list"><RoutineOption code="UA" color="coral" name="Upper A" detail="6 exercises · Sequence position 1" onClick={startWorkout} /><RoutineOption code="LA" color="violet" name="Lower A" detail="5 exercises · Sequence position 2" onClick={startWorkout} /><RoutineOption code="UB" color="amber" name="Upper B" detail="7 exercises · Sequence position 3" onClick={startWorkout} /><RoutineOption code="LB" color="green" name="Lower B" detail="6 exercises · Sequence position 4" onClick={startWorkout} /><button className="empty-option">＋ Create new routine</button></div></Modal>}
  </main>;
}

function Overview({ onStart, onCalendar, saved }: { onStart: () => void; onCalendar: () => void; saved: boolean }) {
  return <div className="page"><div className="page-heading"><div><Kicker>SUNDAY CHECK-IN</Kicker><h1>Good morning, Boa.</h1><p>Keep the streak alive. Your next session is ready when you are.</p></div><button className="primary-button" onClick={onStart}>＋ Start workout</button></div>{saved && <div className="saved-banner">✓ Workout saved to your history. Nice work.</div>}<div className="overview-grid"><article className="next-card"><div className="card-line"><span className="pill">UPPER A</span><Kicker>NEXT UP · TODAY</Kicker><button>•••</button></div><h2>Upper A</h2><div className="routine-meta">◷ 58–72 min <span>↗ 6 exercises</span></div><Preview code="BP" color="coral" name="Barbell Bench Press" detail="4 sets · 6–8 reps" last="80 kg × 8" /><Preview code="SR" color="violet" name="Seated Cable Row" detail="3 sets · 8–12 reps" last="145 lb × 10" /><button className="card-action" onClick={onStart}>Start Upper A <span>→</span></button></article><article className="streak-card"><div className="card-line"><Kicker>CONSISTENCY</Kicker><b>✦</b></div><div className="streak-value">12<small>days</small></div><p>Your longest streak this year.<br />One session at a time.</p><div className="mini-calendar">{Array.from({ length: 35 }, (_, i) => <i className={i > 5 && (i % 4 === 0 || i % 7 === 0) ? 'filled' : ''} key={i} />)}</div></article><StatCard icon="↗" title="WEEKLY VOLUME" value="12,840" suffix="kg" change="↑ 8.4%" detail="vs last week" bars /><StatCard icon="✦" title="PERSONAL RECORDS" value="7" suffix="this month" change="↑ 3" detail="new this week" records /></div><div className="section-heading"><div><Kicker>YOUR TRAINING</Kicker><h2>Recent activity</h2></div><button className="text-button" onClick={onCalendar}>View calendar →</button></div><div className="activity-list"><Activity day="27" month="AUG" code="UA" color="coral" name="Upper A" detail="6 exercises · 19 sets · 1h 12m" volume="9,240 kg" records="2 PRs" /><Activity day="25" month="AUG" code="LA" color="violet" name="Lower A" detail="5 exercises · 16 sets · 58m" volume="11,680 kg" records="1 PR" /><Activity day="22" month="AUG" code="PB" color="amber" name="Push B" detail="7 exercises · 21 sets · 1h 04m" volume="8,420 kg" records="—" /></div></div>;
}

function Preview({ code, color, name, detail, last }: { code: string; color: string; name: string; detail: string; last: string }) { return <div className="preview"><span className={`code ${color}`}>{code}</span><div><strong>{name}</strong><span>{detail}</span></div><em>{last}</em></div>; }
function StatCard({ icon, title, value, suffix, change, detail, bars, records }: { icon: string; title: string; value: string; suffix: string; change: string; detail: string; bars?: boolean; records?: boolean }) { return <article className="stat-card"><div className="stat-label"><span className="stat-icon">{icon}</span>{title}<button>•••</button></div><div className="stat-value">{value} <small>{suffix}</small></div><div className="stat-change">{change} <span>{detail}</span></div>{bars && <div className="micro-bars">{[34,45,30,55,48,75,61,92,68,81,75,100].map((height, i) => <i style={{ height: `${height}%` }} key={i} />)}</div>}{records && <div className="record-list"><div><b>Bench Press</b><span>95 kg × 5</span></div><div><b>Romanian Deadlift</b><span>120 kg × 8</span></div></div>}</article>; }
function Activity({ day, month, code, color, name, detail, volume, records }: { day: string; month: string; code: string; color: string; name: string; detail: string; volume: string; records: string }) { return <button className="activity"><div className="activity-date"><b>{day}</b><span>{month}</span></div><span className={`code activity-code ${color}`}>{code}</span><div className="activity-name"><strong>{name}</strong><span>{detail}</span></div><div className="activity-stats"><b>{volume}</b><span>{records}</span></div><span className="arrow">→</span></button>; }

function Workout({ logs, completed, progress, volumeKg, onToggle, onUnit, onFinish, onBack }: { logs: ExerciseLog[]; completed: number; progress: number; volumeKg: number; onToggle: (exerciseId: string, setId: string) => void; onUnit: (exerciseId: string, setId: string) => void; onFinish: () => void; onBack: () => void }) { return <div className="page workout-page"><button className="back-button" onClick={onBack}>← Overview</button><div className="workout-heading"><div><Kicker>IN PROGRESS · UPPER A</Kicker><h1>Upper A <span className="live-chip"><i /> Live</span></h1><p>Sunday, August 30 · 00:42:18</p></div><div className="workout-actions"><button className="secondary-button">⏱ Rest timer</button><button className="finish-button" onClick={onFinish}>Finish workout</button></div></div><div className="workout-summary"><div><Kicker>COMPLETION</Kicker><b>{completed}/{logs.reduce((sum, exercise) => sum + exercise.sets.length, 0)} sets</b></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong><div className="summary-divider" /><div><Kicker>VOLUME</Kicker><b>{Math.round(volumeKg).toLocaleString()} kg</b></div><button className="unit-button">Display: All units⌄</button></div><div className="exercise-list">{logs.map((exercise, index) => <ExerciseCard exercise={exercise} index={index} onToggle={onToggle} onUnit={onUnit} key={exercise.id} />)}</div><p className="workout-tip">⌘ Tap the unit beside any set to switch between kg and lb. Prog keeps the original entry and normalizes statistics automatically.</p></div>; }
function ExerciseCard({ exercise, index, onToggle, onUnit }: { exercise: ExerciseLog; index: number; onToggle: (exerciseId: string, setId: string) => void; onUnit: (exerciseId: string, setId: string) => void }) { return <article className="exercise-card"><div className="exercise-heading"><span className="code coral">{exercise.name.split(' ').map((word) => word[0]).slice(0,2).join('')}</span><div><h2>{index + 1}. {exercise.name}</h2><p>{exercise.muscle} · Rest 2:00</p></div><button>•••</button></div><div className="set-header"><span>SET</span><span>PREVIOUS</span><span>WEIGHT</span><span>REPS</span><span>DONE</span></div>{exercise.sets.map((set, i) => <div className={set.done ? 'set-row complete' : 'set-row'} key={set.id}><b>{i + 1}</b><span>{set.weight} {set.unit} × {set.reps}</span><button onClick={() => onUnit(exercise.id, set.id)}>{set.weight} <small>{set.unit}</small></button><span className="reps">{set.reps}</span><button className="done" onClick={() => onToggle(exercise.id, set.id)}>{set.done ? '✓' : ''}</button></div>)}<button className="add-set">＋ Add set</button></article>; }

function Calendar({ onOpen }: { onOpen: () => void }) { return <div className="page"><div className="page-heading"><div><Kicker>TRAINING HISTORY</Kicker><h1>Your calendar</h1><p>Every session counts. Keep building the picture.</p></div><button className="secondary-button">2026⌄</button></div><div className="calendar-layout"><article className="calendar-card"><div className="calendar-title"><button>‹</button><h2>August 2026</h2><button>›</button></div><div className="weekday-row">{weekdayLabels.map((label) => <span key={label}>{label}</span>)}</div><div className="calendar-grid">{Array.from({ length: 6 }, (_, i) => <span className="empty-day" key={`empty-${i}`} />)}{Array.from({ length: 31 }, (_, i) => { const day = i + 1; return <button className={trainedDays.has(day) ? 'calendar-day trained' : 'calendar-day'} key={day}><span>{day}</span>{trainedDays.has(day) && <i />}</button>; })}</div><div className="legend"><span><i /> Workout</span><span><i /> Rest day</span></div></article><aside className="month-summary"><Kicker>AUGUST AT A GLANCE</Kicker><div className="month-stat">9<small>workouts</small></div>{[['Training days','9 / 30'],['Total volume','78,420 kg'],['Time trained','9h 42m'],['Personal records','7 new']].map(([label, value]) => <div className="summary-row" key={label}><span>{label}</span><b>{value}</b></div>)}<Kicker>MUSCLE DISTRIBUTION</Kicker>{[['Upper body','52%','coral-bar'],['Lower body','28%','violet-bar'],['Core & other','20%','amber-bar']].map(([label, value, color]) => <div className="distribution" key={label}><span>{label}</span><i><b className={color} style={{ width: value }} /></i><em>{value}</em></div>)}</aside></div><div className="section-heading calendar-session-heading"><div><Kicker>AUGUST 27</Kicker><h2>Upper A</h2></div><button className="text-button" onClick={onOpen}>Open workout →</button></div><button className="session-card" onClick={onOpen}><span className="code coral">UA</span><div className="activity-name"><strong>Upper A</strong><span>6 exercises · 19 sets · 1h 12m</span></div><div className="session-stats"><b>9,240 kg</b><span>2 personal records</span></div><span className="arrow">→</span></button></div>; }

function Progress() { return <div className="page"><div className="page-heading"><div><Kicker>THE BIG PICTURE</Kicker><h1>Progress, measured.</h1><p>Strength is a trend, not a single number.</p></div><button className="secondary-button">Last 12 weeks⌄</button></div><div className="progress-grid"><article className="progress-card"><div className="stat-label"><span className="stat-icon">↗</span>ESTIMATED 1RM · BARBELL BENCH PRESS<button>•••</button></div><div className="progress-value">95 <small>kg</small><span>↑ 12.4%</span></div><div className="fake-chart"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="chart-labels"><span>JUN 14</span><span>JUL 05</span><span>JUL 26</span><span>AUG 16</span></div></article><article className="progress-card body-card"><div className="stat-label"><span className="stat-icon violet">◒</span>BODYWEIGHT<button>•••</button></div><div className="progress-value">78.4 <small>kg</small></div><div className="body-change">— 0.6 kg <span>since June</span></div><div className="weight-bars">{[65,60,70,58,62,48,52,40,44,32].map((height, i) => <i style={{ height: `${height}%` }} key={i} />)}</div><button className="card-action">Log measurement ＋</button></article></div><div className="section-heading"><div><Kicker>PERFORMANCE</Kicker><h2>Personal records</h2></div><button className="text-button">See all →</button></div><div className="pr-table"><div className="pr-head"><span>EXERCISE</span><span>BEST SET</span><span>EST. 1RM</span><span>CHANGE</span></div>{[['Barbell Bench Press','95 kg × 5','111 kg','↑ 12.4%'],['Romanian Deadlift','120 kg × 8','152 kg','↑ 8.1%'],['Seated Cable Row','165 lb × 8','209 lb','↑ 5.5%'],['Dumbbell Shoulder Press','28 kg × 6','34 kg','↑ 4.2%']].map((row) => <div className="pr-row" key={row[0]}>{row.map((cell, i) => i === 0 ? <strong key={cell}>{cell}</strong> : <span key={cell}>{cell}</span>)}</div>)}</div></div>; }

function RoutineOption({ code, color, name, detail, onClick }: { code: string; color: string; name: string; detail: string; onClick: () => void }) { return <button className="routine-option" onClick={onClick}><span className={`code ${color}`}>{code}</span><div><strong>{name}</strong><span>{detail}</span></div><b>→</b></button>; }
function Modal({ title, kicker, close, children }: { title: string; kicker: string; close: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" onClick={close}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><Kicker>{kicker}</Kicker><h2>{title}</h2></div><button onClick={close}>×</button></div>{children}</div></div>; }
