/* ═══════════════════════════════════════════════════════════════════════
   kurs-kas.ts — kurs pasar untuk mengubah pengeluaran mata uang asing
   ═══════════════════════════════════════════════════════════════════════
   Diminta pemilik 9 Sep 2026: "400 dollar" harus otomatis jadi rupiah.

   Kursnya diambil dari VPS (`/api/kas/kurs`), bukan langsung dari penyedia
   kurs. Dua alasan: kunci dan kuota penyedia tidak perlu ikut ke peramban,
   dan bot Telegram memakai sumber yang SAMA — kalau peramban punya
   sumbernya sendiri, pesan yang sama bisa tercatat dengan dua angka berbeda
   tergantung ditulis di mana.

   ── BEDANYA DENGAN `kurs.ts` ──────────────────────────────────────────
   `kurs.ts` sengaja memakai kurs ISIAN TANGAN, dan alasannya benar: laporan
   keuangan yang angkanya berubah sendiri tiap hari tidak bisa dibandingkan
   antar bulan. Berkas ini TIDAK melanggar keputusan itu. Kurs di sini cuma
   dipakai SEKALI, pada detik pengeluarannya dicatat; hasil rupiahnya
   disimpan permanen bersama kurs yang dipakai. Catatan "39 USD" kemarin
   tidak akan pernah berubah nilainya besok. Yang satu mengubah cara
   MEMBACA angka lama, yang ini menetapkan angka baru sekali lalu diam.

   Disimpan 12 jam di peramban. Kurs harian tidak berubah secepat itu, dan
   memuat ulang halaman tidak seharusnya jadi satu permintaan jaringan lagi.
   Kalau semuanya gagal, KURS_CADANGAN di urai-kas.ts yang dipakai — angka
   lama dengan keterangan jujur lebih baik daripada catatan yang batal
   tersimpan.
   ═══════════════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';
import { KURS_CADANGAN, type PetaKurs } from '@/lib/urai-kas';

const KUNCI = 'jt.kurs';
const UMUR = 12 * 60 * 60 * 1000;

export interface Kurs {
  peta: PetaKurs;
  /** true kalau yang dipakai tabel cadangan, bukan kurs hidup. */
  perkiraan: boolean;
  waktu: number;
}

const AWAL: Kurs = { peta: KURS_CADANGAN, perkiraan: true, waktu: 0 };

function bacaSimpanan(): Kurs | null {
  try {
    const m = JSON.parse(localStorage.getItem(KUNCI) || 'null');
    if (!m || !m.peta || typeof m.waktu !== 'number') return null;
    if (Date.now() - m.waktu > UMUR) return null;
    return { peta: { ...KURS_CADANGAN, ...m.peta }, perkiraan: false, waktu: m.waktu };
  } catch { return null; }
}

/* Satu permintaan untuk seluruh halaman, berapa pun komponen yang memakainya. */
let sedangAmbil: Promise<Kurs> | null = null;

async function ambil(): Promise<Kurs> {
  const dasar = (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
  const r = await fetch(`${dasar}/api/kas/kurs`);
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json();
  if (!j || !j.kurs || !Object.keys(j.kurs).length) throw new Error('kosong');
  const hasil: Kurs = { peta: { ...KURS_CADANGAN, ...j.kurs }, perkiraan: !!j.perkiraan, waktu: Date.now() };
  try { localStorage.setItem(KUNCI, JSON.stringify({ peta: j.kurs, waktu: hasil.waktu })); } catch { /* mode privat */ }
  return hasil;
}

export function useKurs(): Kurs {
  const [kurs, setKurs] = useState<Kurs>(() => bacaSimpanan() || AWAL);
  useEffect(() => {
    if (bacaSimpanan()) return;
    let hidup = true;
    if (!sedangAmbil) sedangAmbil = ambil().finally(() => { sedangAmbil = null; });
    sedangAmbil.then((k) => { if (hidup) setKurs(k); }).catch(() => { /* cadangan tetap dipakai */ });
    return () => { hidup = false; };
  }, []);
  return kurs;
}
