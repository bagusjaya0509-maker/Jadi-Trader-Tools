import { useMemo } from 'react';
import { EventManager, type Event } from '@/components/ui/event-manager';
import type { RingkasAnalisa } from '@/lib/analisa';

/* ════════════════════════════════════════════════════════════════════════
   PERFORMA SIGNAL — kalender & riwayat satu analis
   ════════════════════════════════════════════════════════════════════════
   Isi tab "Performa Signal" di dalam kanal. Satu sinyal = satu peristiwa.

   ── KENAPA HARI PENUTUPAN, BUKAN HARI POSTING ──────────────────────────
   Sinyal ditaruh di tanggal ia SELESAI (kena TP/SL), bukan tanggal ia
   diposting. Dua alasan, dan yang kedua lebih penting:

   1. Uangnya berpindah saat posisi ditutup. Kalender P/L yang menaruh hasil
      di hari posting akan menjawab "berapa hasil hari Senin?" dengan angka
      yang baru terjadi hari Rabu.

   2. Papan peringkat sudah memakai kunci yang sama (`waktuHasil || dibuat`,
      lihat /api/analisa/performa di server). Kalau kalender ini memilih
      kunci lain, satu sinyal yang diposting Senin dan ditutup Selasa akan
      berdiri di kotak Senin sementara papan peringkat menghitungnya di
      Selasa — dua layar bertetangga menyebut hal yang sama dengan dua
      tanggal berbeda. Itu persis jenis selisih yang sudah dua kali harus
      diperbaiki di aplikasi ini.

   Sinyal yang MASIH BERJALAN belum punya hari penutupan, jadi ia berdiri di
   hari postingnya dan sengaja dibiarkan tanpa angka dolar — bukan nol.
   Nol terbaca sebagai "impas", padahal artinya "belum ada hasilnya".

   ── ANGKANYA DARI SERVER ───────────────────────────────────────────────
   `hasilDolar` dihitung server dengan rumus yang SAMA dengan papan
   peringkat, dan hanya terisi untuk sinyal yang sudah selesai. Layar ini
   tidak menghitung ulang apa pun: rumus yang hidup di dua tempat adalah
   rumus yang suatu hari berbeda di dua tempat.
   ════════════════════════════════════════════════════════════════════════ */

/* Warna mengikuti kosakata EventManager, bukan hex bebas — komponennya
   memetakan nama ini ke kelas latarnya sendiri. Hijau untung, merah rugi,
   abu-abu untuk yang belum selesai. Hijau dan merah TIDAK boleh bertukar
   arti di mana pun di aplikasi ini. */
const WARNA = {
  tp: 'green',
  sl: 'red',
  batal: 'orange',
  jalan: 'blue',
} as const;

