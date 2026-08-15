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

/* KUNCINYA PER AKUN, BUKAN PER PERANGKAT.
   ──────────────────────────────────────────────────────────────────────
   Dulu kuncinya satu untuk seluruh peramban — dan begitu dua akun bergantian
   login di perangkat yang sama, akun kedua mewarisi Backend URL + App Token
   milik akun pertama. Token itu kunci ke uang sungguhan; ia harus mengikuti
   ORANGNYA, bukan mesinnya.

   Simpanan lama (tanpa uid) dipindahkan ke akun pertama yang login setelah
   pembaruan ini, lalu kuncinya dihapus — pemilik simpanan lama hampir pasti
   orang yang sedang memegang perangkatnya. */
const KUNCI_LAMA = 'jt.koneksiBinance';
const kunciUntuk = (uid: string) => `jt.koneksiBinance.${uid}`;
const ACARA = 'jt:koneksi-berubah';

let uidKini: string | null = null;
import('firebase/auth').then(({ onAuthStateChanged }) =>
  import('@/lib/firebase').then(({ auth }) =>
    onAuthStateChanged(auth, (u) => {
      uidKini = u ? u.uid : null;
      if (uidKini) {
        try {
          const lama = window.localStorage.getItem(KUNCI_LAMA);
          if (lama && !window.localStorage.getItem(kunciUntuk(uidKini))) {
            window.localStorage.setItem(kunciUntuk(uidKini), lama);
          }
          if (lama) window.localStorage.removeItem(KUNCI_LAMA);
        } catch { /* privat */ }
      }
      window.dispatchEvent(new CustomEvent(ACARA));
    })
  )
).catch(() => { /* firebase belum siap — status tetap kosong */ });

export interface Koneksi {
  url: string;
  token: string;
}

const KOSONG: Koneksi = { url: '', token: '' };

export function bacaKoneksi(): Koneksi {
  if (typeof window === 'undefined') return KOSONG;
  /* Belum login = tidak ada koneksi. Menampilkan token siapa pun kepada
     layar tanpa pemiliknya adalah kebocoran, bukan kenyamanan. */
  if (!uidKini) return KOSONG;
  try {
    const mentah = window.localStorage.getItem(kunciUntuk(uidKini));
    if (!mentah) return KOSONG;
    const isi = JSON.parse(mentah);
    return { url: String(isi.url ?? ''), token: String(isi.token ?? '') };
  } catch {
    return KOSONG;
  }
}

export function simpanKoneksi(k: Koneksi) {
  try {
    if (uidKini) window.localStorage.setItem(kunciUntuk(uidKini), JSON.stringify(k));
  } catch {
    /* mode privat / kuota penuh — status cukup hidup di memori halaman ini */
  }
  window.dispatchEvent(new CustomEvent(ACARA));
}

export function hapusKoneksi() {
  try {
    if (uidKini) window.localStorage.removeItem(kunciUntuk(uidKini));
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

/* ════════════════════════════════════════════════════════════════════════
   ALAMAT BACKEND BAWAAN — SATU-SATUNYA tempat host ditulis
   ════════════════════════════════════════════════════════════════════════
   Sebelum ini alamat VPS ditulis ulang di 17 berkas. Selama alamatnya tidak
   pernah berubah, itu tidak terasa; begitu pindah ke domain sendiri, satu
   berkas yang terlewat berarti satu fitur yang diam-diam masih memanggil
   alamat lama — dan tidak ada satu pun galat yang menunjuk ke sana, karena
   alamat lamanya memang masih hidup.

   Dibaca dari `VITE_BACKEND` kalau ada, jadi alamat bisa diganti saat build
   tanpa menyentuh kode sama sekali:
     VITE_BACKEND=https://namadomain.com npm run build

   Nilai cadangannya jadi jaditrader.co.id sejak 15 Agu 2026, hari domainnya
   tayang. Sempat dipertimbangkan tetap sslip.io karena alamat itu diturunkan
   dari IP dan tidak pernah kedaluwarsa, sementara domain harus diperpanjang
   tiap tahun — tapi ketahanan itu semu: kalau domainnya mati, situsnya sendiri
   ikut mati, jadi cadangan yang masih hidup tidak menyelamatkan siapa pun.
   Yang nyata adalah biayanya kalau dibiarkan: satu build tanpa env diam-diam
   memanggil alamat lama, dan tidak ada galat yang menunjuk ke sana.
   ════════════════════════════════════════════════════════════════════════ */
export const PROXY_BAWAAN =
  (import.meta.env.VITE_BACKEND as string | undefined)?.replace(/\/+$/, '') ||
  'https://jaditrader.co.id';

/** Alamat backend yang BERLAKU: punya pengguna kalau ia mengisinya sendiri
 *  di Integrations, kalau tidak ya bawaan. */
export function dasarBackend(): string {
  return (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
}
