import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, MODE_CONTOH } from './config.js';

export const supabase = !MODE_CONTOH
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

export const api = {
  async masuk(identitas, sandi) {
    if (MODE_CONTOH || !supabase) {
      console.log('[MODE CONTOH] Masuk:', identitas);
      const isController = identitas.toLowerCase().includes('controller') || identitas.toLowerCase().includes('hartono');
      return {
        ok: true,
        sesi: { access_token: 'dummy-token' },
        pengguna: {
          id: isController ? 'USR-001' : 'USR-002',
          username: isController ? 'controller' : 'viewer',
          email: isController ? 'controller@seaport.local' : 'viewer@seaport.local',
          nama_lengkap: isController ? 'Capt. Hartono' : 'Staf Pemantau',
          peran: isController ? 'Controller' : 'Viewer',
          wajib_ganti_sandi: false
        }
      };
    }

    try {
      // Panggil Edge Function 'masuk'
      const { data, error } = await supabase.functions.invoke('masuk', {
        body: { identitas, sandi }
      });

      if (error) {
        // Fallback: bila Edge Function belum dipasang/CORS, coba langsung auth.signInWithPassword bila berupa email
        if (identitas.includes('@')) {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: identitas,
            password: sandi
          });
          if (!authError && authData?.session) {
            const { data: profil } = await supabase.from('pengguna').select('*').eq('auth_uid', authData.user.id).maybeSingle();
            return {
              ok: true,
              sesi: authData.session,
              pengguna: profil || {
                id: 'USR-001',
                nama_lengkap: authData.user.email,
                peran: 'Controller',
                wajib_ganti_sandi: false
              }
            };
          }
        }
        return { ok: false, pesan: error.message || 'ID/username/email atau sandi salah' };
      }

      if (data?.ok && data?.sesi) {
        await supabase.auth.setSession(data.sesi);
      }
      return data;
    } catch (err) {
      return { ok: false, pesan: err.message || 'Koneksi gagal, silakan coba lagi.' };
    }
  },

  async keluar() {
    if (supabase) {
      try { await supabase.auth.signOut(); } catch (_e) {}
    }
    return { ok: true };
  },

  async gantiSandi(sandiLama, sandiBaru) {
    if (MODE_CONTOH || !supabase) {
      return { ok: true, pesan: 'Sandi berhasil diganti (Mode Contoh).' };
    }
    try {
      const user = (await supabase.auth.getUser())?.data?.user;
      if (!user) return { ok: false, pesan: 'Sesi berakhir, silakan masuk lagi.' };

      // Re-autentikasi sandi lama
      const { error: cekError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: sandiLama
      });
      if (cekError) return { ok: false, pesan: 'Sandi lama salah.' };

      // Update sandi baru
      const { error: updError } = await supabase.auth.updateUser({ password: sandiBaru });
      if (updError) return { ok: false, pesan: updError.message };

      // Matikan flag wajib_ganti_sandi
      await supabase.from('pengguna').update({ wajib_ganti_sandi: false }).eq('auth_uid', user.id);
      return { ok: true, pesan: 'Sandi berhasil diperbarui.' };
    } catch (err) {
      return { ok: false, pesan: err.message || 'Gagal mengubah sandi.' };
    }
  },

  async aturUlangSandi(idPengguna) {
    if (MODE_CONTOH || !supabase) {
      return { ok: true, sandiSementara: 'PortTemp#2026', pesan: 'Sandi sementara berhasil dibuat (Mode Contoh).' };
    }
    try {
      const { data, error } = await supabase.functions.invoke('atur-sandi', {
        body: { idPengguna }
      });
      if (error) return { ok: false, pesan: error.message };
      return data;
    } catch (err) {
      return { ok: false, pesan: err.message || 'Gagal mengatur ulang sandi.' };
    }
  },

  async getDataAwal() {
    if (MODE_CONTOH || !supabase) {
      return { ok: false, pesan: 'Memakai data lokal' };
    }
    try {
      const [rKapal, rDermaga, rCrane, rLog] = await Promise.all([
        supabase.from('kapal').select('*').order('id', { ascending: true }),
        supabase.from('dermaga').select('*').order('id', { ascending: true }),
        supabase.from('crane').select('*').order('id', { ascending: true }),
        supabase.from('log_aktivitas').select('*').order('tanggal_waktu', { ascending: false }).limit(20)
      ]);

      if (rKapal.error || rDermaga.error || rCrane.error) {
        throw new Error('Gagal mengambil data dari Supabase.');
      }

      return {
        ok: true,
        data: {
          kapal: rKapal.data || [],
          dermaga: rDermaga.data || [],
          crane: rCrane.data || [],
          log: rLog.data || []
        }
      };
    } catch (err) {
      console.warn('[SUPABASE] getDataAwal galat, fallback ke data memori:', err.message);
      return { ok: false, pesan: err.message };
    }
  },

  async updateStatusKapal(idKapal, statusBaru) {
    if (MODE_CONTOH || !supabase) {
      return { ok: true, pesan: `Status kapal ${idKapal} diperbarui ke ${statusBaru}` };
    }
    try {
      const updates = { status_alur: statusBaru, diperbarui: new Date().toISOString() };
      if (statusBaru === 'Departure') {
        updates.id_berth = null;
        updates.id_crane = null;
      } else if (statusBaru === 'Berthing') {
        updates.waktu_sandar = new Date().toISOString();
      }

      const { data, error } = await supabase.from('kapal').update(updates).eq('id', idKapal).select().single();
      if (error) throw error;

      // Catat log
      await supabase.from('log_aktivitas').insert({
        id: 'LOG-' + Date.now().toString().slice(-6),
        aksi: 'UPDATE_STATUS',
        id_referensi: idKapal,
        rincian: `Status kapal ${idKapal} diubah menjadi ${statusBaru}`
      });

      return { ok: true, data, pesan: 'Status kapal berhasil diperbarui di database.' };
    } catch (err) {
      return { ok: false, pesan: err.message };
    }
  },

  async alokasiDermaga(idKapal, idBerth) {
    if (MODE_CONTOH || !supabase) {
      return { ok: true, pesan: `Kapal ${idKapal} dialokasikan ke dermaga ${idBerth}` };
    }
    try {
      // Update kapal
      const { error: errKapal } = await supabase.from('kapal').update({
        id_berth: idBerth,
        status_alur: 'Berthing',
        waktu_sandar: new Date().toISOString(),
        diperbarui: new Date().toISOString()
      }).eq('id', idKapal);
      if (errKapal) throw errKapal;

      // Update dermaga
      const { error: errDermaga } = await supabase.from('dermaga').update({
        status: 'Occupied',
        id_kapal_aktif: idKapal,
        diperbarui: new Date().toISOString()
      }).eq('id', idBerth);
      if (errDermaga) throw errDermaga;

      // Log
      await supabase.from('log_aktivitas').insert({
        id: 'LOG-' + Date.now().toString().slice(-6),
        aksi: 'ALOKASI_DERMAGA',
        id_referensi: idKapal,
        rincian: `Kapal ${idKapal} bersandar di ${idBerth}`
      });

      return { ok: true, pesan: `Dermaga ${idBerth} berhasil dialokasikan untuk ${idKapal}.` };
    } catch (err) {
      return { ok: false, pesan: err.message };
    }
  },

  async tugaskanCrane(idKapal, idCrane) {
    if (MODE_CONTOH || !supabase) {
      return { ok: true, pesan: `Derek ${idCrane} ditugaskan ke kapal ${idKapal}` };
    }
    try {
      const { error: errKapal } = await supabase.from('kapal').update({
        id_crane: idCrane,
        status_alur: 'Cargo Ops',
        diperbarui: new Date().toISOString()
      }).eq('id', idKapal);
      if (errKapal) throw errKapal;

      const { error: errCrane } = await supabase.from('crane').update({
        status_crane: 'Operating',
        diperbarui: new Date().toISOString()
      }).eq('id', idCrane);
      if (errCrane) throw errCrane;

      await supabase.from('log_aktivitas').insert({
        id: 'LOG-' + Date.now().toString().slice(-6),
        aksi: 'TUGASKAN_CRANE',
        id_referensi: idKapal,
        rincian: `Derek ${idCrane} ditugaskan bongkar muat kapal ${idKapal}`
      });

      return { ok: true, pesan: `Derek ${idCrane} aktif beroperasi.` };
    } catch (err) {
      return { ok: false, pesan: err.message };
    }
  }
};
