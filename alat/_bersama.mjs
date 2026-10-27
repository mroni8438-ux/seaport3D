// Bantuan bersama untuk skrip alat/ (dijalankan pemilik di komputernya, tidak ikut build/Vercel).
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

export function bacaEnv(nama) {
  if (!existsSync(nama)) {
    console.error(`Berkas ${nama} belum ada di folder app. Lihat BACKEND-NOTES bagian 6.`);
    process.exit(1);
  }
  process.loadEnvFile(nama); // Node.js LTS 20.12+
}

export function klienAdmin() {
  bacaEnv('.env.admin');
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error('Isi SUPABASE_URL dan SUPABASE_SECRET_KEY di .env.admin.');
    process.exit(1);
  }
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// Urutan tabel relasi (induk dulu)
export const TABEL = [
  'pengaturan',
  'pengguna',
  'dermaga',
  'crane',
  'kapal',
  'kontainer',
  'log_aktivitas'
];
