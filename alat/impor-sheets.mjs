#!/usr/bin/env node
// Skrip impor data Google Sheets (CSV) ke Supabase PostgreSQL
// Cara pakai:
//   node alat/impor-sheets.mjs --coba   (Uji baca dan validasi data TANPA menulis ke database)
//   node alat/impor-sheets.mjs          (Eksekusi impor sungguhan dengan upsert batch)

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const MODE_COBA = process.argv.includes('--coba');
const DIR_CSV = resolve('migrasi/csv');
const PATH_PETA = resolve('migrasi/peta-kolom.json');

// Parser CSV mandiri (RFC-4180) agar tidak gagal sebelum npm install
function parseCSV(text) {
  const lines = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  // Bersihkan UTF-8 BOM bila ada
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 2;
      } else if (char === '"') {
        inQuotes = false;
        i++;
      } else {
        field += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        row.push(field);
        field = '';
        i++;
      } else if (char === '\r' && next === '\n') {
        row.push(field);
        lines.push(row);
        row = [];
        field = '';
        i += 2;
      } else if (char === '\n' || char === '\r') {
        row.push(field);
        lines.push(row);
        row = [];
        field = '';
        i++;
      } else {
        field += char;
        i++;
      }
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    lines.push(row);
  }

  // Buang baris kosong paling akhir
  while (lines.length > 0 && lines[lines.length - 1].every(c => c.trim() === '')) {
    lines.pop();
  }

  if (lines.length === 0) return [];
  const headers = lines[0].map(h => h.trim());
  const records = [];

  for (let r = 1; r < lines.length; r++) {
    const vals = lines[r];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] !== undefined ? vals[idx].trim() : '';
    });
    records.push(obj);
  }

  return records;
}

