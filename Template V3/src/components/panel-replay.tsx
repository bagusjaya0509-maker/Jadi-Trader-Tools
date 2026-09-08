import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  Play, Pause, SkipForward, RotateCcw, X, Trash2, Pencil, Check,
} from 'lucide-react';
import { Panel, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen, harga as fHarga, tanggalPendek } from '@/lib/utils';
import type { Lilin } from '@/lib/pasar';
import {
  KECEPATAN, usulSlTp, periksaKena, hitungPnl, ringkasReplay, analisaReplay, daftarSesi,
  bacaSesi, simpanSesi, hapusSesi,
  EMOSI_LATIHAN,
  type PosisiReplay, type TradeReplay, type TitikEkuitas, type KelompokReplay, type RingkasSesi,
} from '@/lib/replay';

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
   *  MARKET menggantung sampai harganya tersentuh — persis pending order.
   *  Catatan (emosi + alasan) ikut dibawa sampai ke jurnal. */
  kirim: (arah: 'BUY' | 'SELL', level: { entry: number; sl: number; tp: number }, jenis: JenisEntry, catatan?: { emosi: string; alasan: string }, qty?: number) => void;
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

/* ── Baris kendali: SATU BARIS yang digeser di ponsel ────────────────────
   Sebelumnya `flex-wrap`, dan itu tampak aman sampai dilihat di layar 375px.

   Bilah ini ditumpangkan di DASAR chart (`bottom` di chart-lilin), sementara
   tiket order ditumpangkan di ATASNYA (`top-2`). Di layar lebar keduanya
   tidak pernah bertemu. Di ponsel isinya tidak muat satu baris, `flex-wrap`
   memecahnya jadi tiga baris, dan karena dijangkarkan ke bawah ia tumbuh KE
   ATAS — persis ke dalam tiket order yang sedang tumbuh ke bawah. Yang
   terlihat pengguna: tombol putar menindih baris R:R.

   Digeser mendatar, bukan dibungkus, karena chart di ponsel cuma setinggi
   sekitar 340 px. Tinggi adalah barang paling langka di layar itu; lebar
   bisa digeser, tinggi tidak bisa dikembalikan.

   `sm:` mengembalikan perilaku lama di layar lebar, supaya tampilan desktop
   yang sudah benar tidak ikut berubah. */
/* -- KENAPA TIDAK ADA `ml-auto` DI TOMBOL KELUAR ---------------------
   Dulu tombol Keluar di kedua baris kendali memakai `sm:ml-auto`, yang
   memakunya ke ujung KANAN baris. Selama lebar barisnya belum mantap --
   dan lebarnya memang baru mantap beberapa saat sesudah chart selesai
   diukur -- tombol itu melompat: mula-mula duduk rapat di sebelah
   keterangan, lalu terlempar ke ujung kanan layar.

   Yang dilaporkan pemilik: "replaynya memendek beberapa detik kemudian
   memanjang". Bukan animasi, bukan data yang datang belakangan; cuma satu
   tombol yang posisinya bergantung pada sisa ruang kosong.

   Sekarang seluruh isi baris mengalir dari kiri dengan jarak tetap. Tidak
   ada yang bergantung pada lebar wadahnya, jadi tidak ada yang berubah
   waktu lebar itu berubah. */
const BARIS_KENDALI =
  'flex items-center gap-1.5 overflow-x-auto ' +
  '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ' +
  'sm:flex-wrap sm:overflow-visible';

