// Ekspor semua tabel ke cadangan/seaport-3d-<YYYY-MM-DD-HHmm>.json, simpan 14 terakhir.
// Jalankan: node alat/cadangkan.mjs   (butuh .env.admin). Salin hasilnya ke Google Drive pemilik.
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { klienAdmin, TABEL } from './_bersama.mjs';

const SIMPAN = 14;
const PROYEK = 'seaport-3d';
const sb = klienAdmin();
const isi = { proyek: PROYEK, dibuat: new Date().toISOString(), tabel: {} };

for (const t of TABEL) {
  const semua = [];
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await sb.from(t).select('*').range(dari, dari + 999);
    if (error) { console.error(`GAGAL membaca ${t}: ${error.message}`); process.exit(1); }
    semua.push(...data);
    if (data.length < 1000) break;
  }
  isi.tabel[t] = semua;
  console.log(`${t}: ${semua.length} baris`);
}

mkdirSync('cadangan', { recursive: true });
const d = new Date(), dua = (n) => String(n).padStart(2, '0');
const nama = `cadangan/${PROYEK}-${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}-${dua(d.getHours())}${dua(d.getMinutes())}.json`;
writeFileSync(nama, JSON.stringify(isi, null, 2));
console.log(`Tersimpan: ${nama}`);

const lama = readdirSync('cadangan').filter((f) => f.startsWith(PROYEK) && f.endsWith('.json')).sort();
for (const f of lama.slice(0, Math.max(0, lama.length - SIMPAN))) { unlinkSync(`cadangan/${f}`); console.log(`Dihapus (lebih dari ${SIMPAN}): ${f}`); }
console.log('Catatan: akun Supabase Auth tidak ikut cadangan ini (lihat BACKEND-NOTES bagian 11).');