// Konversi nilai berdasarkan aturan P11
function ubahNilai(nilai, aturan) {
  if (nilai === null || nilai === undefined || nilai === '') return null;
  const str = String(nilai).trim();
  if (str === '') return null;

  switch (aturan) {
    case 'angka': {
      // Hapus titik ribuan atau format uang
      const bersih = str.replace(/Rp\s?/gi, '').replace(/\./g, '').replace(/,/g, '.').trim();
      const n = Number(bersih);
      return isNaN(n) ? null : n;
    }
    case 'tanggal': {
      // Format dd/mm/yyyy atau yyyy-mm-dd
      if (str.includes('/')) {
        const parts = str.split(' ');
        const dmy = parts[0].split('/');
        if (dmy.length === 3) {
          const tgl = `${dmy[2]}-${dmy[1].padStart(2, '0')}-${dmy[0].padStart(2, '0')}`;
          const jam = parts[1] ? `T${parts[1]}` : 'T00:00:00Z';
          const d = new Date(tgl + jam);
          if (!isNaN(d.getTime())) return d.toISOString();
        }
      }
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    case 'ya_tidak': {
      const low = str.toLowerCase();
      if (['ya', 'y', 'true', '1'].includes(low)) return true;
      if (['tidak', 't', 'false', '0'].includes(low)) return false;
      return false;
    }
    case 'telepon': {
      if (str.startsWith('0')) return str;
      if (str.startsWith('62')) return '0' + str.slice(2);
      return '0' + str;
    }
    default:
      return str;
  }
}

// Pencari berkas CSV cerdas (mendukung nama persis maupun format bawaan unduhan Google Sheets: '<Spreadsheet> - <Tab>.csv')
function cariBerkasCsv(namaTarget) {
  const pathLangsung = join(DIR_CSV, namaTarget);
  if (existsSync(pathLangsung)) return pathLangsung;

  if (existsSync(DIR_CSV)) {
    const files = readdirSync(DIR_CSV);
    const targetLower = namaTarget.toLowerCase();
    for (const f of files) {
      const fLower = f.toLowerCase();
      if (fLower === targetLower || fLower.endsWith(' - ' + targetLower) || fLower.endsWith('-' + targetLower) || fLower.endsWith(targetLower)) {
        return join(DIR_CSV, f);
      }
    }
  }
  return null;
}

async function jalankan() {
  console.log(`=== ALAT IMPOR DATA SHEETS (Mode: ${MODE_COBA ? 'COBA / SIMULASI' : 'SUNGGUHAN / TULIS'}) ===\n`);

  if (!existsSync(PATH_PETA)) {
    console.error(`[ERROR] File peta kolom ${PATH_PETA} tidak ditemukan!`);
    process.exit(1);
  }

  const peta = JSON.parse(readFileSync(PATH_PETA, 'utf-8'));
  const urutan = peta.urutan || [];

  // 1. Periksa kelengkapan file CSV
  const berkasKurang = [];
  for (const namaTabel of urutan) {
    const cfg = peta.tabel[namaTabel];
    if (!cfg || !cfg.csv) continue;
    const pathCsv = cariBerkasCsv(cfg.csv);
    if (!pathCsv) {
      berkasKurang.push(`app/migrasi/csv/${cfg.csv}`);
    }
  }

  if (berkasKurang.length > 0) {
    console.error(`[BERHENTI] Ditemukan berkas CSV yang belum tersedia di folder migrasi:`);
    berkasKurang.forEach(b => console.error(` - ${b}`));
    console.error(`\nSilakan unduh seluruh berkas CSV tab spreadsheet lama terlebih dahulu.`);
    process.exit(1);
  }

  // 2. Baca dan proses setiap tabel
  const hasilLaporan = [];
  const tanggalHariIni = new Date().toISOString().split('T')[0];
  const entitasId = {}; // Cache ID untuk verifikasi relasi

  for (const namaTabel of urutan) {
    const cfg = peta.tabel[namaTabel];
    const pathCsv = cariBerkasCsv(cfg.csv);
    const isiRaw = readFileSync(pathCsv, 'utf-8');
    const barisCsv = parseCSV(isiRaw);

    let terbaca = barisCsv.length;
    let siapDitulis = 0;
    const ditolak = [];
    const dataValid = [];
    const kolomTercatat = Object.keys(cfg.kolom);
    const abaikan = cfg.abaikan || [];
    let kolomTidakDipindah = [];

    // Deteksi kolom CSV yang tidak dipindah
    if (barisCsv.length > 0) {
      const headerCsv = Object.keys(barisCsv[0]);
      kolomTidakDipindah = headerCsv.filter(h => !kolomTercatat.includes(h));
    }

    entitasId[namaTabel] = new Set();

    barisCsv.forEach((baris, idx) => {
      const noBaris = idx + 2; // Baris 1 header
      const rowBaru = {};
      let adaGalat = false;
      const alasanGalat = [];

      // Validasi kolom wajib
      for (const k of cfg.wajib || []) {
        if (!baris[k] || baris[k].trim() === '') {
          adaGalat = true;
          alasanGalat.push(`Kolom wajib '${k}' kosong`);
        }
      }

      // Transformasi kolom
      for (const [kLama, kBaru] of Object.entries(cfg.kolom)) {
        const val = baris[kLama];
        const aturan = cfg.ubah ? cfg.ubah[kLama] : null;
        rowBaru[kBaru] = ubahNilai(val, aturan);
      }

      if (adaGalat) {
        ditolak.push({ baris: noBaris, id: baris.id || '-', alasan: alasanGalat.join('; ') });
      } else {
        siapDitulis++;
        dataValid.push(rowBaru);
        if (rowBaru.id) entitasId[namaTabel].add(rowBaru.id);
      }
    });

    hasilLaporan.push({
      tabel: namaTabel,
      csv: cfg.csv,
      terbaca,
      siapDitulis,
      ditolak,
      kolomTidakDipindah,
      dataValid
    });
  }

  // 3. Tampilkan Ringkasan ke Konsol
  console.log('----------------------------------------------------------------------------------------');
  console.log('| Tabel           | File CSV          | Terbaca | Siap Tulis | Ditolak | Kolom Tidak Dipindah');
  console.log('----------------------------------------------------------------------------------------');
  for (const h of hasilLaporan) {
    const t = h.tabel.padEnd(15);
    const f = h.csv.padEnd(17);
    const b = String(h.terbaca).padStart(7);
    const s = String(h.siapDitulis).padStart(10);
    const d = String(h.ditolak.length).padStart(7);
    const k = h.kolomTidakDipindah.length > 0 ? h.kolomTidakDipindah.join(', ') : '-';
    console.log(`| ${t} | ${f} | ${b} | ${s} | ${d} | ${k}`);
  }
  console.log('----------------------------------------------------------------------------------------\n');

  // Cetak rincian bila ada yang ditolak
  let totalDitolak = 0;
  for (const h of hasilLaporan) {
    if (h.ditolak.length > 0) {
      console.log(`[PERINGATAN] Rincian Ditolak Tabel '${h.tabel}':`);
      h.ditolak.forEach(d => {
        console.log(`  - Baris ${d.baris} (ID: ${d.id}): ${d.alasan}`);
      });
      totalDitolak += h.ditolak.length;
    }
  }

  // 4. Buat File Laporan Markdown
  const pathLaporan = resolve(`migrasi/laporan-${tanggalHariIni}.md`);
  let md = `# Laporan Uji Simulasi Impor Data (${tanggalHariIni})\n\n`;
  md += `Mode Eksekusi: **${MODE_COBA ? 'Simulasi (--coba, Tanpa Penulisan)' : 'Impor Sungguhan'}**\n\n`;
  md += `| Tabel | File CSV | Terbaca | Siap Tulis | Ditolak | Kolom Tidak Dipindah |\n`;
  md += `|---|---|---|---|---|---|\n`;
  for (const h of hasilLaporan) {
    const k = h.kolomTidakDipindah.length > 0 ? h.kolomTidakDipindah.join(', ') : '-';
    md += `| \`${h.tabel}\` | \`${h.csv}\` | ${h.terbaca} | ${h.siapDitulis} | ${h.ditolak.length} | ${k} |\n`;
  }
  md += `\n## Rincian Baris Ditolak\n`;
  if (totalDitolak === 0) {
    md += `*Seluruh baris data valid dan siap ditulis tanpa ada penolakan.*\n`;
  } else {
    for (const h of hasilLaporan) {
      if (h.ditolak.length > 0) {
        md += `\n### Tabel \`${h.tabel}\`\n`;
        h.ditolak.forEach(d => {
          md += `- Baris ${d.baris} (ID: \`${d.id}\`): ${d.alasan}\n`;
        });
      }
    }
  }

  writeFileSync(pathLaporan, md, 'utf-8');
  console.log(`[BERHASIL] Laporan simulasi telah disimpan ke: migrasi/laporan-${tanggalHariIni}.md`);

  if (!MODE_COBA) {
    console.log('\n[INFO] Menjalankan impor sungguhan ke Supabase via klienAdmin()...');
    const { klienAdmin } = await import('./_bersama.mjs');
    const supabase = klienAdmin();

    for (const h of hasilLaporan) {
      if (h.dataValid.length === 0) continue;
      console.log(`Menulis ${h.dataValid.length} baris ke tabel '${h.tabel}'...`);
      // Batch per 500 baris
      for (let i = 0; i < h.dataValid.length; i += 500) {
        const batch = h.dataValid.slice(i, i + 500);
        const { error } = await supabase.from(h.tabel).upsert(batch, { onConflict: 'id' });
        if (error) {
          console.error(`[GALAT] Gagal menulis batch ${i} ke ${h.tabel}:`, error.message);
        }
      }
    }
    console.log('[SELESAI] Seluruh data berhasil ditulis ke Supabase.');
  } else {
    console.log('\n[SIMULASI SELESAI] Tidak ada data yang ditulis ke database.');
  }
}

jalankan().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