export function PanelReplay({ lilin, simbol, tf, idx, setIdx, aturGaris, aturAksi, aturKendali, aturMulai, demoSetelan, usulSl, usulTp, tanpaBingkai = false, tampil = true, bidik = false, onBatalBidik }: {
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
  /** Chart sedang MENUNGGU titik mulai diklik. Bar kendali digambar dalam
   *  bentuk yang sama persis tapi mati, supaya saat kliknya mendarat tidak
   *  ada yang berubah UKURAN — cuma tombolnya yang jadi hidup. Bar yang baru
   *  muncul di detik yang sama dengan klik membuat mata mengira chartnya
   *  yang bergeser. */
  bidik?: boolean;
  /** Tombol Keluar pada bar bidik — membatalkan mode bidik di halaman. */
  onBatalBidik?: () => void;
}) {
  const [main, setMain] = useState(false);
  const [cepat, setCepat] = useState(4);
  /* Setelan demo hidup di HALAMAN, bukan di sini — tiket pojok yang
     mengeditnya, dan panel ini tinggal memakainya. Dua salinan setelan
     untuk satu order adalah cara pasti membuat keduanya berselisih. */
  const { modal, risikoPersen, kaliAtr, rr } = demoSetelan;

  const [posisi, setPosisi] = useState<PosisiReplay | null>(null);
  /* Pending order demo: satu saja pada satu waktu, sama seperti posisinya. */
  const [tunda, setTunda] = useState<{ arah: 'BUY' | 'SELL'; jenis: JenisEntry; entry: number; sl: number; tp: number; qty?: number } | null>(null);
  const [trade, setTrade] = useState<TradeReplay[]>([]);
  const [pesan, setPesan] = useState('');
  /* ── JURNAL LATIHAN HIDUP DI PANEL INI ───────────────────────────────
     Dulu ada tombol "Simpan ke jurnal" yang menulis trade latihan ke jurnal
     sungguhan bertanda "Latihan replay". Pemilik meminta 8 Sep 2026 supaya
     latihan TIDAK masuk ke jurnal real sama sekali: catatan, kurva saldo,
     analisa strategi, dan emosinya cukup di sini. Jurnal real jadi tetap
     murni transaksi yang benar-benar terjadi — angka yang dipakai menilai
     diri sendiri tidak bercampur dengan simulasi. */
  const [catatanSesi, setCatatanSesi] = useState('');
  /** Kunci baris trade yang sedang dibuka editornya: `${id}|${no}`. */
  const [sunting, setSunting] = useState<string | null>(null);
  const [sesiLain, setSesiLain] = useState<RingkasSesi[]>([]);
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
    setCatatanSesi(s?.catatan ?? '');
    setSunting(null);
    setMain(false);
    if (s?.idx != null) setIdx(s.idx);
  }, [simbol, tf, setIdx]);

  /* Simpan tiap kali ada yang berubah. Sesi replay kecil (puluhan baris),
     jadi menulisnya utuh lebih sederhana dan lebih aman daripada menambal
     sebagian — dan tidak ada jalur yang bisa lupa ikut menyimpan. */
  useEffect(() => {
    if (dimuat.current !== `${simbol}|${tf}`) return;
    simpanSesi(simbol, tf, { idx, posisi, trade, modal, catatan: catatanSesi });
  }, [simbol, tf, idx, posisi, trade, modal, catatanSesi]);

  /* Daftar sesi lain dibaca SESUDAH efek simpan di atas, supaya sesi ini
     sendiri sudah tertulis sebelum yang lain dibaca. Urutan efek mengikuti
     urutan deklarasinya. */
  useEffect(() => {
    setSesiLain(daftarSesi().filter((x) => !(x.simbol === simbol && x.tf === tf)));
  }, [simbol, tf, trade.length]);

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
    /* PEMUTARNYA IKUT BERHENTI. Sebelum ini posisinya ditutup tapi barnya
       terus melaju, jadi kabar "TP kena" lewat begitu saja sementara chart
       sudah puluhan bar di depan — orang baru sadar sesudah tidak ada lagi
       yang bisa dilihat dari kejadiannya.

       Berhenti di bar tempat stopnya kena adalah inti latihan replay: yang
       perlu diperiksa bukan angka akhirnya, melainkan seperti apa pasarnya
       tepat sebelum dan sesudah keputusan itu selesai. */
    setMain(false);
    setPesan(`${kena.kena} kena di ${fHarga(kena.harga)} — ${uang(pnl, true)} · replay dijeda`);
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
    /* Qty dari tiket (jangkar ala position tool) menang; tanpa itu jatuh
       ke model %risiko lama. */
    const unit = tunda.qty ?? ((modal + ringkas.bersih) * (risikoPersen / 100)) / Math.abs(tunda.entry - tunda.sl);
    const risiko = unit * Math.abs(tunda.entry - tunda.sl);
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
    setTrade([]); setPosisi(null); setCatatanSesi(''); setSunting(null);
    setPesan('Catatan latihan dihapus.');
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
  function buka(arah: 'BUY' | 'SELL', level: { entry: number; sl: number; tp: number }, jenis: JenisEntry = 'MARKET', catatan?: { emosi: string; alasan: string }, qty?: number) {
    if (posisi || !lilin.closes.length) return;
    const { entry, sl, tp } = level;
    if (!entry || !sl || !tp) { setPesan('Entry, SL, dan TP harus terisi.'); return; }
    if (jenis !== 'MARKET') {
      /* Entry jauh dari pasar = order MENGGANTUNG. Posisinya baru lahir saat
         harga benar-benar menyentuh entry — membukanya sekarang di harga
         pasar berarti mengeksekusi order yang tidak pernah diminta. */
      setTunda({ arah, jenis, entry, sl, tp, qty });
      void catatan; /* pending demo: catatan menyusul saat terisi — disederhanakan */
      setPesan(`${arah} ${jenis === 'STOP' ? 'Stop' : 'Limit'} dipasang di ${fHarga(entry)} — menunggu harga menyentuhnya.`);
      return;
    }
    /* Qty beku dari tiket = dolar yang TADI terpampang di garisnya; risiko
       dihitung darinya supaya jurnal mencatat angka yang sama dengan yang
       dilihat sebelum menekan Kirim. */
    const unit = qty ?? ((modal + ringkas.bersih) * (risikoPersen / 100)) / Math.abs(entry - sl);
    const risiko = unit * Math.abs(entry - sl);
    setPosisi({ id: 'p' + Date.now(), arah, masukIdx: idxAktif, masuk: entry, sl, tp, unit, risiko,
                emosi: catatan?.emosi, alasan: catatan?.alasan });
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
  /* Bar untuk MODE BIDIK — gaya yang SAMA PERSIS dengan bar hidup di
     bawah, bukan versi kelabu.
     ────────────────────────────────────────────────────────────────────
     Sempat dibuat kembaran redup (abu-abu, tombol mati), dan pemilik
     menolaknya: bar yang tampil harus bar putih yang biasa. Maka tombolnya
     dibuat SUNGGUH BEKERJA, bukan sekadar dicat hidup — tombol yang
     tampak bisa ditekan tapi diam adalah kebohongan kecil yang membuat
     orang mengira halamannya rusak.

       · Play / maju / ulang  -> mulai replay dari 60% data (bawaan lama)
       · Kecepatan            -> tersimpan betulan, kepakai begitu jalan
       · Penggeser            -> memilih titik mulai secara langsung
       · Klik di chart        -> tetap cara utama membidik titik mulai
       · Keluar               -> membatalkan mode bidik

     Satu-satunya yang berbeda dari bar hidup: chip "bar 335/1000" diganti
     ajakan memilih titik — karena barnya memang belum di mana-mana. */
  const kendaliBidik = (
    <div>
      <div className={BARIS_KENDALI}>
        <button onClick={mulai} title="Mulai dari 60% data"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md bg-zinc-100 text-zinc-950 transition-colors hover:bg-white">
          <Play className="size-4" />
        </button>
        <button onClick={mulai} title="Mulai dari 60% data"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-zinc-700/70 bg-zinc-900/70 text-zinc-300 transition-colors hover:border-zinc-600">
          <SkipForward className="size-4" />
        </button>
        <button onClick={mulai} title="Mulai dari 60% data"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-zinc-700/70 bg-zinc-900/70 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200">
          <RotateCcw className="size-4" />
        </button>
        <div className="flex shrink-0 overflow-hidden rounded-md border border-zinc-700/70 bg-zinc-900/70">
          {KECEPATAN.map((k) => (
            <button key={k.x} onClick={() => setCepat(k.x)}
              className={cn('cursor-pointer px-2 py-1.5 text-[11.5px] transition-colors',
                cepat === k.x ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200')}>
              {k.x}×
            </button>
          ))}
        </div>
        <span className="shrink-0 whitespace-nowrap rounded bg-amber-500/15 px-2 py-1 text-[11px] text-amber-300">
          Klik di chart untuk memilih titik mulai
        </span>
        <button onClick={onBatalBidik} title="Batal"
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-zinc-700/70 bg-zinc-900/70 px-2 py-1.5 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200">
          <X className="size-3.5" /> Keluar
        </button>
      </div>

      {/* Penggeser HIDUP: menariknya langsung memilih titik mulai — cara
          ketiga di samping klik chart dan tombol play. */}
      <input type="range" min={20} max={Math.max(21, lilin.closes.length - 1)} value={20}
             onChange={(e) => setIdx(Number(e.target.value))}
             className="mt-2 h-1 w-full cursor-pointer accent-emerald-500" />
    </div>
  );

  const kendali = idx === null ? (bidik ? kendaliBidik : null) : (
    <div>
      <div className={BARIS_KENDALI}>
        <button onClick={() => setMain(!main)}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md bg-zinc-100 text-zinc-950 transition-colors hover:bg-white">
          {main ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button onClick={majuSatu} title="Maju satu bar (→)"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-zinc-700/70 bg-zinc-900/70 text-zinc-300 transition-colors hover:border-zinc-600">
          <SkipForward className="size-4" />
        </button>
        <button onClick={mulai} title="Ulang dari awal"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-zinc-700/70 bg-zinc-900/70 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200">
          <RotateCcw className="size-4" />
        </button>
        <div className="flex shrink-0 overflow-hidden rounded-md border border-zinc-700/70 bg-zinc-900/70">
          {KECEPATAN.map((k) => (
            <button key={k.x} onClick={() => setCepat(k.x)}
              className={cn('cursor-pointer px-2 py-1.5 text-[11.5px] transition-colors',
                cepat === k.x ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200')}>
              {k.x}×
            </button>
          ))}
        </div>
        <span className="angka shrink-0 whitespace-nowrap rounded bg-zinc-900/70 px-2 py-1 text-[11px] text-zinc-400">
          bar {idx + 1}/{lilin.closes.length} · {tanggalPendek(lilin.times[idx])}
        </span>
        <button onClick={keluar} title="Keluar dari replay"
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-zinc-700/70 bg-zinc-900/70 px-2 py-1.5 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200">
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
  const tandaKendali = `${idx}|${main}|${cepat}|${lilin.closes.length}|${lilin.times[idx ?? 0] ?? 0}|${bidik}`;
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
  /* Saat MEMBIDIK, panel ini tidak menggambar apa pun sendiri — bar
     kendalinya sudah dikirim ke hamparan chart lewat aturKendali. Yang
     dikembalikan null cuma bagian bawahnya. */
  /* Setelannya sudah pindah ke tiket pojok. Panel bawah tinggal punya satu
     alasan hidup: pesan terakhir dan catatan latihan — kalau dua-duanya
     kosong, tidak ada yang perlu digambar. */
  if (!pesan && trade.length === 0) return null;

  const analisa = analisaReplay(trade, modal);
  const pf = ringkas.faktorProfit === null ? '—' : ringkas.faktorProfit === Infinity ? '∞' : ringkas.faktorProfit.toFixed(2);

  function ubahTrade(id: string, no: number, ubah: Partial<TradeReplay>) {
    setTrade((d) => d.map((t) => (t.id === id && t.no === no ? { ...t, ...ubah } : t)));
  }

  return (
    <Bungkus kelas="mt-4 border-emerald-500/25" anak={<>
      {pesan && <div className="px-5 py-3 text-[12px] text-zinc-400">{pesan}</div>}

      {/* ── Jurnal latihan ──────────────────────────────────────────────
          Urutannya dari yang paling cepat dibaca ke yang paling rinci:
          angka ringkas → kurva saldo & analisa → emosi → daftar trade
          dengan catatannya → catatan sesi → sesi lain. Semua pemisahnya
          garis 1 px yang sama, tanpa kartu bertumpuk, supaya panelnya
          terbaca sebagai satu lembar jurnal, bukan enam widget. */}
      {trade.length > 0 && (
        <div className="border-t border-zinc-800/80">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Jurnal latihan · {simbol.replace(/^MT5:/, '')} {tf}
            </span>
            <span className="text-[11px] text-zinc-600">
              Tidak masuk jurnal real — tersimpan di perangkat ini.
            </span>
            <button onClick={bersihkan}
              className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-500 transition-colors hover:border-red-500/30 hover:text-red-400">
              <Trash2 className="size-3.5" /> Hapus catatan
            </button>
          </div>

          {/* Angka ringkas — gap-px di atas latar garis: celah antar ubin
              sama dengan garis pemisah panel, jadi ubinnya terbaca sebagai
              satu baris angka, bukan enam kartu. */}
          <div className="grid grid-cols-2 gap-px border-y border-zinc-800/80 bg-zinc-800/80 sm:grid-cols-3 xl:grid-cols-6">
            <Ubin label="Trade" nilai={String(ringkas.jumlah)} ket={`${ringkas.menang} menang · ${ringkas.jumlah - ringkas.menang} kalah`} />
            <Ubin label="Winrate" nilai={persen(ringkas.winrate)} ket={`profit factor ${pf}`} />
            <Ubin label="P/L bersih" nilai={uang(ringkas.bersih, true)}
                  warna={ringkas.bersih >= 0 ? 'text-emerald-500' : 'text-red-400'}
                  ket={`modal ${uang(modal)} → ${uang(ringkas.ekuitas)}`} />
            <Ubin label="Ekspektasi / trade" nilai={uang(analisa.ekspektasi, true)}
                  warna={analisa.ekspektasi >= 0 ? 'text-emerald-500' : 'text-red-400'}
                  ket={`menang ${uang(analisa.rataMenang)} · kalah ${uang(analisa.rataKalah)}`} />
            <Ubin label="Max drawdown" nilai={`${analisa.drawdownMaks.toFixed(1)}%`}
                  warna={analisa.drawdownMaks > 10 ? 'text-red-400' : undefined}
                  ket={`puncak ${uang(analisa.puncak)} · lembah ${uang(analisa.lembah)}`} />
            <Ubin label="Beruntun" nilai={`${analisa.beruntunMenang}M · ${analisa.beruntunKalah}K`}
                  ket={`rata-rata ditahan ${analisa.rataBar.toFixed(1)} bar`} />
          </div>

          <div className="grid gap-px bg-zinc-800/80 lg:grid-cols-[3fr_2fr]">
            <div className="bg-zinc-950 px-5 py-4">
              <div className="mb-2 flex items-baseline justify-between gap-3 text-[11px] text-zinc-500">
                <span>Perkembangan saldo</span>
                <span className="angka text-zinc-600">{trade.length} trade · garis putus = modal awal</span>
              </div>
              <KurvaEkuitas titik={analisa.kurva} modal={modal} />
            </div>
            <div className="bg-zinc-950 px-5 py-4">
              <div className="mb-2 text-[11px] text-zinc-500">Analisa strategi</div>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[12px]">
                <Baris k="Rasio rata menang : kalah" v={analisa.rasioRataRata === null ? '—' : analisa.rasioRataRata.toFixed(2)} />
                <Baris k="Trade terbaik" v={analisa.terbaik ? `#${analisa.terbaik.no} · ${uang(analisa.terbaik.pnl, true)}` : '—'} warna="text-emerald-500" />
                <Baris k="Trade terburuk" v={analisa.terburuk ? `#${analisa.terburuk.no} · ${uang(analisa.terburuk.pnl, true)}` : '—'} warna="text-red-400" />
              </dl>
              <TabelKelompok judul="Per arah" baris={analisa.perArah} />
              <TabelKelompok judul="Per cara keluar" baris={analisa.perSebab} />
            </div>
          </div>

          <div className="border-t border-zinc-800/80 px-5 py-4">
            <div className="mb-1 text-[11px] text-zinc-500">Emosi saat masuk</div>
            <div className="mb-2 text-[11px] text-zinc-600">
              Dari kolom emosi di tiket order. Bandingkan winrate tiap emosi dengan winrate keseluruhan {persen(ringkas.winrate)}.
            </div>
            <TabelKelompok baris={analisa.perEmosi} />
          </div>

          <div className="border-t border-zinc-800/80 px-5 py-4">
            <div className="mb-2 text-[11px] text-zinc-500">Daftar trade & catatan evaluasi</div>
            <TabelBungkus className="max-h-[320px] overflow-y-auto">
              <Tabel>
                <thead className="sticky top-0 bg-zinc-950">
                  <tr>
                    <Th>#</Th><Th>Keluar</Th><Th>Arah</Th>
                    <Th className="text-right">Entry</Th><Th className="text-right">Keluar</Th>
                    <Th>Sebab</Th><Th className="text-right">P/L</Th><Th>Emosi</Th><Th>Catatan</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...trade].reverse().map((t) => {
                    const kunci = `${t.id}|${t.no}`;
                    const buka = sunting === kunci;
                    return (
                      <Fragment key={kunci}>
                        <Tr>
                          <Td className="angka text-zinc-600">{t.no}</Td>
                          <Td className="whitespace-nowrap text-zinc-500">{tanggalPendek(t.keluarWaktu)}</Td>
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
                          <Td className="whitespace-nowrap text-zinc-400" title={t.alasan || undefined}>
                            {t.emosi || <span className="text-zinc-700">—</span>}
                            {t.emosiEvaluasi && t.emosiEvaluasi !== t.emosi && (
                              <span className="text-zinc-600"> → {t.emosiEvaluasi}</span>
                            )}
                          </Td>
                          <Td>
                            <button onClick={() => setSunting(buka ? null : kunci)}
                              title={buka ? 'Tutup editor' : 'Tulis evaluasi trade ini'}
                              className={cn('flex max-w-[220px] cursor-pointer items-center gap-1.5 text-left text-[11.5px] transition-colors',
                                t.evaluasi ? 'text-zinc-300 hover:text-zinc-100' : 'text-zinc-600 hover:text-zinc-300')}>
                              {buka ? <Check className="size-3 shrink-0" /> : <Pencil className="size-3 shrink-0" />}
                              <span className="truncate">{t.evaluasi || 'tulis evaluasi'}</span>
                            </button>
                          </Td>
                        </Tr>
                        {buka && (
                          <tr className="bg-zinc-900/40">
                            <Td colSpan={9} className="py-3">
                              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                                <label className="block">
                                  <span className="mb-1 block text-[11px] text-zinc-500">Emosi sesudah tahu hasilnya</span>
                                  <select value={t.emosiEvaluasi ?? ''}
                                          onChange={(e) => ubahTrade(t.id, t.no, { emosiEvaluasi: e.target.value || undefined })}
                                          className="w-full cursor-pointer rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[12px] text-zinc-200">
                                    <option value="">— pilih —</option>
                                    {EMOSI_LATIHAN.map((e) => <option key={e} value={e}>{e}</option>)}
                                  </select>
                                  {t.alasan && (
                                    <div className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                                      <span className="text-zinc-600">Alasan masuk:</span> {t.alasan}
                                    </div>
                                  )}
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-[11px] text-zinc-500">Evaluasi</span>
                                  <textarea value={t.evaluasi ?? ''} rows={3} autoFocus
                                            onChange={(e) => ubahTrade(t.id, t.no, { evaluasi: e.target.value })}
                                            placeholder="Apa yang benar, apa yang keliru, dan apa yang akan dilakukan berbeda di setup yang sama?"
                                            className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-[12px] leading-relaxed text-zinc-200 placeholder:text-zinc-700" />
                                </label>
                              </div>
                            </Td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </Tabel>
            </TabelBungkus>
          </div>

          <div className="border-t border-zinc-800/80 px-5 py-4">
            <label className="block">
              <span className="mb-1 block text-[11px] text-zinc-500">Catatan sesi</span>
              <textarea value={catatanSesi} rows={3}
                        onChange={(e) => setCatatanSesi(e.target.value)}
                        placeholder="Pelajaran dari keseluruhan sesi: pola yang berulang, kesalahan yang sama, aturan yang mau dicoba di sesi berikutnya."
                        className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-[12px] leading-relaxed text-zinc-200 placeholder:text-zinc-700" />
            </label>
          </div>

          {sesiLain.length > 0 && (
            <div className="border-t border-zinc-800/80 px-5 py-3">
              <div className="mb-1.5 text-[11px] text-zinc-500">Sesi latihan lain di perangkat ini</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]">
                {sesiLain.map((x) => (
                  <span key={x.simbol + x.tf} className="whitespace-nowrap text-zinc-400">
                    {x.simbol.replace(/^MT5:/, '')} <span className="text-zinc-600">{x.tf}</span>
                    {' '}<span className="angka text-zinc-500">{x.jumlah} trade</span>
                    {' '}<span className={cn('angka', x.bersih >= 0 ? 'text-emerald-500' : 'text-red-400')}>{uang(x.bersih, true)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>} />
  );
}

/* ── Potongan tampilan jurnal ─────────────────────────────────────────── */

function Ubin({ label, nilai, ket, warna }: { label: string; nilai: string; ket?: string; warna?: string }) {
  return (
    <div className="min-w-0 bg-zinc-950 px-4 py-3">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className={cn('angka mt-1 text-[18px] font-semibold leading-none tracking-tight text-zinc-100', warna)}>{nilai}</div>
      {ket && <div className="mt-1.5 truncate text-[11px] text-zinc-600" title={ket}>{ket}</div>}
    </div>
  );
}

function Baris({ k, v, warna }: { k: string; v: string; warna?: string }) {
  return (
    <>
      <dt className="text-zinc-500">{k}</dt>
      <dd className={cn('angka whitespace-nowrap text-right text-zinc-200', warna)}>{v}</dd>
    </>
  );
}

function TabelKelompok({ judul, baris }: { judul?: string; baris: KelompokReplay[] }) {
  if (!baris.length) return null;
  return (
    <div className={cn(judul && 'mt-3')}>
      {judul && <div className="mb-1 text-[11px] text-zinc-600">{judul}</div>}
      <table className="w-full text-[11.5px]">
        <thead>
          <tr className="text-left text-zinc-600">
            <th className="font-normal">Kelompok</th>
            <th className="text-right font-normal">Trade</th>
            <th className="text-right font-normal">Winrate</th>
            <th className="text-right font-normal">P/L</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.nama} className="border-t border-zinc-800/60">
              <td className="py-1 text-zinc-300">{b.nama}</td>
              <td className="angka py-1 text-right text-zinc-400">{b.jumlah}</td>
              <td className="angka py-1 text-right text-zinc-400">{persen(b.winrate)}</td>
              <td className={cn('angka py-1 text-right', b.bersih >= 0 ? 'text-emerald-500' : 'text-red-400')}>{uang(b.bersih, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Kurva ekuitas digambar SVG polos, bukan Recharts.
   ──────────────────────────────────────────────────────────────────────
   Recharts sengaja dijaga di luar jalur muat awal halaman Chart (lihat
   catatan bundel V3); satu garis dan satu bidang tidak sepadan dengan
   ratusan kilobyte. preserveAspectRatio="none" membuatnya mengikuti lebar
   wadah, dan vectorEffect menjaga tebal garisnya tidak ikut melar. */
function KurvaEkuitas({ titik, modal }: { titik: TitikEkuitas[]; modal: number }) {
  const W = 600, H = 120, P = 6;
  const nilai = titik.map((t) => t.ekuitas);
  const lo = Math.min(modal, ...nilai), hi = Math.max(modal, ...nilai);
  const rentang = hi - lo || 1;
  const x = (i: number) => P + (i / Math.max(1, titik.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - lo) / rentang) * (H - 2 * P);
  const jalur = titik.map((t, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(t.ekuitas).toFixed(1)}`).join(' ');
  const akhir = nilai[nilai.length - 1] ?? modal;
  const warna = akhir >= modal ? '#10b981' : '#f87171';
  const bidang = `${jalur} L${x(titik.length - 1).toFixed(1)},${y(modal).toFixed(1)} L${x(0).toFixed(1)},${y(modal).toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[120px] w-full"
         role="img" aria-label={`Kurva ekuitas latihan, dari ${uang(modal)} ke ${uang(akhir)}`}>
      <line x1={P} x2={W - P} y1={y(modal)} y2={y(modal)} stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <path d={bidang} fill={warna} fillOpacity="0.12" />
      <path d={jalur} fill="none" stroke={warna} strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
