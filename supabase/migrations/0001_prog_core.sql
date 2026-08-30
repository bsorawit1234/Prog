create extension if not exists "pgcrypto";

create type public.weight_unit as enum ('kg', 'lb');
create type public.program_status as enum ('active', 'archived');
create type public.session_status as enum ('in_progress', 'completed', 'abandoned');
create type public.set_type as enum ('warmup', 'working', 'backoff', 'drop', 'failure');
create type public.tracking_type as enum ('weight_reps', 'bodyweight_reps', 'assisted', 'duration', 'distance');
create type public.record_type as enum ('max_weight', 'max_reps', 'estimated_1rm', 'max_volume');

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '', display_name text not null default 'Athlete',
  preferred_weight_unit public.weight_unit not null default 'kg',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null, primary_muscle text not null, secondary_muscles text[] not null default '{}', equipment text not null default 'Other',
  tracking_type public.tracking_type not null default 'weight_reps', default_weight_unit public.weight_unit not null default 'kg',
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id, name)
);

create table public.programs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null, description text, status public.program_status not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.routines (
  id uuid primary key default gen_random_uuid(), program_id uuid not null references public.programs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade, name text not null, sequence_position int,
  estimated_minutes int, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(), routine_id uuid not null references public.routines(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id), position int not null, rest_seconds int not null default 120,
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(routine_id, position)
);

create table public.routine_set_targets (
  id uuid primary key default gen_random_uuid(), routine_exercise_id uuid not null references public.routine_exercises(id) on delete cascade,
  position int not null, set_type public.set_type not null default 'working', target_reps_min int, target_reps_max int,
  target_weight numeric, target_weight_unit public.weight_unit, target_rpe numeric, target_rir int, unique(routine_exercise_id, position)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null, routine_id uuid references public.routines(id) on delete set null,
  name text not null, started_at timestamptz not null default now(), completed_at timestamptz, duration_seconds int,
  status public.session_status not null default 'in_progress', notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null, exercise_name_snapshot text not null, muscle_snapshot text not null,
  position int not null, notes text, unique(session_id, position)
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(), workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  position int not null, set_type public.set_type not null default 'working', weight_value numeric, weight_unit public.weight_unit,
  normalized_weight_kg numeric, reps int, duration_seconds int, distance_meters numeric, rpe numeric, rir int, rest_seconds int,
  completed_at timestamptz, unique(workout_exercise_id, position)
);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, measured_at timestamptz not null default now(),
  body_weight numeric, body_weight_unit public.weight_unit, body_weight_kg numeric, body_fat_percent numeric, measurements jsonb not null default '{}', notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, measured_at timestamptz not null default now(),
  storage_key text not null, view text not null default 'front' check (view in ('front', 'back', 'side', 'other')), note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.personal_records (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, exercise_id uuid not null references public.exercises(id),
  workout_set_id uuid not null references public.workout_sets(id) on delete cascade, record_type public.record_type not null, value numeric not null,
  unit text not null check (unit in ('kg', 'lb', 'reps')), achieved_at timestamptz not null default now()
);

create table public.schedule_entries (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, program_id uuid not null references public.programs(id) on delete cascade,
  routine_id uuid not null references public.routines(id) on delete cascade, mode text not null check (mode in ('weekday', 'sequence')),
  weekday int check (weekday between 0 and 6), sequence_position int, active boolean not null default true
);

create index workout_sessions_owner_date_idx on public.workout_sessions(owner_id, started_at desc);
create index workout_exercises_session_idx on public.workout_exercises(session_id);
create index workout_sets_exercise_idx on public.workout_sets(workout_exercise_id);
create index body_measurements_owner_date_idx on public.body_measurements(owner_id, measured_at desc);
create index personal_records_owner_exercise_idx on public.personal_records(owner_id, exercise_id);

do $$ declare t text; begin
  foreach t in array array['profiles','exercises','programs','routines','routine_exercises','routine_set_targets','workout_sessions','workout_exercises','workout_sets','body_measurements','progress_photos','personal_records','schedule_entries'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy "owners manage profiles" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "owners manage exercises" on public.exercises for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage programs" on public.programs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage routines" on public.routines for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage routine exercises" on public.routine_exercises for all using (exists (select 1 from public.routines r where r.id = routine_id and r.owner_id = auth.uid())) with check (exists (select 1 from public.routines r where r.id = routine_id and r.owner_id = auth.uid()));
create policy "owners manage routine targets" on public.routine_set_targets for all using (exists (select 1 from public.routine_exercises re join public.routines r on r.id = re.routine_id where re.id = routine_exercise_id and r.owner_id = auth.uid())) with check (exists (select 1 from public.routine_exercises re join public.routines r on r.id = re.routine_id where re.id = routine_exercise_id and r.owner_id = auth.uid()));
create policy "owners manage sessions" on public.workout_sessions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage workout exercises" on public.workout_exercises for all using (exists (select 1 from public.workout_sessions ws where ws.id = session_id and ws.owner_id = auth.uid())) with check (exists (select 1 from public.workout_sessions ws where ws.id = session_id and ws.owner_id = auth.uid()));
create policy "owners manage workout sets" on public.workout_sets for all using (exists (select 1 from public.workout_exercises we join public.workout_sessions ws on ws.id = we.session_id where we.id = workout_exercise_id and ws.owner_id = auth.uid())) with check (exists (select 1 from public.workout_exercises we join public.workout_sessions ws on ws.id = we.session_id where we.id = workout_exercise_id and ws.owner_id = auth.uid()));
create policy "owners manage measurements" on public.body_measurements for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage photos" on public.progress_photos for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage records" on public.personal_records for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage schedule" on public.schedule_entries for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger exercises_updated_at before update on public.exercises for each row execute procedure public.set_updated_at();
create trigger programs_updated_at before update on public.programs for each row execute procedure public.set_updated_at();
create trigger routines_updated_at before update on public.routines for each row execute procedure public.set_updated_at();
create trigger routine_exercises_updated_at before update on public.routine_exercises for each row execute procedure public.set_updated_at();
create trigger workout_sessions_updated_at before update on public.workout_sessions for each row execute procedure public.set_updated_at();
create trigger body_measurements_updated_at before update on public.body_measurements for each row execute procedure public.set_updated_at();
create trigger progress_photos_updated_at before update on public.progress_photos for each row execute procedure public.set_updated_at();
