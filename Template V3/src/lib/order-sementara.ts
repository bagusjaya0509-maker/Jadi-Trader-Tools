import { useEffect, useState } from 'react';

/* ════════════════════════════════════════════════════════════════════════
   ORDER SEMENTARA — jembatan tiga detik antara "Kirim" dan bursa
   ════════════════════════════════════════════════════════════════════════
   Setelah tombol Kirim ditekan, order butuh beberapa detik untuk sampai ke
   Binance, dan tabel Posisi Terbuka baru menampilkannya pada putaran baca
   berikutnya. Selama jeda itu layar tidak menunjukkan apa pun — dan yang
   dirasakan orangnya bukan "sedang menunggu", melainkan "ordernya gagal".

   Bahayanya bukan rasa panik itu sendiri: orang yang mengira ordernya gagal
   MEMESAN LAGI. Dua order untuk satu niat adalah kerugian yang lahir dari
   layar, bukan dari pasar.

   ── TIGA ATURAN YANG MENJAGA INI TETAP JUJUR ────────────────────────────

   1. BARIS SEMENTARA TIDAK PERNAH MENYAMAR JADI ORDER SUNGGUHAN.
      Ia selalu membawa statusnya sendiri — "Mengirim…", "Terkirim", atau
      "Gagal" — dan ditaruh terpisah dari daftar yang datang dari bursa.
      Menampilkan order yang belum tentu ada seolah sudah ada adalah
      kebohongan yang jauh lebih mahal daripada jeda tiga detik.

   2. IA SELALU MATI SENDIRI. Begitu bursa melaporkan order/posisi yang
      cocok, baris ini disapu — kalau tidak, satu order akan terlihat dua
      kali. Dan kalaupun bursa tidak pernah menyebutnya, ia tetap hilang
      setelah `UMUR_MAKS_MS`. Tidak ada keadaan di mana baris hantu
      bertahan di layar.

   3. GAGAL TETAP TERLIHAT SEBENTAR. Order yang ditolak tidak boleh lenyap
      diam-diam seolah tidak pernah dikirim; ia bertahan beberapa detik
      dengan alasannya, lalu pergi.

   Disimpan di modul, bukan di context React: yang menulis ada di lib
   (order-nyata.ts, di luar pohon komponen) sementara yang membaca ada di
   panel. Satu penyimpan kecil dengan langganan menyelesaikan itu tanpa
   menyeret provider baru melintasi seluruh aplikasi.
   ════════════════════════════════════════════════════════════════════════ */

export type StatusSementara = 'mengirim' | 'terkirim' | 'gagal';

export interface OrderSementara {
  /** Id lokal — bukan id bursa. Bursa belum tentu punya ordernya. */
  id: string;
  simbol: string;
  arah: 'BUY' | 'SELL';
  /** "Market" / "Limit" / "Stop" — untuk baris keterangan. */
  jenis: string;
  harga: number;
  qty: number;
  sl: number;
  tp: number;
  /** MARKET jadi POSISI, LIMIT/STOP jadi PENDING. Menentukan daftar mana
   *  yang dipakai memeriksa apakah bursa sudah mencatatnya. */
  menjadi: 'posisi' | 'pending';
  status: StatusSementara;
  pesan?: string;
  waktu: number;
}

/** Batas hidup baris sementara. Lewat ini ia dibuang apa pun statusnya —
 *  bursa yang tidak kunjung menyebutkan sebuah order berarti kita memang
 *  tidak tahu, dan menampilkannya terus adalah menebak. */
const UMUR_MAKS_MS = 30_000;
/** Baris gagal bertahan lebih pendek: pesannya sudah terbaca, dan ia tidak
 *  mewakili apa pun yang hidup di bursa. */
const UMUR_GAGAL_MS = 8_000;

let daftar: OrderSementara[] = [];
const pendengar = new Set<() => void>();

function siarkan() {
  daftar = [...daftar];
  pendengar.forEach((f) => f());
}

function buang(id: string) {
  daftar = daftar.filter((o) => o.id !== id);
  pendengar.forEach((f) => f());
}

/** Catat order yang BARU SAJA dikirim. Dipanggil sesudah orangnya menekan
 *  setuju di kotak konfirmasi, sebelum permintaan berangkat. */
export function mulaiKirim(o: Omit<OrderSementara, 'id' | 'status' | 'waktu'>): string {
  const id = 'smt-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  daftar = [{ ...o, id, status: 'mengirim', waktu: Date.now() }, ...daftar];
  siarkan();
  setTimeout(() => buang(id), UMUR_MAKS_MS);
  return id;
}

export function tandaiTerkirim(id: string) {
  daftar = daftar.map((o) => (o.id === id ? { ...o, status: 'terkirim' as const } : o));
  siarkan();
}

export function tandaiGagal(id: string, pesan: string) {
  daftar = daftar.map((o) => (o.id === id ? { ...o, status: 'gagal' as const, pesan } : o));
  siarkan();
  setTimeout(() => buang(id), UMUR_GAGAL_MS);
}

/** Sapu baris yang sudah diwakili data bursa.
 *
 *  Dicocokkan dengan simbol + arah, bukan dengan id: id bursa baru lahir
 *  SESUDAH order diterima, jadi baris sementara tidak pernah memilikinya.
 *  Konsekuensinya diterima dengan sadar — dua order berturut-turut pada
 *  simbol dan arah yang sama akan membuat baris sementara kedua ikut
 *  tersapu lebih awal. Yang hilang cuma keterangan sementaranya; ordernya
 *  sendiri tetap tampil dari daftar bursa. Kesalahan ke arah "terlalu
 *  cepat menghilang" jauh lebih aman daripada baris hantu yang menetap. */
export function sapuYangSudahAda(
  posisi: { simbol: string }[],
  pending: { simbol: string; arah: string }[],
) {
  const sebelum = daftar.length;
  daftar = daftar.filter((o) => {
    if (o.status !== 'terkirim') return true;   // masih dikirim / gagal: biarkan
    return o.menjadi === 'posisi'
      ? !posisi.some((p) => p.simbol === o.simbol)
      : !pending.some((p) => p.simbol === o.simbol && p.arah === o.arah);
  });
  if (daftar.length !== sebelum) pendengar.forEach((f) => f());
}

/** Isi daftar saat ini, di luar React. Dipakai kode yang perlu tahu apakah
 *  masih ada order yang belum terkonfirmasi — dan membuat perilaku modul
 *  ini bisa diperiksa tanpa merender komponen. */
export function daftarSekarang(): OrderSementara[] {
  return daftar;
}

export function useOrderSementara(): OrderSementara[] {
  const [, paksa] = useState(0);
  useEffect(() => {
    const f = () => paksa((n) => n + 1);
    pendengar.add(f);
    return () => { pendengar.delete(f); };
  }, []);
  return daftar;
}
