import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play, Pause, SkipForward, RotateCcw, X, Save, Loader2, Trash2,
} from 'lucide-react';
import { Panel, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen, harga as fHarga, tanggalPendek } from '@/lib/utils';
import type { Lilin } from '@/lib/pasar';
import {
  KECEPATAN, usulSlTp, periksaKena, hitungPnl, ringkasReplay,
  bacaSesi, simpanSesi, hapusSesi,
  type PosisiReplay, type TradeReplay,
} from '@/lib/replay';
import { simpanTrade } from '@/lib/tulis-jurnal';
import type { GarisHarga } from '@/components/chart-lilin';

export type JenisEntry = 'MARKET' | 'LIMIT' | 'STOP';

export interface AksiOrder {
  posisi: { arah: 'BUY' | 'SELL'; masuk: number; sl: number; tp: number; pnl: number; risiko: number; unit: number } | null;
  /** Order demo yang MENGGANTUNG menunggu harga menyentuh entry-nya. */
  tunda: { arah: 'BUY' | 'SELL'; jenis: JenisEntry; entry: number; sl: number; tp: number } | null;
  batalTunda: () => void;
  /** Risiko dolar menurut setelan modal & % risiko saat ini — dipakai label
   *  garis SL/TP untuk menyebut berapa uang yang dipertaruhkan. */
  risiko: number;
  hargaKini?: number;
  /** Level USULAN untuk arah tertentu — dipakai saat tiket baru dibuka.
   *  Sekadar titik awal: yang berlaku adalah angka setelah digeser. */
  usul: (arah: 'BUY' | 'SELL') => { entry: number; sl: number; tp: number } | null;
  /** Kirim order dengan level yang SUDAH ditetapkan orangnya. Jenis selain
   *  MARKET menggantung sampai harganya tersentuh — persis pending order. */
  kirim: (arah: 'BUY' | 'SELL', level: { entry: number; sl: number; tp: number }, jenis: JenisEntry) => void;
  tutup: () => void;
  mati: boolean;
  mode: 'demo' | 'real';
  gantiMode: (m: 'demo' | 'real') => void;
}

/* ════════════════════════════════════════════════════════════════════════
   PANEL REPLAY
   ════════════════════════════════════════════════════════════════════════
   Kendali putar-ulang dan eksekusi manual. Seluruh keadaannya diangkat ke
   sini, dan halaman Chart cuma menerima `idx` untuk memotong grafiknya —
   pemisahan itu membuat chart tidak perlu tahu apa pun tentang posisi,
   dan panel ini tidak perlu tahu apa pun tentang cara menggambar.
   ════════════════════════════════════════════════════════════════════════ */

