// Membuat 1 akun per peran (Supabase Auth + baris `pengguna`). Aman diulang: akun yang sudah ada dilewati.
// Jalankan: node alat/buat-akun-awal.mjs   (butuh .env.admin)
import { klienAdmin } from './_bersama.mjs';

const AKUN = [
  { id: 'USR-001', username: 'controller', email: 'controller@seaport.local', nama_lengkap: 'Capt. Hartono', peran: 'Controller', sandi: 'Pelabuhan#2026' },
  { id: 'USR-002', username: 'viewer', email: 'viewer@seaport.local', nama_lengkap: 'Staf Pemantau', peran: 'Viewer', sandi: 'Maritim#2026' },
];

const sb = klienAdmin();

for (const a of AKUN) {
  const email = a.email.toLowerCase();
  const { data: ada } = await sb.from('pengguna').select('id').eq('id', a.id).maybeSingle();
  if (ada) { console.log(`LEWATI  ${a.id} (${a.username}) sudah ada`); continue; }

  const { data: dibuat, error } = await sb.auth.admin.createUser({ email, password: a.sandi, email_confirm: true });
  if (error) { console.error(`GAGAL   ${a.username}: ${error.message}`); continue; }

  const { error: galat } = await sb.from('pengguna').insert({
    id: a.id, auth_uid: dibuat.user.id, username: a.username.toLowerCase(), email,
    nama_lengkap: a.nama_lengkap, peran: a.peran, status_aktif: 'Aktif',
  });
  if (galat) { console.error(`GAGAL   baris pengguna ${a.username}: ${galat.message}`); continue; }
  console.log(`DIBUAT  ${a.id} | ${a.username} | ${email} | peran ${a.peran}`);
}
console.log('Selesai. Catat akun di BACKEND-NOTES bagian "Akun awal" dan ganti sandi contoh setelah masuk.');
