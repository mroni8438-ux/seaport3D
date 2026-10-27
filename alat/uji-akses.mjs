// Uji RLS: masuk sebagai AKUN UJI peran terendah (Viewer) dengan publishable key, lalu mencoba hal yang seharusnya ditolak.
// Setiap baris harus DITOLAK. Satu saja BOCOR = temuan Kritis (serahkan ke Koko Pro).
// Jalankan: node alat/uji-akses.mjs   (butuh .env.uji: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, UJI_EMAIL, UJI_SANDI)
import { createClient } from '@supabase/supabase-js';
import { bacaEnv } from './_bersama.mjs';

bacaEnv('.env.uji');
const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, UJI_EMAIL, UJI_SANDI } = process.env;
const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

const tanpaMasuk = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { error: galatMasuk, data: masuk } = await sb.auth.signInWithPassword({ email: UJI_EMAIL, password: UJI_SANDI });
if (galatMasuk) { console.error('Akun uji tidak bisa masuk:', galatMasuk.message); process.exit(1); }
const saya = masuk.user;

const UJI = [
  ['Tanpa masuk: baca tabel pengguna', async () => {
    const { data, error } = await tanpaMasuk.from('pengguna').select('id').limit(5);
    return error || !data?.length ? 'DITOLAK' : 'BOCOR';
  }],
  ['Viewer: ubah status_alur kapal langsung di database', async () => {
    const { data, error } = await sb.from('kapal').update({ status_alur: 'Departure' }).eq('id', 'VSL-001').select('id');
    return error || !data?.length ? 'DITOLAK' : 'BOCOR';
  }],
  ['Viewer: ubah status dermaga langsung di database', async () => {
    const { data, error } = await sb.from('dermaga').update({ status: 'Available' }).eq('id', 'BRT-01').select('id');
    return error || !data?.length ? 'DITOLAK' : 'BOCOR';
  }],
  ['Viewer: ubah peran diri sendiri jadi Controller', async () => {
    const { data, error } = await sb.from('pengguna').update({ peran: 'Controller' }).eq('auth_uid', saya.id).select('id');
    return error || !data?.length ? 'DITOLAK' : 'BOCOR';
  }],
  ['Viewer: ubah tabel pengaturan', async () => {
    const { data, error } = await sb.from('pengaturan').update({ nilai: '999' }).eq('kunci', 'interval_refresh_detik').select('kunci');
    return error || !data?.length ? 'DITOLAK' : 'BOCOR';
  }],
  ['Viewer: panggil Edge Function atur-sandi (khusus Controller)', async () => {
    const { data, error } = await sb.functions.invoke('atur-sandi', { body: { idPengguna: 'USR-001' } });
    return error || !data?.ok ? 'DITOLAK' : 'BOCOR';
  }],
  ['Viewer: ubah wajib_ganti_sandi langsung lewat tabel', async () => {
    const { data, error } = await sb.from('pengguna').update({ wajib_ganti_sandi: false }).eq('auth_uid', saya.id).select('id');
    return error || !data?.length ? 'DITOLAK' : 'BOCOR';
  }],
];

let bocor = 0;
for (const [nama, jalan] of UJI) {
  let hasil;
  try { hasil = await jalan(); } catch { hasil = 'DITOLAK'; }
  if (hasil === 'BOCOR') bocor++;
  console.log(`${hasil.padEnd(8)} ${nama}`);
}
await sb.auth.signOut();
console.log(bocor ? `\n${bocor} BOCOR — Kritis. Perbaiki policy RLS lalu jalankan lagi.` : '\nSemua DITOLAK.');
process.exit(bocor ? 1 : 0);
