// Memulihkan data dari berkas cadangan. Membuat cadangan baru DULU, lalu upsert per tabel sesuai urutan relasi.
// Jalankan: node alat/pulihkan.mjs cadangan/<berkas>.json   (butuh .env.admin)
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { klienAdmin, TABEL } from './_bersama.mjs';

const berkas = process.argv[2];
if (!berkas || !existsSync(berkas)) { console.error('Sebutkan berkas cadangan: node alat/pulihkan.mjs cadangan/<berkas>.json'); process.exit(1); }

console.log('Membuat cadangan pengaman dulu…');
execFileSync(process.execPath, ['alat/cadangkan.mjs'], { stdio: 'inherit' });

const isi = JSON.parse(readFileSync(berkas, 'utf8'));
const sb = klienAdmin();
for (const t of TABEL) {
  const baris = isi.tabel?.[t] ?? [];
  if (!baris.length) { console.log(`${t}: kosong, dilewati`); continue; }
  const kunci = t === 'pengaturan' ? 'kunci' : 'id';
  for (let i = 0; i < baris.length; i += 500) {
    const { error } = await sb.from(t).upsert(baris.slice(i, i + 500), { onConflict: kunci });
    if (error) { console.error(`GAGAL memulihkan ${t}: ${error.message}`); process.exit(1); }
  }
  console.log(`${t}: ${baris.length} baris dipulihkan`);
}
console.log('Selesai.');
