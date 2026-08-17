import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   AVATAR ANALIS — foto kalau ada, huruf kalau tidak
   ════════════════════════════════════════════════════════════════════════
   Satu komponen untuk podium, daftar peringkat, dan kartu kanal. Sebelumnya
   ketiganya menggambar huruf awal sendiri-sendiri dengan tiga ukuran dan
   tiga cara memilih warna — dan begitu foto masuk, ketiganya harus diajari
   ulang satu per satu.

   ── WARNA HURUF DITURUNKAN DARI UID, BUKAN ACAK ─────────────────────────
   Analis yang sama harus selalu berwarna sama, di halaman mana pun dan
   sesudah berapa kali pun disegarkan. Warna acak membuat mata kehilangan
   satu-satunya petunjuk cepat untuk mengenali orang yang sama di dua
   daftar berbeda — dan itu justru gunanya avatar di papan peringkat.

   Palet sengaja gelap-teredam: avatar bukan isi utama layar, dan enam
   bulatan menyala di satu daftar membuat angkanya sendiri sulit dibaca.

   ── FOTO YANG GAGAL DIMUAT JATUH KE HURUF ───────────────────────────────
   Bukan kemewahan: URL foto menunjuk berkas di VPS, dan berkas bisa hilang
   saat pemulihan atau pembersihan. Tanpa penadah ini yang tampil kotak
   rusak bawaan peramban — yang terbaca sebagai aplikasi yang rusak, bukan
   sebagai foto yang hilang.
   ════════════════════════════════════════════════════════════════════════ */

const PALET = [
  'bg-sky-500/15 text-sky-300',
  'bg-emerald-500/15 text-emerald-300',
  'bg-amber-500/15 text-amber-300',
  'bg-violet-500/15 text-violet-300',
  'bg-rose-500/15 text-rose-300',
  'bg-teal-500/15 text-teal-300',
];

function warnaDari(kunci: string): string {
  let n = 0;
  for (let i = 0; i < kunci.length; i++) n = (n * 31 + kunci.charCodeAt(i)) >>> 0;
  return PALET[n % PALET.length];
}

export function AvatarAnalis({ nama, foto, uid, className, kelasHuruf }: {
  nama: string;
  /** Kosong = anonim, atau memang belum pernah mengunggah. */
  foto?: string;
  /** Dipakai memilih warna. Jatuh ke nama kalau tidak ada — tetap stabil,
   *  cuma berubah kalau orangnya mengganti nama. */
  uid?: string;
  className?: string;
  kelasHuruf?: string;
}) {
  const [gagal, setGagal] = useState(false);
  /* Ditera ulang saat sumbernya berganti: tanpa ini, satu foto yang gagal
     membuat foto BERIKUTNYA di komponen yang sama ikut tidak pernah
     dicoba — daftar yang digulir memakai ulang simpul yang sama. */
  useEffect(() => { setGagal(false); }, [foto]);

  const huruf = (nama || '?').trim()[0]?.toUpperCase() ?? '?';

  if (foto && !gagal) {
    return (
      <img
        src={foto} alt={nama} title={nama}
        onError={() => setGagal(true)}
        /* referrerPolicy: sebagian penyedia foto menolak permintaan dengan
           Referer yang tidak dikenalnya dan membalas 403 — sama seperti
           yang sudah terjadi pada avatar Google di bilah atas. */
        referrerPolicy="no-referrer"
        className={cn('shrink-0 rounded-full object-cover', className ?? 'size-8')}
      />
    );
  }

  return (
    <span title={nama}
      className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold',
        warnaDari(uid || nama || '?'), className ?? 'size-8', kelasHuruf ?? 'text-[12px]')}>
      {huruf}
    </span>
  );
}
