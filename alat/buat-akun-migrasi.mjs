#!/usr/bin/env node
// Skrip pembuatan akun staf migrasi di Supabase Auth dengan sandi sementara acak
import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { klienAdmin } from './_bersama.mjs';

function buatSandiAcak(panjang = 10) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%';
  let s = '';
  for (let i = 0; i < panjang; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}

async function jalankan() {
  console.log('=== PEMBUATAN AKUN STAF MIGRASI (SUPABASE AUTH) ===\n');
  const supabase = klienAdmin();

  // Ambil data pengguna aktif yang belum memiliki auth_uid
  const { data: penggunaList, error } = await supabase
    .from('pengguna')
    .select('id, username, email, nama_lengkap, peran, auth_uid')
    .eq('status_aktif', 'Aktif');

  if (error) {
    console.error('[GALAT] Gagal membaca tabel pengguna:', error.message);
    process.exit(1);
  }

  const akunBaru = [];
  console.log(`Ditemukan ${penggunaList.length} pengguna aktif.`);

  for (const p of penggunaList) {
    if (p.auth_uid) {
      console.log(`- [LEWATI] ${p.username} (${p.email}) sudah memiliki auth_uid.`);
      continue;
    }

    const sandiSementara = buatSandiAcak(10);
    console.log(`- Membuat akun Auth untuk ${p.username} (${p.email})...`);

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: p.email,
      password: sandiSementara,
      email_confirm: true,
      user_metadata: { nama_lengkap: p.nama_lengkap, peran: p.peran }
    });

    if (authError) {
      console.error(`  [GAGAL] Tidak dapat membuat auth untuk ${p.email}:`, authError.message);
      continue;
    }

    const uid = authData.user.id;

    // Tautkan auth_uid dan tandai wajib ganti sandi
    const { error: updError } = await supabase
      .from('pengguna')
      .update({ auth_uid: uid, wajib_ganti_sandi: true })
      .eq('id', p.id);

    if (updError) {
      console.error(`  [GAGAL] Gagal memperbarui auth_uid pengguna ${p.id}:`, updError.message);
    } else {
      akunBaru.push({
        id: p.id,
        username: p.username,
        email: p.email,
        sandi_sementara: sandiSementara
      });
      console.log(`  [BERHASIL] UID: ${uid} (Wajib Ganti Sandi = true)`);
    }
  }

  if (akunBaru.length > 0) {
    const csvSandi = 'id,username,email,sandi_sementara\n' +
      akunBaru.map(a => `${a.id},${a.username},${a.email},${a.sandi_sementara}`).join('\n');
    const pathSandi = resolve('migrasi/sandi-sementara.csv');
    writeFileSync(pathSandi, csvSandi, 'utf-8');
    console.log(`\n[PENTING] Daftar sandi sementara telah disimpan ke: migrasi/sandi-sementara.csv`);
    console.log(`Bagikan sandi sementara ini secara pribadi kepada staf terkait.`);
    console.log(`PERINGATAN: Hapus berkas migrasi/sandi-sementara.csv setelah selesai dibagikan!`);
  } else {
    console.log('\nTidak ada akun baru yang perlu dibuat.');
  }
}

jalankan().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
