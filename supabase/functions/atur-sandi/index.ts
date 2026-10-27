// Edge Function `atur-sandi` — P4 Pengaturan sandi: Controller mengatur ulang sandi staf. Deno, satu berkas mandiri.
// Pengaturan fungsi: verifikasi JWT TETAP MENYALA (hanya pengguna yang sudah masuk yang bisa memanggil).
// Secrets [ASUMSI: cek nama secret bawaan di dasbor Edge Functions]:
//   SUPABASE_URL (bawaan), KUNCI_RAHASIA (secret key; bila kosong pakai SUPABASE_SERVICE_ROLE_KEY bawaan),
//   ALAMAT_APLIKASI (alamat Vercel, dipisah koma bila lebih dari satu).
import { createClient } from 'npm:@supabase/supabase-js@2';

const PERAN_ADMIN = 'Controller';
const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? '';
const KUNCI_RAHASIA = Deno.env.get('KUNCI_RAHASIA') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ALAMAT = (Deno.env.get('ALAMAT_APLIKASI') ?? '').split(',').map((a) => a.trim()).filter(Boolean);

function headerCors(asal: string | null): Record<string, string> {
  const izinkan = ALAMAT.length === 0 ? '*' : (asal && ALAMAT.includes(asal) ? asal : ALAMAT[0]);
  return {
    'Access-Control-Allow-Origin': izinkan,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
const balas = (isi: unknown, cors: Record<string, string>) =>
  new Response(JSON.stringify(isi), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

// Sandi sementara acak 12 karakter, tanpa huruf/angka mirip (O/0, l/1/I).
function sandiSementara(panjang = 12): string {
  const huruf = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const acak = new Uint32Array(panjang);
  crypto.getRandomValues(acak);
  return Array.from(acak, (n) => huruf[n % huruf.length]).join('');
}

Deno.serve(async (req) => {
  const cors = headerCors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const TOLAK = { ok: false, pesan: 'Tidak diizinkan.' };
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return balas(TOLAK, cors);
    const admin = createClient(URL_SUPABASE, KUNCI_RAHASIA, { auth: { persistSession: false } });

    // 1) Siapa pemanggil? Harus Controller aktif.
    const { data: u, error: galatUser } = await admin.auth.getUser(token);
    if (galatUser || !u?.user) return balas(TOLAK, cors);
    const { data: pemanggil } = await admin.from('pengguna')
      .select('id, peran, status_aktif').eq('auth_uid', u.user.id).maybeSingle();
    if (!pemanggil || pemanggil.peran !== PERAN_ADMIN || pemanggil.status_aktif !== 'Aktif') return balas(TOLAK, cors);

    // 2) Target
    const { idPengguna } = await req.json();
    if (!idPengguna) return balas({ ok: false, pesan: 'Pilih akun dulu.' }, cors);
    if (idPengguna === pemanggil.id) return balas({ ok: false, pesan: 'Untuk akunmu sendiri, pakai Profil → Ganti sandi.' }, cors);
    const { data: target } = await admin.from('pengguna').select('id, auth_uid').eq('id', idPengguna).maybeSingle();
    if (!target?.auth_uid) return balas({ ok: false, pesan: 'Akun tidak ditemukan.' }, cors);

    // 3) Atur sandi sementara + wajib ganti saat masuk berikutnya
    const sandi = sandiSementara();
    const { error: galatUbah } = await admin.auth.admin.updateUserById(target.auth_uid, { password: sandi });
    if (galatUbah) return balas({ ok: false, pesan: 'Gagal mengatur ulang sandi, coba lagi.' }, cors);
    await admin.from('pengguna')
      .update({ wajib_ganti_sandi: true, gagal_masuk: 0, terkunci_sampai: null }).eq('id', target.id);

    // Sandi sementara hanya dikirim sekali ke Admin/Controller; tidak dicatat di log.
    return balas({ ok: true, sandiSementara: sandi }, cors);
  } catch (_e) {
    return balas({ ok: false, pesan: 'Terjadi kesalahan, coba lagi.' }, cors);
  }
});
