-- Babák
create table babies (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  full_name text,
  born_at timestamptz,
  birth_place text,
  birth_weight_g int,
  birth_length_cm numeric,
  weekly_gain_target_g int default 150,
  created_at timestamptz default now()
);

-- Felhasználó–baba kapcsolat, jogosultsággal és jóváhagyási állapottal
create table baby_members (
  baby_id uuid references babies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'user' check (role in ('user','admin','owner')),
  status text default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz default now(),
  primary key (baby_id, user_id)
);

-- Ruhátlan testsúlymérés — ez adja a súlygörbe és a heti gyarapodás alapját
create table weight_measurements (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies(id) on delete cascade,
  measured_at timestamptz not null,
  weight_g int not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Szoptatás
create table feedings (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies(id) on delete cascade,
  side text check (side in ('left','right','both')),
  started_at timestamptz not null,
  ended_at timestamptz,
  cant_measure boolean default false,
  weight_before_g int,
  weight_after_g int,
  extra_milk_ml int,
  extra_formula_ml int,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Pelenkacsere
create table diapers (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies(id) on delete cascade,
  type text check (type in ('pisi','kaki','mindketto')),
  poop_color text,
  poop_texture text,
  note text,
  changed_at timestamptz not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Ismétlődő teendő sablonok (Karbantartásban szerkesztve — MVP-ben egyelőre fix: köldökápolás, D-vitamin, K-vitamin)
create table care_templates (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies(id) on delete cascade,
  name text not null,
  frequency text check (frequency in ('daily','monthly')),
  created_at timestamptz default now()
);

-- Ismétlődő teendő naplózása (mikor történt meg)
create table care_logs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references care_templates(id) on delete cascade,
  baby_id uuid references babies(id) on delete cascade,
  done_at timestamptz not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Kérdések a védőnőnek/orvosnak
create table questions (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid references babies(id) on delete cascade,
  text text not null,
  recipient text check (recipient in ('vedono','orvos')),
  answer text,
  answered boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
