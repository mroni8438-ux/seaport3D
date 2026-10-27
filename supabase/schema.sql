-- Schema PostgreSQL untuk SeaPort 3D di Supabase (Set Pro)
-- Eksekusi file ini sekali di SQL Editor Supabase dasbor

-- 1. Tabel Pengaturan Pelabuhan
create table if not exists public.pengaturan (
  kunci text primary key,
  nilai text not null,
  diperbarui timestamptz default now()
);

-- 2. Tabel Pengguna (STANDAR P4 Set Pro)
create table if not exists public.pengguna (
  id text primary key,
  auth_uid uuid unique references auth.users(id) on delete set null,
  username text unique not null,
  email text unique not null,
  nama_lengkap text not null,
  peran text not null check (peran in ('Controller', 'Viewer')),
  status_aktif text not null default 'Aktif' check (status_aktif in ('Aktif', 'Nonaktif')),
  gagal_masuk int not null default 0,
  terkunci_sampai timestamptz,
  wajib_ganti_sandi boolean not null default false,
  dibuat timestamptz default now()
);

-- 3. Tabel Dermaga
create table if not exists public.dermaga (
  id text primary key,
  nama_berth text not null,
  panjang_meter numeric(6,2) not null,
  draft_meter numeric(4,2) not null,
  status text not null check (status in ('Available', 'Occupied', 'Maintenance')),
  id_kapal_aktif text,
  utilisasi_persen int not null default 0,
  diperbarui timestamptz default now()
);

-- 4. Tabel Quay Crane
create table if not exists public.crane (
  id text primary key,
  nama_crane text not null,
  tipe text not null,
  id_berth text not null references public.dermaga(id) on update cascade,
  status_crane text not null check (status_crane in ('Operating', 'Idle', 'Maintenance')),
  target_kontainer int not null default 0,
  kontainer_terlayani int not null default 0,
  produktivitas_mph int not null default 0,
  diperbarui timestamptz default now()
);

-- 5. Tabel Kapal Kontainer
create table if not exists public.kapal (
  id text primary key,
  nama_kapal text not null,
  call_sign text not null,
  imo_number text not null,
  bendera text not null,
  tipe_kapal text not null,
  kapasitas_teu int not null,
  status_alur text not null check (status_alur in ('Anchorage', 'Inbound', 'Berthing', 'Cargo Ops', 'Departure')),
  id_berth text references public.dermaga(id) on update cascade on delete set null,
  id_crane text references public.crane(id) on update cascade on delete set null,
  eta timestamptz not null,
  etd timestamptz not null,
  waktu_sandar timestamptz,
  muatan_persen int not null default 0,
  diperbarui timestamptz default now()
);

-- 6. Tabel Kontainer
create table if not exists public.kontainer (
  id text primary key,
  nomor_kontainer text not null,
  ukuran text not null check (ukuran in ('20ft', '40ft', '45ft')),
  tipe text not null check (tipe in ('Dry Cargo', 'Reefer', 'Hazardous')),
  berat_ton numeric(5,2) not null,
  status text not null check (status in ('On Vessel', 'Discharging', 'Yard Stored')),
  lokasi_yard text not null,
  id_kapal text references public.kapal(id) on update cascade on delete set null,
  diperbarui timestamptz default now()
);

-- 7. Tabel Log Aktivitas (Audit Trail)
create table if not exists public.log_aktivitas (
  id text primary key,
  tanggal_waktu timestamptz default now(),
  id_pengguna text references public.pengguna(id) on update cascade on delete set null,
  aksi text not null,
  id_referensi text,
  rincian text not null
);

-- Aktifkan Row Level Security (RLS) di semua tabel
alter table public.pengaturan enable row level security;
alter table public.pengguna enable row level security;
alter table public.dermaga enable row level security;
alter table public.crane enable row level security;
alter table public.kapal enable row level security;
alter table public.kontainer enable row level security;
alter table public.log_aktivitas enable row level security;

-- Fungsi Pembantu Peran
create or replace function public.peran_saya() returns text
language sql stable security definer set search_path = public as $$
  select peran from public.pengguna where auth_uid = auth.uid() and status_aktif = 'Aktif'
$$;

-- RLS Policies
-- Pengaturan
drop policy if exists "baca pengaturan" on public.pengaturan;
create policy "baca pengaturan" on public.pengaturan for select to authenticated using (true);
drop policy if exists "ubah pengaturan controller" on public.pengaturan;
create policy "ubah pengaturan controller" on public.pengaturan for update to authenticated using (public.peran_saya() = 'Controller');

-- Pengguna
drop policy if exists "baca profil sendiri atau controller" on public.pengguna;
create policy "baca profil sendiri atau controller" on public.pengguna for select to authenticated
using (auth_uid = auth.uid() or public.peran_saya() = 'Controller');

-- Dermaga
drop policy if exists "baca dermaga" on public.dermaga;
create policy "baca dermaga" on public.dermaga for select to authenticated using (true);
drop policy if exists "ubah dermaga controller" on public.dermaga;
create policy "ubah dermaga controller" on public.dermaga for all to authenticated using (public.peran_saya() = 'Controller');

-- Crane
drop policy if exists "baca crane" on public.crane;
create policy "baca crane" on public.crane for select to authenticated using (true);
drop policy if exists "ubah crane controller" on public.crane;
create policy "ubah crane controller" on public.crane for all to authenticated using (public.peran_saya() = 'Controller');

-- Kapal
drop policy if exists "baca kapal" on public.kapal;
create policy "baca kapal" on public.kapal for select to authenticated using (true);
drop policy if exists "ubah kapal controller" on public.kapal;
create policy "ubah kapal controller" on public.kapal for all to authenticated using (public.peran_saya() = 'Controller');

-- Kontainer
drop policy if exists "baca kontainer" on public.kontainer;
create policy "baca kontainer" on public.kontainer for select to authenticated using (true);
drop policy if exists "ubah kontainer controller" on public.kontainer;
create policy "ubah kontainer controller" on public.kontainer for all to authenticated using (public.peran_saya() = 'Controller');

-- Log Aktivitas
drop policy if exists "baca log" on public.log_aktivitas;
create policy "baca log" on public.log_aktivitas for select to authenticated using (true);
drop policy if exists "tambah log" on public.log_aktivitas;
create policy "tambah log" on public.log_aktivitas for insert to authenticated with check (true);

-- Data Default Pengaturan
insert into public.pengaturan (kunci, nilai) values
  ('nama_pelabuhan', 'Tanjung Perak Container Terminal'),
  ('mode_operasional', 'Normal'),
  ('interval_refresh_detik', '15')
on conflict (kunci) do nothing;
