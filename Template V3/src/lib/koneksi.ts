import { useEffect, useState } from 'react';

/* ════════════════════════════════════════════════════════════════════════
   STATUS SAMBUNGAN BINANCE — satu sumber untuk Screener dan Integrations
   ════════════════════════════════════════════════════════════════════════
   Tombol "Open Real Order" harus tahu apakah VPS dan token sudah dipasang,
   tapi tombol itu ada di halaman lain dari tempat pemasangannya. Menaruh
   pengetahuan itu di localStorage — bukan di state React — membuat keduanya
   sepakat tanpa perlu context provider, dan status bertahan setelah refresh.

   App Token TIDAK PERNAH dikirim ke mana pun selain VPS milik pengguna
   sendiri. Ia disimpan di peramban karena di situlah satu-satunya tempat
   yang tidak melibatkan pihak ketiga; menyimpannya di server kami berarti
   kami memegang kunci akun Binance orang lain.
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI = 'jt.koneksiBinance';
const ACARA = 'jt:koneksi-berubah';

export interface Koneksi {
  url: string;
  token: string;
}

const KOSONG: Koneksi = { url: '', token: '' };

export function bacaKoneksi(): Koneksi {
  if (typeof window === 'undefined') return KOSONG;
  try {
    const mentah = window.localStorage.getItem(KUNCI);
    if (!mentah) return KOSONG;
    const isi = JSON.parse(mentah);
    return { url: String(isi.url ?? ''), token: String(isi.token ?? '') };
  } catch {
    return KOSONG;
  }
}

export function simpanKoneksi(k: Koneksi) {
  try {
    window.localStorage.setItem(KUNCI, JSON.stringify(k));
  } catch {
    /* mode privat / kuota penuh — status cukup hidup di memori halaman ini */
  }
  window.dispatchEvent(new CustomEvent(ACARA));
}

export function hapusKoneksi() {
  try {
    window.localStorage.removeItem(KUNCI);
  } catch { /* abaikan */ }
  window.dispatchEvent(new CustomEvent(ACARA));
}

/** Lengkap = keduanya terisi. URL saja tidak cukup: proxy tanpa token akan
 *  menolak setiap permintaan order dengan 401, dan pesan errornya jauh lebih
 *  membingungkan daripada penolakan di sisi tombol. */
export function koneksiLengkap(k: Koneksi) {
  return k.url.trim().length > 0 && k.token.trim().length > 0;
}

/** Hook yang ikut berubah saat tab lain atau halaman lain menyimpan. */
export function useKoneksi() {
  const [k, setK] = useState<Koneksi>(bacaKoneksi);

  useEffect(() => {
    const segarkan = () => setK(bacaKoneksi());
    window.addEventListener(ACARA, segarkan);
    window.addEventListener('storage', segarkan);
    return () => {
      window.removeEventListener(ACARA, segarkan);
      window.removeEventListener('storage', segarkan);
    };
  }, []);

  return { koneksi: k, siap: koneksiLengkap(k) };
}
