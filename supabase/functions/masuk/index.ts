// Edge Function `masuk` — STANDAR login P4 (Set Pro, Supabase). Deno.
// Pengaturan fungsi: verifikasi JWT DIMATIKAN (dipanggil sebelum masuk).
// Secrets yang dibaca [ASUMSI: cek nama secret bawaan di dasbor Edge Functions]:
//   SUPABASE_URL (bawaan), KUNCI_RAHASIA (secret key; bila tidak diisi pakai SUPABASE_SERVICE_ROLE_KEY bawaan),
//   KUNCI_PUBLIK (publishable key; bila tidak diisi pakai SUPABASE_ANON_KEY bawaan),
//   ALAMAT_APLIKASI (alamat Vercel, mis. https://nama.vercel.app; dipisah koma bila lebih dari satu).
import { createClient } from 'npm:@supabase/supabase-js@2';

const PESAN_GAGAL = 'ID/username/email atau PIN/password salah';
const PESAN_TERKUNCI = 'Akun terkunci sementara. Coba lagi nanti.';

const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? '';
const KUNCI_RAHASIA = Deno.env.get('KUNCI_RAHASIA') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const KUNCI_PUBLIK = Deno.env.get('KUNCI_PUBLIK') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const ALAMAT = (Deno.env.get('ALAMAT_APLIKASI') ?? '').split(',').map((a) => a.trim()).filter(Boolean);

function headerCors(asal: string | null): Record<string, string> {
  // Tanpa ALAMAT_APLIKASI → '*' (hanya untuk uji). Isi ALAMAT_APLIKASI sebelum dipakai pengguna asli.
  const izinkan = ALAMAT.length === 0 ? '*' : (asal && ALAMAT.includes(asal) ? asal : ALAMAT[0]);
  return {
    'Access-Control-Allow-Origin': izinkan,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function balas(isi: unknown, cors: Record<string, string>): Response {
  // Selalu 200 + { ok } agar frontend bisa membaca pesan ramah.
  return new Response(JSON.stringify(isi), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  const cors = headerCors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return balas({ ok: false, pesan: PESAN_GAGAL }, cors);

  try {
    const { identitas, sandi } = await req.json();
    const asli = String(identitas ?? '').trim();
    const id = asli.toLowerCase();
    if (!id || !sandi) return balas({ ok: false, pesan: PESAN_GAGAL }, cors);

    const admin = createClient(URL_SUPABASE, KUNCI_RAHASIA, { auth: { persistSession: false } });

    // 1) Cari pengguna lewat username / email / id (pencarian terpisah dengan .eq/.in, tanpa merakit filter dari teks).
    //    username & email disimpan huruf kecil; id dicocokkan apa adanya atau huruf besar (mis. usr-001 → USR-001).
    const kolomSelect = 'id, auth_uid, email, nama_lengkap, peran, status_aktif, gagal_masuk, terkunci_sampai, wajib_ganti_sandi';
    let pengguna = null;
    for (const kolom of ['username', 'email']) {
      const { data } = await admin.from('pengguna').select(kolomSelect).eq(kolom, id).maybeSingle();
      if (data) { pengguna = data; break; }
    }
    if (!pengguna) {
      const { data } = await admin.from('pengguna').select(kolomSelect).in('id', [asli, asli.toUpperCase()]).limit(1);
      pengguna = data?.[0] ?? null;
    }
    if (!pengguna || pengguna.status_aktif !== 'Aktif') {
      return balas({ ok: false, pesan: PESAN_GAGAL }, cors);
    }

    // 2) Masih terkunci?
    if (pengguna.terkunci_sampai && new Date(pengguna.terkunci_sampai) > new Date()) {
      return balas({ ok: false, terkunci: true, pesan: PESAN_TERKUNCI }, cors);
    }

    // 3) Masuk ke Supabase Auth dengan email hasil pencarian.
    const publik = createClient(URL_SUPABASE, KUNCI_PUBLIK, { auth: { persistSession: false } });
    const { data: hasil, error } = await publik.auth.signInWithPassword({ email: pengguna.email, password: String(sandi) });

    if (error || !hasil?.session) {
      // 4) Gagal: tambah hitungan; capai batas → kunci.
      const { data: atur } = await admin.from('pengaturan').select('kunci, nilai').in('kunci', ['batas_gagal_masuk', 'menit_kunci']);
      const peta = Object.fromEntries((atur ?? []).map((b) => [b.kunci, Number(b.nilai)]));
      const batas = peta.batas_gagal_masuk || 5;
      const menit = peta.menit_kunci || 15;
      const gagal = (pengguna.gagal_masuk ?? 0) + 1;
      const ubah = gagal >= batas
        ? { gagal_masuk: 0, terkunci_sampai: new Date(Date.now() + menit * 60_000).toISOString() }
        : { gagal_masuk: gagal };
      await admin.from('pengguna').update(ubah).eq('id', pengguna.id);
      return balas(gagal >= batas ? { ok: false, terkunci: true, pesan: PESAN_TERKUNCI } : { ok: false, pesan: PESAN_GAGAL }, cors);
    }

    // Berhasil: nolkan hitungan, kirim sesi.
    await admin.from('pengguna').update({ gagal_masuk: 0, terkunci_sampai: null }).eq('id', pengguna.id);
    return balas({
      ok: true,
      sesi: { access_token: hasil.session.access_token, refresh_token: hasil.session.refresh_token },
      pengguna: { id: pengguna.id, nama_lengkap: pengguna.nama_lengkap, peran: pengguna.peran, wajib_ganti_sandi: !!pengguna.wajib_ganti_sandi },
    }, cors);
  } catch (_e) {
    // Tidak pernah membalas galat mentah.
    return balas({ ok: false, pesan: 'Terjadi kesalahan, coba lagi.' }, cors);
  }
});