function tanggalJam(t: number): string {
  return new Date(t).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function lamanya(mulai: number, selesai: number): string {
  const m = Math.max(0, Math.round((selesai - mulai) / 60_000));
  if (m < 60) return `${m} menit`;
  const j = Math.floor(m / 60);
  if (j < 24) return `${j} jam ${m % 60} menit`;
  return `${Math.floor(j / 24)} hari ${j % 24} jam`;
}

/** "+$19,57" / "−$10,00" — tanda selalu ditulis, supaya untung dan rugi
 *  terbaca berbeda bahkan tanpa warnanya. */
function dolar(n: number): string {
  const tanda = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${tanda}$${Math.abs(n).toFixed(2)}`;
}

export function keAcara(sinyal: RingkasAnalisa[]): Event[] {
  return sinyal.map((s): Event => {
    const selesai = s.hasil === 'tp' || s.hasil === 'sl';
    const batal = s.hasil === 'batal';
    const kapan = s.waktuHasil || s.dibuat;
    const d = typeof s.hasilDolar === 'number' ? s.hasilDolar : null;

    /* DUA bentuk, sengaja.

       Yang pendek jadi lencana — ia duduk di sudut kartu dengan lebar
       beberapa puluh piksel, dan "Kena TP" di sana melipat jadi dua baris
       tanpa menambah satu pun keterangan: warnanya sudah mengatakan "kena",
       hurufnya cukup mengatakan "apa".

       Yang panjang tetap dipakai di kalimat keterangan, karena di sana ia
       memang sedang bercerita, bukan melabeli. */
    const keadaan = selesai ? (s.hasil === 'tp' ? 'TP' : 'SL')
                  : batal   ? 'Batal'
                            : 'Jalan';
    const keadaanPanjang = selesai ? (s.hasil === 'tp' ? 'kena TP' : 'kena SL')
                         : batal   ? 'dibatalkan'
                                   : 'masih berjalan';

    /* Judulnya yang terbaca di kotak tanggal, jadi ia harus menjawab dua
       hal dalam satu baris sempit: pasangan apa, dan berapa hasilnya. */
    const judul = d !== null
      ? `${s.pasangan} ${dolar(d)}`
      : `${s.pasangan} · ${batal ? 'batal' : 'jalan'}`;

    const baris = [
      `${s.arah} ${s.pasangan}${s.tf ? ` · ${s.tf}` : ''} — ${keadaanPanjang}`,
      `Diposting ${tanggalJam(s.dibuat)}`,
      s.waktuHasil ? `Ditutup ${tanggalJam(s.waktuHasil)} · berjalan ${lamanya(s.dibuat, s.waktuHasil)}` : '',
      batal && s.alasanBatal ? `Alasan dibatalkan: ${s.alasanBatal}` : '',
      s.ringkas || '',
    ].filter(Boolean);

    return {
      id: s.id,
      title: judul,
      description: baris.join('\n'),
      /* Sesaat: satu titik waktu, bukan rentang. EventManager menuliskan
         jamnya sekali kalau mulai dan selesai berimpit. */
      startTime: new Date(kapan),
      endTime: new Date(kapan),
      color: selesai ? (s.hasil === 'tp' ? WARNA.tp : WARNA.sl) : batal ? WARNA.batal : WARNA.jalan,
      category: keadaan,
      /* SATU tag saja: pasarnya.

         Tanggal posting sempat ikut, dan itu keliru — daftarnya TUMBUH TANPA
         BATAS. Satu tag baru tiap hari analisnya memposting, jadi menu yang
         hari ini enam baris jadi ratusan dalam setahun, dan penyaring yang
         harus digulir untuk menemukan pilihannya berhenti dipakai.

         Arah (BUY/SELL) dan timeframe dicabut juga: keduanya sudah tertulis
         di kalimat keterangan tiap kartu, dan yang bisa dibaca langsung
         tidak perlu jadi penyaring. Pasar tersisa karena ia satu-satunya
         yang membagi daftarnya jadi dua kelompok yang benar-benar berbeda —
         Binance dan MT5 punya jam pasar dan lot yang tidak sama.

         Keduanya tetap bisa DICARI lewat kotak cari; yang dicabut menunya,
         bukan datanya. */
      tags: [s.pasar === 'tradefi' ? 'Trade-Fi' : 'Kripto'],
    };
  });
}

export default function PerformaKalender({ sinyal, onCopy }: {
  sinyal: RingkasAnalisa[];
  /** Tugas tombol "Copy Signal" di kanan atas. Tanpa ini tombolnya mati. */
  onCopy?: () => void;
}) {
  const acara = useMemo(() => keAcara(sinyal), [sinyal]);

  /* Kategori & tag DITURUNKAN dari sinyalnya, bukan didaftar tangan —
     penyaring yang menawarkan pilihan yang tidak ada di data cuma
     menghasilkan layar kosong dan orang mengira ada yang rusak. */
  const kategori = useMemo(
    () => [...new Set(acara.map((a) => a.category).filter(Boolean) as string[])], [acara]);
  /* Diurutkan supaya urutannya tidak berganti tiap kali ada sinyal baru:
     menu yang isinya sama tapi urutannya berbeda memaksa orang membacanya
     ulang tiap kali membuka. */
  const tag = useMemo(
    () => [...new Set(acara.flatMap((a) => a.tags ?? []))].sort(), [acara]);

  return (
    <EventManager
      events={acara}
      categories={kategori}
      availableTags={tag}
      defaultView="month"
      hanyaBaca
      /* Warna DITURUNKAN dari hasil sinyal — hijau TP, merah SL, oranye
         batal, biru masih jalan — dan "Categories" sudah menyaring hasil
         sinyal dengan kata-kata. Dua tombol untuk pekerjaan yang sama
         persis, dan yang satu memakai kosakata yang lebih buruk: "Green"
         tidak memberitahu apa pun, "Kena TP" memberitahu semuanya. */
      sembunyikanFilterWarna
      /* Petunjuk yang MENYEBUT CONTOH, bukan yang menamai kotaknya.
         "Search events..." menerangkan apa kotaknya — hal yang sudah jelas
         dari ikon kacanya — dan diam soal satu-satunya hal yang tidak
         jelas: apa yang sebenarnya bisa diketik ke dalamnya. */
      petunjukCari="Cari sinyal — XAUUSD, BUY, M15, SL…"
      labelTombolBaru="Copy Signal"
      /* HIDUP kalau pemanggilnya memberi tugas. Sebelumnya tombol ini
         dimatikan sampai "sistemnya jadi" — dan itu urutan yang keliru:
         yang perlu ditetapkan orang SEBELUM ikut adalah berapa lot dan
         berapa dolar risikonya, dan keputusan itu justru terdorong ke
         detik-detik terburuk kalau panelnya baru boleh dibuka saat sinyal
         sudah berjalan. */
      tombolBaruMati={!onCopy}
      judulTombolBaru={onCopy
        ? 'Atur lot dan risikomu, lalu ikuti analis ini'
        : 'Copy Signal belum aktif — sistemnya masih dibangun'}
      onTombolBaru={onCopy}
    />
  );
}
