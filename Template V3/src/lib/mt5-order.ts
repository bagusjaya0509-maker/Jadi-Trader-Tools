import { auth } from '@/lib/firebase';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';
import { segarkanAkunMt5 } from '@/lib/akun';

/* ════════════════════════════════════════════════════════════════════════
   ORDER MT5 LEWAT WEB — jalur perintah EA Trade-Fi Sync v2
   ════════════════════════════════════════════════════════════════════════
   Web TIDAK berbicara dengan broker; ia menaruh PERINTAH di antrean server,
   dan EA v2 di terminal MT5-lah yang menjemput (tiap 5 detik) lalu
   mengeksekusinya. Dua akibat yang harus dipahami pemakainya:

     · MT5 desktop harus TERBUKA dengan EA terpasang & AutoTrading menyala —
       kalau tidak, perintahnya menunggu, lalu kedaluwarsa dalam 5 menit
       tanpa dieksekusi (order basi lebih berbahaya daripada order gagal).
     · Hasilnya datang MENYUSUL. Karena itu ada tungguHasilMt5: menjajaki
       status sampai EA melapor, supaya orangnya tahu nasib ordernya —
       bukan menatap tombol yang diam.
   ════════════════════════════════════════════════════════════════════════ */


function dasar() {
  const url = bacaKoneksi().url.trim();
  return (url || PROXY_BAWAAN).replace(/\/+$/, '');
}

export interface PerintahMt5 {
  aksi: 'BUKA' | 'UBAH' | 'TUTUP';
  simbol?: string;
  arah?: 'BUY' | 'SELL';
  lot?: number;
  sl?: number;
  tp?: number;
  tiket?: string;
  /** Harga entry yang diminta. 0/kosong = eksekusi di harga pasar.
   *  Kalau diisi dan jaraknya dari harga pasar melewati stops level
   *  broker, EA v2.04+ memasangnya sebagai pending order — Buy/Sell Stop
   *  kalau entry mengejar tembusan, Buy/Sell Limit kalau menunggu balik.
   *  Jenisnya dipilih EA, bukan di sini: hanya terminal yang tahu harga
   *  pasar pada detik eksekusi. */
  entry?: number;
}

export async function kirimPerintahMt5(p: PerintahMt5): Promise<{ id: string }> {
  const u = auth.currentUser;
  if (!u) throw new Error('Masuk dulu dengan akun Google.');
  const token = await u.getIdToken();
  const r = await fetch(`${dasar()}/api/mt5/perintah/kirim`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `Backend menjawab ${r.status}`);
  return { id: String(j.id) };
}

/** Menjajaki nasib satu perintah. EA menjemput tiap 5 detik (v2.13), jadi
 *  polling ±22 detik menutup kasus normalnya; lewat itu, jawabannya jujur:
 *  EA belum melapor — bukan pura-pura sukses.
 *
 *  Dijajaki tiap 1 detik, bukan 2 (2 Okt 2026, keluhan "perubahan order
 *  perlu 5 detikan"): selang 2 detik menambah sampai 2 detik di atas jeda
 *  jemput EA, dan permintaan status ini ringan — cuma berjalan selama ada
 *  yang menunggu hasil. */
export async function tungguHasilMt5(id: string, batasDetik = 22): Promise<{ status: string; pesan: string }> {
  const u = auth.currentUser;
  if (!u) return { status: 'tak-diketahui', pesan: 'Sesi login habis.' };
  const token = await u.getIdToken();
  const mulai = Date.now();
  let putaran = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, putaran++ === 0 ? 800 : 1000));
    try {
      const r = await fetch(`${dasar()}/api/mt5/perintah/status`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      const j = await r.json();
      const p = (j?.perintah ?? []).find((x: { id: string }) => x.id === id) as
        { status: string; pesan?: string } | undefined;
      if (p && ['sukses', 'gagal', 'kedaluwarsa'].includes(p.status)) {
        /* ── POSISI DIBACA ULANG BERTAHAP ──────────────────────────────
           Server sudah menerapkan SL/TP baru begitu EA melapor sukses, jadi
           bacaan seketika sudah benar. Dua bacaan susulan mengambil jurnal
           EA yang datang sesudahnya — angka persis dari broker (dibulatkan
           ke tick size) dan perubahan yang server tidak bisa tebak, seperti
           sisa lot tutup sebagian atau tiket posisi yang baru dibuka.
           Tanpa ini, angka final baru tampil pada putaran 30 detik. */
        if (p.status === 'sukses') {
          segarkanAkunMt5();
          setTimeout(segarkanAkunMt5, 3500);
          setTimeout(segarkanAkunMt5, 10_000);
        }
        return { status: p.status, pesan: String(p.pesan || '') };
      }
    } catch { /* jaringan tersendat — coba lagi */ }
    if (Date.now() - mulai > batasDetik * 1000) {
      return { status: 'menunggu', pesan: 'EA belum melapor — pastikan MT5 terbuka dan AutoTrading menyala.' };
    }
  }
}