export function PanelReplay({ lilin, simbol, tf, idx, setIdx, aturGaris, aturAksi, aturKendali, aturMulai, demoSetelan, usulSl, usulTp, tanpaBingkai = false, tampil = true }: {
  lilin: Lilin;
  simbol: string;
  tf: string;
  idx: number | null;
  setIdx: (n: number | null) => void;
  aturGaris: (g: GarisHarga[]) => void;
  /* Aksi BUY/SELL diangkat ke halaman supaya tombolnya bisa dipasang di
     POJOK CHART. Saat mengambil keputusan mata sedang di grafik, dan
     memindahkan pandangan ke bawah layar adalah tempat paling sering orang
     salah tekan arah. */
  aturAksi?: (a: AksiOrder | null) => void;
  /* SL & TP usulan dari kartu screener — mengisi kotak sekali, saat pertama
     kali halaman dibuka dari sana. */
  usulSl?: number;
  usulTp?: number;
  /* Dipakai saat panel ini berada DI DALAM panel grafik: tanpa border dan
     tanpa margin sendiri, karena pembungkusnya sudah menyediakan keduanya. */
  tanpaBingkai?: boolean;
  /* Kendali putar dikirim ke halaman untuk ditumpangkan DI ATAS grafik. */
  aturKendali?: (k: React.ReactNode | null) => void;
  /* Tombol Replay di bilah atas memanggil ini. Dulu ia cuma membuka panel
     berisi tombol "Mulai Replay" — dua tekanan untuk satu maksud, dan yang
     pertama tidak menghasilkan apa pun selain panel. */
  aturMulai?: (f: (() => void) | null) => void;
  /** Modal, % risiko, dan usulan SL/RR — diedit dari tiket pojok chart. */
  demoSetelan: { modal: number; risikoPersen: number; kaliAtr: number; rr: number };
  /* false = komponennya tetap TERPASANG tapi tidak menggambar apa pun.
     Dipasang terus supaya tombol BUY/SELL di pojok chart tersedia sejak
     halaman dibuka — menyembunyikannya sampai tombol Replay ditekan berarti
     dua perbuatan untuk satu maksud. */
  tampil?: boolean;
}) {
  const [main, setMain] = useState(false);
  const [cepat, setCepat] = useState(4);
  /* Setelan demo hidup di HALAMAN, bukan di sini — tiket pojok yang
     mengeditnya, dan panel ini tinggal memakainya. Dua salinan setelan
     untuk satu order adalah cara pasti membuat keduanya berselisih. */
  const { modal, risikoPersen, kaliAtr, rr } = demoSetelan;

  const [posisi, setPosisi] = useState<PosisiReplay | null>(null);
  /* Pending order demo: satu saja pada satu waktu, sama seperti posisinya. */
  const [tunda, setTunda] = useState<{ arah: 'BUY' | 'SELL'; jenis: JenisEntry; entry: number; sl: number; tp: number } | null>(null);
  const [trade, setTrade] = useState<TradeReplay[]>([]);
  const [pesan, setPesan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  /* 'demo' = latihan di atas bar replay. 'real' = order sungguhan ke Binance
     lewat VPS sendiri. Dipisah tegas, dan bawaannya demo — halaman latihan
     yang diam-diam bisa mengirim uang sungguhan adalah rancangan yang salah. */
  const [mode, setMode] = useState<'demo' | 'real'>('demo');

  /* ── Pulihkan sesi ──────────────────────────────────────────────────
     Dijalankan saat simbol/timeframe berganti, bukan sekali di awal:
     tiap pasangan simbol+TF punya sesinya sendiri, dan berpindah ke BTC 4
     jam harus memunculkan posisi BTC 4 jam, bukan sisa dari ETH 5 menit. */
  const dimuat = useRef('');
  useEffect(() => {
    const kunci = `${simbol}|${tf}`;
    if (dimuat.current === kunci) return;
    dimuat.current = kunci;
    const s = bacaSesi(simbol, tf);
    setPosisi(s?.posisi ?? null);
    setTrade(s?.trade ?? []);
    setMain(false);
    if (s?.idx != null) setIdx(s.idx);
  }, [simbol, tf, setIdx]);

  /* Simpan tiap kali ada yang berubah. Sesi replay kecil (puluhan baris),
     jadi menulisnya utuh lebih sederhana dan lebih aman daripada menambal
     sebagian — dan tidak ada jalur yang bisa lupa ikut menyimpan. */
  useEffect(() => {
    if (dimuat.current !== `${simbol}|${tf}`) return;
    simpanSesi(simbol, tf, { idx, posisi, trade, modal });
  }, [simbol, tf, idx, posisi, trade, modal]);

  const ringkas = ringkasReplay(trade, modal);
  const hidup = idx !== null;

  /* ── Jalan otomatis ─────────────────────────────────────────────────
     Interval, bukan requestAnimationFrame: yang diinginkan adalah satu bar
     per satuan waktu yang bisa diprediksi, bukan sehalus mungkin. */
  useEffect(() => {
    if (!main || idx === null) return;
    const ms = KECEPATAN.find((k) => k.x === cepat)?.ms ?? 250;
    const jam = setInterval(() => {
      setIdx(idx + 1 >= lilin.closes.length ? lilin.closes.length - 1 : idx + 1);
      if (idx + 1 >= lilin.closes.length - 1) setMain(false);
    }, ms);
    return () => clearInterval(jam);
  }, [main, cepat, idx, lilin.closes.length, setIdx]);

  /* ── Periksa SL/TP tiap bar maju ────────────────────────────────────
     Dijalankan sebagai efek pada perubahan `idx`, bukan di dalam pemutar:
     dengan begitu melangkah manual dan melompat lewat klik pun ikut
     diperiksa, bukan cuma saat diputar otomatis. */
  useEffect(() => {
    if (!posisi || idx === null) return;
    const kena = periksaKena(posisi, lilin, idx);
    if (!kena) return;
    const pnl = hitungPnl(posisi, kena.harga);
    setTrade((d) => [...d, {
      ...posisi, no: d.length + 1,
      keluarIdx: idx, keluar: kena.harga, sebab: kena.kena, pnl,
      masukWaktu: lilin.times[posisi.masukIdx], keluarWaktu: lilin.times[idx],
    }]);
    setPosisi(null);
    setPesan(`${kena.kena} kena di ${fHarga(kena.harga)} — ${uang(pnl, true)}`);
  }, [idx, posisi, lilin]);

  /* Bar aktif: bar replay kalau sedang berjalan, bar TERAKHIR kalau tidak —
     dipakai pending, aksi, dan pembuka posisi supaya ketiganya sepakat. */
  const idxAktif = idx ?? Math.max(0, lilin.closes.length - 1);
  const hargaAktif = lilin.closes[idxAktif];

  /* ── Pending order diperiksa tiap bar maju ─────────────────────────
     BUY STOP terpicu saat high menyentuh entry (menembus ke atas), BUY
     LIMIT saat low menyentuhnya (turun dulu baru diambil) — dan kebalikan
     persisnya untuk SELL. Terisi di harga ENTRY, bukan di close bar: itulah
     harga yang diminta ordernya. */
  useEffect(() => {
    if (!tunda || posisi || !lilin.closes.length) return;
    const i = idxAktif;
    const kena = tunda.arah === 'BUY'
      ? (tunda.jenis === 'STOP' ? lilin.highs[i] >= tunda.entry : lilin.lows[i] <= tunda.entry)
      : (tunda.jenis === 'STOP' ? lilin.lows[i] <= tunda.entry : lilin.highs[i] >= tunda.entry);
    if (!kena) return;
    const risiko = (modal + ringkas.bersih) * (risikoPersen / 100);
    const unit = risiko / Math.abs(tunda.entry - tunda.sl);
    setPosisi({ id: 'p' + Date.now(), arah: tunda.arah, masukIdx: i, masuk: tunda.entry, sl: tunda.sl, tp: tunda.tp, unit, risiko });
    setTunda(null);
    setPesan(`${tunda.jenis === 'STOP' ? 'Stop' : 'Limit'} terisi — ${tunda.arah} di ${fHarga(tunda.entry)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idxAktif, tunda, posisi, lilin]);

  /* Aksi dikirim ke halaman tiap kali keadaannya berubah. */
  /* Tombol BUY/SELL SELALU tersedia, bahkan sebelum replay dimulai.
     ────────────────────────────────────────────────────────────────────
     Menyembunyikannya sampai tombol replay ditekan berarti dua perbuatan
     untuk satu maksud, dan yang kedua tidak menambah apa pun: entry di harga
     terakhir sama sahnya dengan entry di bar replay. Kalau replay belum
     jalan, posisinya dibuka di bar TERAKHIR — dan itu memang keadaan pasar
     yang sedang berlangsung.

     Mode `real` tidak mengirim aksi: order sungguhan punya kotaknya sendiri
     dengan konfirmasi yang menyebut angka, dan tombol satu-klik di pojok
     chart bukan tempat untuk uang sungguhan. */

  useEffect(() => {
    if (!aturAksi) return;
    if (!lilin.closes.length) { aturAksi(null); return; }
    aturAksi({
      posisi: mode === 'demo' && posisi
        ? { arah: posisi.arah, masuk: posisi.masuk, sl: posisi.sl, tp: posisi.tp,
            pnl: hargaAktif === undefined ? 0 : hitungPnl(posisi, hargaAktif),
            risiko: posisi.risiko, unit: posisi.unit }
        : null,
      tunda: mode === 'demo' ? tunda : null,
      batalTunda: () => { setTunda(null); setPesan('Pending order dibatalkan.'); },
      risiko: (modal + ringkas.bersih) * (risikoPersen / 100),
      hargaKini: hargaAktif,
      usul, kirim: buka, tutup: tutupManual, mati: false,
      mode, gantiMode: setMode,
    });
    return () => aturAksi(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, idx, posisi, tunda, hargaAktif, lilin.closes.length, aturAksi, kaliAtr, rr, usulSl, usulTp, modal, risikoPersen, ringkas.bersih]);

  /* Garis entry/SL/TP dikirim ke chart. */
  useEffect(() => {
    aturGaris(posisi ? [
      { harga: posisi.masuk, warna: '#a1a1aa', label: 'Entry' },
      { harga: posisi.sl, warna: '#f87171', label: 'SL' },
      { harga: posisi.tp, warna: '#10b981', label: 'TP' },
    ] : []);
  }, [posisi, aturGaris]);

  /* Mulai di 60% data: cukup bar di belakang untuk indikator matang, dan
     masih menyisakan 40% untuk dijalankan.

     Trade yang sudah tercatat TIDAK dihapus di sini. Memulai ulang putarannya
     bukan alasan untuk membuang catatan latihan — itu perbuatan terpisah,
     dan tombolnya ada sendiri. */
  const mulai = useCallback(() => {
    setIdx(Math.floor(lilin.closes.length * 0.6));
    setPosisi(null); setPesan(''); setMain(false);
  }, [lilin.closes.length, setIdx]);

  function bersihkan() {
    if (!confirm(`Hapus ${trade.length} catatan latihan untuk ${simbol} ${tf}?\n\nPosisi yang sedang terbuka ikut dibatalkan.`)) return;
    setTrade([]); setPosisi(null); setPesan('Catatan latihan dihapus.');
    hapusSesi(simbol, tf);
  }

  /* Keluar TIDAK membatalkan posisi. Menutup panelnya bukan pernyataan
     bahwa posisinya ditutup — posisi tetap terbuka dan menunggu, persis
     seperti kalau kamu menutup tab. */
  const keluar = useCallback(() => {
    setIdx(null); setMain(false); aturGaris([]);
  }, [setIdx, aturGaris]);

  /* Usulan level saat tiket dibuka — TITIK AWAL, bukan keputusan.
     ──────────────────────────────────────────────────────────────────────
     Level dari kartu screener dipakai kalau ada DAN masih masuk akal untuk
     arah yang dipilih: SL di atas harga untuk BUY berarti kartunya untuk
     arah sebaliknya, dan memakainya akan mengusulkan posisi yang langsung
     salah. Kalau tidak dipakai, jatuh ke usulan ATR. */
  function usul(arah: 'BUY' | 'SELL') {
    if (!lilin.closes.length) return null;
    const h = lilin.closes[idxAktif];
    const sahUsul = usulSl && usulTp
      && (arah === 'BUY' ? usulSl < h && usulTp > h : usulSl > h && usulTp < h);
    const dariAtr = usulSlTp(lilin, idxAktif, arah, kaliAtr, rr);
    const sl = sahUsul ? usulSl! : dariAtr.sl;
    const tp = sahUsul ? usulTp! : dariAtr.tp;
    if (!sl || !tp) return { entry: h, sl: 0, tp: 0 };
    return { entry: h, sl, tp };
  }

  /* Order berangkat dengan level yang SUDAH ditetapkan di tiket — termasuk
     hasil menggeser garisnya di chart. Menghitung ulang SL di sini akan
     membuang keputusan yang baru saja diambil orangnya. */
  function buka(arah: 'BUY' | 'SELL', level: { entry: number; sl: number; tp: number }, jenis: JenisEntry = 'MARKET') {
    if (posisi || !lilin.closes.length) return;
    const { entry, sl, tp } = level;
    if (!entry || !sl || !tp) { setPesan('Entry, SL, dan TP harus terisi.'); return; }
    if (jenis !== 'MARKET') {
      /* Entry jauh dari pasar = order MENGGANTUNG. Posisinya baru lahir saat
         harga benar-benar menyentuh entry — membukanya sekarang di harga
         pasar berarti mengeksekusi order yang tidak pernah diminta. */
      setTunda({ arah, jenis, entry, sl, tp });
      setPesan(`${arah} ${jenis === 'STOP' ? 'Stop' : 'Limit'} dipasang di ${fHarga(entry)} — menunggu harga menyentuhnya.`);
      return;
    }
    const risiko = (modal + ringkas.bersih) * (risikoPersen / 100);
    const unit = risiko / Math.abs(entry - sl);
    setPosisi({ id: 'p' + Date.now(), arah, masukIdx: idxAktif, masuk: entry, sl, tp, unit, risiko });
    setPesan(`${arah} di ${fHarga(entry)} · SL ${fHarga(sl)} · TP ${fHarga(tp)} · risiko ${uang(risiko)}`);
  }

  function tutupManual() {
    if (!posisi || !lilin.closes.length) return;
    const h = lilin.closes[idxAktif];
    const pnl = hitungPnl(posisi, h);
    setTrade((d) => [...d, {
      ...posisi, no: d.length + 1,
      keluarIdx: idxAktif, keluar: h, sebab: 'Manual', pnl,
      masukWaktu: lilin.times[posisi.masukIdx], keluarWaktu: lilin.times[idxAktif],
    }]);
    setPosisi(null);
    setPesan(`Ditutup manual di ${fHarga(h)} — ${uang(pnl, true)}`);
  }

  /* ── Simpan hasil latihan ke jurnal ─────────────────────────────────
     Ditandai "Latihan replay" pada alasannya. Kalau tidak ditandai, hasil
     latihan bercampur dengan transaksi sungguhan di statistik jurnal — dan
     winrate yang dipakai menilai diri sendiri jadi tidak berarti apa-apa. */
  async function simpanKeJurnal() {
    if (!trade.length) return;
    setMenyimpan(true); setPesan('');
    try {
      for (const t of trade) {
        await simpanTrade({
          sumber: 'kripto', pair: simbol, arah: t.arah,
          lot: Number(t.unit.toFixed(6)),
          masukHarga: t.masuk, keluarHarga: t.keluar, pnl: t.pnl,
          waktu: t.keluarWaktu,
          emosiMasuk: 'Netral', emosiEvaluasi: 'Netral',
          alasan: `Latihan replay · keluar ${t.sebab}`,
          catatan: `Replay ${simbol} — bukan transaksi sungguhan.`,
        });
      }
      setPesan(`${trade.length} transaksi latihan tersimpan ke jurnal, bertanda "Latihan replay".`);
    } catch (e) {
      setPesan('Gagal menyimpan: ' + (e instanceof Error ? e.message : 'tidak diketahui'));
    } finally { setMenyimpan(false); }
  }

  const majuSatu = () => idx !== null && setIdx(Math.min(lilin.closes.length - 1, idx + 1));

  /* Spasi = main/jeda, panah kanan = maju satu bar. Kebiasaan yang sama
     dengan pemutar mana pun; tanpa itu latihan jadi urusan mouse. */
  const refMain = useRef(main);
  refMain.current = main;
  useEffect(() => {
    if (!hidup) return;
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); setMain(!refMain.current); }
      if (e.code === 'ArrowRight') { e.preventDefault(); majuSatu(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  /* Kendali putar dikirim ke halaman untuk ditumpangkan DI ATAS grafik.
     Latarnya tembus supaya menyatu — panel terpisah di bawah chart memaksa
     mata bolak-balik antara grafik dan tombol untuk satu perbuatan yang
     sama. */
  const kendali = idx === null ? null : (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setMain(!main)}
          className="flex size-8 cursor-pointer items-center justify-center rounded-md bg-zinc-100 text-zinc-950 transition-colors hover:bg-white">
          {main ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button onClick={majuSatu} title="Maju satu bar (→)"
          className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-zinc-700/70 bg-zinc-900/70 text-zinc-300 transition-colors hover:border-zinc-600">
          <SkipForward className="size-4" />
        </button>
        <button onClick={mulai} title="Ulang dari awal"
          className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-zinc-700/70 bg-zinc-900/70 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200">
          <RotateCcw className="size-4" />
        </button>
        <div className="flex overflow-hidden rounded-md border border-zinc-700/70 bg-zinc-900/70">
          {KECEPATAN.map((k) => (
            <button key={k.x} onClick={() => setCepat(k.x)}
              className={cn('cursor-pointer px-2 py-1.5 text-[11.5px] transition-colors',
                cepat === k.x ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200')}>
              {k.x}×
            </button>
          ))}
        </div>
        <span className="angka rounded bg-zinc-900/70 px-2 py-1 text-[11px] text-zinc-400">
          bar {idx + 1}/{lilin.closes.length} · {tanggalPendek(lilin.times[idx])}
        </span>
        <button onClick={keluar} title="Keluar dari replay"
          className="ml-auto flex cursor-pointer items-center gap-1 rounded-md border border-zinc-700/70 bg-zinc-900/70 px-2 py-1.5 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200">
          <X className="size-3.5" /> Keluar
        </button>
      </div>

      {/* Bilah kemajuan — juga berfungsi sebagai penggeser */}
      <input type="range" min={20} max={lilin.closes.length - 1} value={idx}
             onChange={(e) => setIdx(Number(e.target.value))}
             aria-label="Posisi replay"
             className="mt-2 w-full cursor-pointer accent-zinc-200" />
    </div>
  );

  /* Dikirim ulang HANYA saat isinya benar-benar berubah.
     ──────────────────────────────────────────────────────────────────────
     Efek ini dulu tanpa daftar dependensi sama sekali, jadi ia jalan tiap
     render dan memanggil `aturKendali` dengan simpul JSX yang selalu baru.
     Simpul baru = state halaman berubah = halaman menggambar ulang = panel
     ini menggambar ulang = efeknya jalan lagi. Gelung tanpa ujung, dan React
     menghentikannya dengan "Maximum update depth exceeded".

     Tandanya berisi SEMUA nilai yang dibaca `kendali`. Kalau ada yang
     tertinggal, tombolnya akan memakai nilai basi — jadi daftar ini harus
     ikut diperbarui setiap kali isinya bertambah. */
  const tandaKendali = `${idx}|${main}|${cepat}|${lilin.closes.length}|${lilin.times[idx ?? 0] ?? 0}`;
  useEffect(() => {
    aturKendali?.(kendali);
    return () => aturKendali?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tandaKendali, aturKendali]);

  useEffect(() => {
    aturMulai?.(mulai);
    return () => aturMulai?.(null);
  }, [aturMulai, mulai]);

  const Bungkus = ({ anak, kelas }: { anak: React.ReactNode; kelas?: string }) =>
    tanpaBingkai ? <div>{anak}</div> : <Panel className={kelas}>{anak}</Panel>;

  /* Keadaan DIAM tidak menggambar apa pun.
     ──────────────────────────────────────────────────────────────────────
     Dulu di sini ada panel berisi tombol "Mulai Replay". Panel itu adalah
     langkah kosong: tombol Replay di bilah atas sudah menyatakan maksudnya,
     dan panel yang muncul hanya untuk menanyakan hal yang sama sekali lagi
     mendorong grafiknya ke atas layar tanpa menambah apa pun. */
  if (!tampil || !hidup) return null;
  /* Setelannya sudah pindah ke tiket pojok. Panel bawah tinggal punya satu
     alasan hidup: pesan terakhir dan catatan latihan — kalau dua-duanya
     kosong, tidak ada yang perlu digambar. */
  if (!pesan && trade.length === 0) return null;

  return (
    <Bungkus kelas="mt-4 border-emerald-500/25" anak={<>
      {pesan && <div className="px-5 py-3 text-[12px] text-zinc-400">{pesan}</div>}

      {/* Hasil latihan */}
      {trade.length > 0 && (
        <div className="border-t border-zinc-800/80 px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-4 text-[12.5px]">
            <span className="text-zinc-500">Trade <span className="angka text-zinc-200">{ringkas.jumlah}</span></span>
            <span className="text-zinc-500">Winrate <span className="angka text-zinc-200">{persen(ringkas.winrate)}</span></span>
            <span className="text-zinc-500">P/L{' '}
              <span className={cn('angka', ringkas.bersih >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {uang(ringkas.bersih, true)}
              </span>
            </span>
            <span className="text-zinc-500">Ekuitas <span className="angka text-zinc-200">{uang(ringkas.ekuitas)}</span></span>
            <span className="text-zinc-500">PF{' '}
              <span className="angka text-zinc-200">
                {ringkas.faktorProfit === null ? '—' : ringkas.faktorProfit === Infinity ? '∞' : ringkas.faktorProfit.toFixed(2)}
              </span>
            </span>
            <span className="ml-auto flex items-center gap-2">
              <button onClick={bersihkan}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-500 transition-colors hover:border-red-500/30 hover:text-red-400">
                <Trash2 className="size-3.5" /> Hapus catatan
              </button>
              <button onClick={() => void simpanKeJurnal()} disabled={menyimpan}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-50">
                {menyimpan ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Simpan ke jurnal
              </button>
            </span>
          </div>

          <TabelBungkus className="max-h-[220px] overflow-y-auto">
            <Tabel>
              <thead className="sticky top-0 bg-zinc-950">
                <tr>
                  <Th>#</Th><Th>Arah</Th><Th className="text-right">Entry</Th>
                  <Th className="text-right">Keluar</Th><Th>Sebab</Th><Th className="text-right">P/L</Th>
                </tr>
              </thead>
              <tbody>
                {[...trade].reverse().map((t) => (
                  <Tr key={t.id + t.no}>
                    <Td className="angka text-zinc-600">{t.no}</Td>
                    <Td><span className={cn('text-[11.5px]', t.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>{t.arah}</span></Td>
                    <Td className="angka text-right text-zinc-400">{fHarga(t.masuk)}</Td>
                    <Td className="angka text-right text-zinc-400">{fHarga(t.keluar)}</Td>
                    <Td><span className={cn('rounded px-1.5 py-0.5 text-[10px]',
                      t.sebab === 'TP' ? 'bg-emerald-500/10 text-emerald-500'
                        : t.sebab === 'SL' ? 'bg-red-500/10 text-red-400'
                        : 'bg-zinc-800 text-zinc-400')}>{t.sebab}</span></Td>
                    <Td className={cn('angka text-right', t.pnl >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                      {uang(t.pnl, true)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tabel>
          </TabelBungkus>
        </div>
      )}
    </>} />
  );
}
