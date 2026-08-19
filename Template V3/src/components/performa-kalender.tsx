import { useMemo } from 'react';
import { EventManager, type Event } from '@/components/ui/event-manager';
import type { RingkasAnalisa } from '@/lib/analisa';
import { cn } from '@/lib/utils';
import { usd } from '@/lib/harga-akses';

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

/* ════════════════════════════════════════════════════════════════════════
   KURVA SALDO SATU ANALIS
   ════════════════════════════════════════════════════════════════════════
   Kalender menjawab "kapan dan berapa". Ini menjawab yang tidak bisa
   dijawab kalender: KE MANA ARAHNYA. Deretan kotak hijau-merah tidak
   memperlihatkan bahwa tujuh menang kecil bisa kalah oleh dua rugi besar —
   kurva memperlihatkannya dalam sekali lihat.

   ── ANGKANYA ESTIMASI, DAN ITU HARUS TERTULIS ──────────────────────────
   Ini BUKAN uang sungguhan siapa pun. Ia hasil satu model: modal awal
   tetap, risiko tetap per sinyal, dan tiap sinyal dianggap diikuti penuh.
   Analisnya mungkin tidak pernah memegang modal sebesar itu, dan yang
   meniru sinyalnya hampir pasti memakai angka lain.

   Model yang sama sudah dipakai papan peringkat, dan angkanya datang dari
   server lewat medan hasilDolar — layar ini tidak menghitung ulang apa pun.

   ── DIGAMBAR TANGAN, BUKAN PAKAI RECHARTS ──────────────────────────────
   Recharts memang sudah ada di proyek ini, tapi ia potongan ±380 kB yang
   sekarang cuma dimuat halaman yang benar-benar memerlukannya. Menariknya
   ke sini akan membebani halaman Copy Signal demi satu garis tanpa sumbu,
   tanpa tooltip, dan tanpa legenda. Yang diperlukan cuma sebuah path.
   ════════════════════════════════════════════════════════════════════════ */
function KurvaSaldo({ sinyal, modal }: { sinyal: RingkasAnalisa[]; modal: number }) {
  const titik = useMemo(() => {
    const selesai = sinyal
      .filter((s) => typeof s.hasilDolar === 'number' && (s.waktuHasil || s.dibuat))
      .sort((a, b) => (a.waktuHasil || a.dibuat) - (b.waktuHasil || b.dibuat));
    let saldo = modal;
    /* Titik pertama modal awal, sebelum sinyal mana pun. Tanpa itu kurvanya
       mulai dari hasil sinyal PERTAMA, dan hasil pertama yang kebetulan
       menang membuat grafiknya seolah tidak pernah di bawah modal. */
    const out = [{ t: selesai.length ? selesai[0].dibuat : Date.now(), v: modal }];
    for (const s of selesai) {
      saldo += s.hasilDolar as number;
      out.push({ t: s.waktuHasil || s.dibuat, v: saldo });
    }
    return out;
  }, [sinyal, modal]);

  if (titik.length < 2) return null;

  const akhir = titik[titik.length - 1].v;
  const naik = akhir >= modal;
  const nilai = titik.map((p) => p.v);

  /* Rentangnya SELALU memuat garis modal. Kalau tidak, akun yang tidak
     pernah menyentuh modal awal menggambar garis modalnya di luar bidang —
     dan pembaca kehilangan satu-satunya patokan yang membuat kurvanya
     berarti. */
  const min = Math.min(...nilai, modal);
  const max = Math.max(...nilai, modal);
  const rentang = max - min || 1;

  const W = 600, H = 120, padA = 8;
  const X = (i: number) => (i / (titik.length - 1)) * W;
  const Y = (v: number) => padA + (1 - (v - min) / rentang) * (H - padA * 2);

  const d = titik.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(p.v).toFixed(1)).join(' ');
  const warna = naik ? '#34d399' : '#f87171';
  const selisih = akhir - modal;
  const persen = modal ? (selisih / modal) * 100 : 0;

  return (
    <div className="mb-4 rounded-xl border border-zinc-800/70 bg-zinc-900/30 p-3.5">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[12.5px] font-medium text-zinc-200">Perkembangan saldo</span>
        <span className={cn('angka text-[15px] font-semibold', naik ? 'text-emerald-400' : 'text-red-400')}>
          {usd(akhir)}
        </span>
        <span className={cn('angka text-[11.5px]', naik ? 'text-emerald-400/80' : 'text-red-400/80')}>
          {selisih >= 0 ? '+' : '−'}{usd(Math.abs(selisih))} · {selisih >= 0 ? '+' : '−'}{Math.abs(persen).toFixed(1)}%
        </span>
        <span className="ml-auto text-[11px] text-zinc-600">
          Estimasi · modal {usd(modal)}, risiko 1% per sinyal
        </span>
      </div>

      <div className="h-[120px] w-full">
        <svg viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none" className="h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="gradSaldoAnalis" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={warna} stopOpacity={0.28} />
              <stop offset="100%" stopColor={warna} stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* Garis modal awal: patokan yang memisahkan untung dari rugi.
              Putus-putus supaya ia terbaca sebagai acuan, bukan sebagai data. */}
          <line x1="0" y1={Y(modal)} x2={W} y2={Y(modal)}
                stroke="#52525b" strokeWidth={1} strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke" />
          <path d={d + ' L' + W + ',' + H + ' L0,' + H + ' Z'} fill="url(#gradSaldoAnalis)" />
          {/* vectorEffect: tanpa ini tebal garisnya ikut melar saat
              preserveAspectRatio="none" meregangkan viewBox ke lebar panel. */}
          <path d={d} fill="none" stroke={warna} strokeWidth={1.8}
                vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
        Dihitung dari {titik.length - 1} sinyal yang sudah selesai, berurutan menurut waktu
        penutupannya. Bukan hasil trading sungguhan — angka ini memakai model yang sama
        dengan papan peringkat, bukan modal atau ukuran posisi analisnya.
      </p>
    </div>
  );
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

export default function PerformaKalender(
  { sinyal, modal = 1000 }: { sinyal: RingkasAnalisa[]; modal?: number },
) {
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
    <>
    {/* Kurva DI ATAS kalender: ia menjawab "layak diikuti atau tidak", dan
        itu pertanyaan yang dibawa orang ke halaman ini. Kalendernya
        menjawab pertanyaan berikutnya — kapan dan berapa. */}
    <KurvaSaldo sinyal={sinyal} modal={modal} />
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
      tombolBaruMati
      judulTombolBaru="Copy Signal belum aktif — sistemnya masih dibangun"
    />
    </>
  );
}
