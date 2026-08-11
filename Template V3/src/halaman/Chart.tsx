import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Play, Loader2, RefreshCw, Radio, TriangleAlert, History } from 'lucide-react';
import { Panel, PanelHead, KartuKpi, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen, harga, tanggalPendek } from '@/lib/utils';
import { ChartLilin, type Garis, type GarisHarga, type GarisSeret } from '@/components/chart-lilin';
import { PanelReplay, type AksiOrder, type JenisEntry } from '@/components/panel-replay';
import { PojokOrder } from '@/components/pojok-order';
import { kirimOrderNyata, type MetodeTp } from '@/lib/order-nyata';
import { PanelPine } from '@/components/panel-pine';
import type { HasilPine } from '@/lib/pine';
import { bacaSetelanChart, simpanSetelanChart } from '@/lib/replay';
import { ambilKlines, type Lilin } from '@/lib/pasar';
import {
  jalankanUji, garisIndikator, zonaSnr, deretSmi, SETELAN_BAWAAN,
  type Setelan, type HasilUji,
} from '@/lib/backtest';
import { SIMBOL_DASAR } from '@/lib/simbol';

/* ════════════════════════════════════════════════════════════════════════
   CHART & BACKTEST
   ════════════════════════════════════════════════════════════════════════
   Halaman ini dulu prototipe seluruhnya: lilin random-walk berseed tetap,
   panel hasil berisi angka contoh, tombol "Jalankan Backtest" tanpa
   penanganan klik. Sekarang ketiganya sungguhan.

   Datanya lewat proxy VPS yang sama dengan screener — bukan langsung ke
   Binance, yang diblokir sebagian ISP Indonesia. Indikatornya dihitung
   dengan fungsi yang SAMA dengan screener (jt-scan-core), jadi sinyal yang
   terlihat di sini adalah sinyal yang sama dengan yang muncul di Screener
   Entry. Kalau keduanya memakai perhitungan terpisah, selisihnya cuma soal
   waktu dan tidak akan ada yang tahu mana yang benar.

   BATAS YANG DIAKUI TERBUKA: ini backtest KRIPTO. Menguji EA MetaTrader
   butuh Strategy Tester MT5, yang berjalan di Windows dan bukan di halaman
   web — jalur itu menunggu VPS Windows tersendiri.
   ════════════════════════════════════════════════════════════════════════ */

const TF = [
  { nilai: '5m', label: '5 Menit' },
  { nilai: '15m', label: '15 Menit' },
  { nilai: '1h', label: '1 Jam' },
  { nilai: '4h', label: '4 Jam' },
  { nilai: '1d', label: 'Harian' },
];

/** Durasi tiap timeframe dalam milidetik. */
const DURASI_TF: Record<string, number> = {
  '5m': 5 * 60_000, '15m': 15 * 60_000, '1h': 3_600_000,
  '4h': 4 * 3_600_000, '1d': 24 * 3_600_000,
};

/** 3725 -> "1:02:05". Jam disembunyikan kalau nol — "0:02:05" membuat mata
 *  membaca angka yang tidak membawa informasi apa pun. */
function jamMundur(detikTotal: number) {
  const d = Math.floor(detikTotal);
  const j = Math.floor(d / 3600), m = Math.floor((d % 3600) / 60), s = d % 60;
  const dua = (n: number) => String(n).padStart(2, '0');
  return j > 0 ? `${j}:${dua(m)}:${dua(s)}` : `${m}:${dua(s)}`;
}

const KELAS_ISIAN =
  'h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 text-[12.5px] text-zinc-200 ' +
  'outline-none transition-colors hover:border-zinc-700 focus-visible:border-zinc-600';

function Angka({ label, nilai, atur, langkah = 1, min = 0 }: {
  label: string; nilai: number; atur: (n: number) => void; langkah?: number; min?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-zinc-500">{label}</label>
      <input type="number" value={nilai} step={langkah} min={min}
             onChange={(e) => atur(Number(e.target.value))}
             className={cn(KELAS_ISIAN, 'angka')} />
    </div>
  );
}

export default function ChartBacktest() {
  /* Simbol & timeframe boleh datang dari alamatnya: `#/chart?simbol=ETHUSDT`.
     Itulah yang dipakai menu klik-kanan di Screener Entry untuk membuka koin
     tertentu di sini, dan juga yang membuat halaman ini bisa ditandai. */
  const [cari] = useSearchParams();
  /* Urutan sumber: ALAMAT dulu, lalu setelan tersimpan, baru bawaan.
     Alamat menang karena ia perbuatan yang baru saja dilakukan — klik kanan
     di screener harus membuka koin yang diklik, bukan koin kemarin. */
  const awal = bacaSetelanChart();
  const [simbol, setSimbol] = useState(() => (cari.get('simbol') || awal.simbol || 'BTCUSDT').toUpperCase());
  const [tf, setTf] = useState(() => {
    const t = (cari.get('tf') || awal.tf || '4h').toLowerCase();
    return ['5m', '15m', '1h', '4h', '1d'].includes(t) ? t : '4h';
  });

  /* Alamat yang berubah saat halaman sudah terbuka ikut diikuti — klik kanan
     di screener dua kali berturut-turut harus berpindah dua kali. */
  useEffect(() => {
    const s = cari.get('simbol');
    if (s) setSimbol(s.toUpperCase());
    const x = (cari.get('tf') || '').toLowerCase();
    if (x && ['5m', '15m', '1h', '4h', '1d'].includes(x)) setTf(x);
  }, [cari]);
  const [lilin, setLilin] = useState<Lilin>({ opens: [], highs: [], lows: [], closes: [], times: [] });
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [segar, setSegar] = useState(0);
  const [set, setSet] = useState<Setelan>(SETELAN_BAWAAN);
  const [hasil, setHasil] = useState<HasilUji | null>(null);
  const [uji, setUji] = useState(false);
  /* null = replay mati. Angkanya indeks bar terakhir yang boleh tampil. */
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const [garisHarga, setGarisHarga] = useState<GarisHarga[]>([]);
  const [aksi, setAksi] = useState<AksiOrder | null>(null);
  const [pine, setPine] = useState<HasilPine | null>(null);
  const [kendaliReplay, setKendaliReplay] = useState<React.ReactNode>(null);
  /* Arah tiket yang sedang disusun. null = belum ada tiket, chart cuma
     menggambar rencana dari kartu screener kalau ada. */
  const [draf, setDraf] = useState<'BUY' | 'SELL' | null>(null);
  /* Setelan order sungguhan — hidup di halaman supaya label risiko di
     garis chart dihitung dari angka yang SAMA dengan yang akan dikirim. */
  const [nyataSetelan, setNyataSetelan] = useState<{ modal: number; leverage: number; metode: MetodeTp }>(
    { modal: 100, leverage: 4, metode: 'partial' });
  /* Setelan latihan — dulu di panel bawah yang baru muncul saat replay;
     order demo tidak bergantung replay, jadi setelannya ikut tiket. */
  const [demoSetelan, setDemoSetelan] = useState({ modal: 1000, risikoPersen: 1, kaliAtr: 1.5, rr: 2 });
  /* Emosi & alasan diisi SEBELUM kirim — masuk jurnal (demo) dan record
     posisi screener (real). Jurnal tanpa alasan cuma daftar angka. */
  const [catatanTiket, setCatatanTiket] = useState({ emosi: 'Netral', alasan: '' });

  /* Mengubah SL ×ATR / R:R saat tiket TERBUKA langsung menggeser garisnya —
     setelan yang baru berlaku untuk tiket berikutnya terasa seperti setelan
     yang rusak. Level hasil seretan tangan tidak disentuh: begitu orangnya
     menggeser sendiri, usulannya berhenti ikut campur. */
  const seretTangan = useRef(false);
  useEffect(() => {
    if (!draf || !aksi || aksi.mode !== 'demo' || seretTangan.current) return;
    const u = aksi.usul(draf);
    if (u && u.sl && u.tp) setRencana((r) => ({ ...r, sl: u.sl, tp: u.tp }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoSetelan.kaliAtr, demoSetelan.rr]);
  const [sibukNyata, setSibukNyata] = useState(false);
  const [kabarNyata, setKabarNyata] = useState('');
  const mulaiReplay = useRef<(() => void) | null>(null);
  /* Stabil dengan sengaja: fungsi baru tiap render akan memicu ulang efek
     yang memasangnya di panel replay, dan efek itu memanggil setState. */
  const simpanMulai = useCallback((f: (() => void) | null) => { mulaiReplay.current = f; }, []);

  /* SL & TP dari kartu screener, dibaca dari alamat. Dipakai sekali sebagai
     usulan saat membuka posisi replay — bukan dipaksakan, karena arah yang
     dipilih orangnya bisa berbeda dengan arah kartunya. */
  /* ── LEVEL RENCANA ──────────────────────────────────────────────────
     Entry, SL, dan TP yang tergambar di chart dan BISA DIGESER. Isinya bisa
     datang dari tiga tempat: kartu screener lewat alamat, posisi replay yang
     sedang terbuka, atau seretan orangnya sendiri.

     Angka terakhir setelah digeser itulah yang dipakai saat order dikirim —
     jadi menggeser garis di chart adalah cara mengubah level, bukan sekadar
     hiasan yang terpisah dari kotak isian. */
  const [rencana, setRencana] = useState<{ entry?: number; sl?: number; tp?: number }>({});

  /* Level dari alamat dipasang SEKALI per kombinasi yang datang. Kalau
     dipasang tiap render, seretan orangnya akan terlempar balik ke angka
     kartu setiap kali komponennya menggambar ulang. */
  const dipasang = useRef('');
  useEffect(() => {
    const sl = Number(cari.get('sl')) || undefined;
    const tp = Number(cari.get('tp')) || undefined;
    const kunci = `${simbol}|${sl ?? ''}|${tp ?? ''}`;
    if (dipasang.current === kunci) return;
    dipasang.current = kunci;
    if (sl || tp) {
      setRencana({ entry: lilin.closes[lilin.closes.length - 1] || undefined, sl, tp });
    }
  }, [cari, simbol, lilin]);

  /* Entry menyusul harga terakhir selama belum ada posisi dan belum digeser
     sendiri — supaya garisnya tidak menggantung jauh dari lilin terbaru. */
  const entryDigeser = useRef(false);
  useEffect(() => {
    if (entryDigeser.current || aksiPosisi) return;
    const h = lilin.closes[lilin.closes.length - 1];
    if (h && (rencana.sl || rencana.tp)) setRencana((r) => ({ ...r, entry: h }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lilin.closes.length]);

  const usulSl = rencana.sl;
  const usulTp = rencana.tp;
  /* Zona SNR dari logika yang sama dengan screener. Dimatikan secara bawaan:
     empat garis mendatar di chart yang belum dibaca cuma menutupi lilinnya. */
  const [tampilSnr, setTampilSnr] = useState(awal.snr ?? false);
  const [tampilSmi, setTampilSmi] = useState(awal.smi ?? true);

  /* Simpan tiap kali salah satunya berubah. */
  useEffect(() => {
    simpanSetelanChart({ simbol, tf, snr: tampilSnr, smi: tampilSmi });
  }, [simbol, tf, tampilSnr, tampilSmi]);

  /* ── Data realtime ──────────────────────────────────────────────────
     Ditarik ulang tiap 15 detik, sama dengan umur cache di lib/pasar.ts —
     memintanya lebih sering hanya akan menerima salinan cache yang sama. */
  useEffect(() => {
    let hidup = true;
    async function tarik() {
      try {
        const l = await ambilKlines(simbol, tf, 500, true);
        if (!hidup) return;
        if (!l.closes.length) { setGalat('Data tidak diterima. Proxy VPS mungkin sedang tidak menjawab.'); }
        else { setLilin(l); setGalat(''); }
      } catch (e) {
        if (hidup) setGalat(e instanceof Error ? e.message : 'Gagal mengambil data');
      } finally {
        if (hidup) setMemuat(false);
      }
    }
    setMemuat(true);
    void tarik();
    /* Selama replay, data TIDAK disegarkan. Array lilin yang berganti di
       tengah putar-ulang akan menggeser arti setiap indeks — posisi yang
       dibuka di bar 300 tiba-tiba menunjuk lilin yang berbeda. */
    if (replayIdx !== null) return () => { hidup = false; };
    /* 3 detik, bukan 15: chart yang sedang ditatap harus bergerak seperti
       pasar, dan bebannya sudah dihitung di lib/pasar.ts — 3% dari jatah
       rate limit Binance untuk satu chart. */
    const jam = setInterval(tarik, 3_000);
    return () => { hidup = false; clearInterval(jam); };
  }, [simbol, tf, segar, replayIdx !== null]);

  /* Hasil backtest DIBUANG saat simbol/timeframe/setelan berubah. Tabel
     trade dari BTC 4 jam yang masih terpampang di bawah chart ETH 5 menit
     adalah cara paling halus untuk salah membaca hasil. */
  useEffect(() => { setHasil(null); }, [simbol, tf, set]);
  /* Ganti simbol atau timeframe = keluar dari replay. Melanjutkan replay di
     atas deret lilin yang berbeda berarti setiap indeks menunjuk waktu yang
     lain, dan posisi yang sedang terbuka jadi tidak punya arti. */
  useEffect(() => { setReplayIdx(null); setGarisHarga([]); }, [simbol, tf]);

  const garis: Garis[] = useMemo(() => {
    const keluar: Garis[] = [];
    if (set.strategi === 'ema' && lilin.closes.length) {
      const g = garisIndikator(lilin, set);
      keluar.push({ nama: `EMA ${set.emaCepat}`, nilai: g.cepat ?? [], warna: '#fbbf24' });
      keluar.push({ nama: `EMA ${set.emaLambat}`, nilai: g.lambat ?? [], warna: '#60a5fa' });
    }
    /* Garis dari Pine ikut di panel harga; yang bersifat osilator (RSI, SMI)
       dikirim ke panel bawah lewat jalur `smi`. Memisahkannya di sini, bukan
       di penerjemah, supaya penerjemah tidak perlu tahu apa pun tentang cara
       menggambar. */
    (pine?.plot ?? []).filter((p) => !p.osilator)
      .forEach((p) => keluar.push({ nama: p.judul, nilai: p.nilai, warna: p.warna }));
    return keluar;
  }, [lilin, set, pine]);

  /* Zona dihitung sampai bar yang SEDANG tampil, bukan sampai bar terakhir.
     Selama replay, menggambar zona dari data masa depan adalah cara paling
     halus untuk membuat latihannya berbohong. */
  const zona = useMemo(
    () => (tampilSnr && lilin.closes.length ? zonaSnr(lilin, replayIdx ?? undefined) : null),
    [tampilSnr, lilin, replayIdx]
  );

  /* Zona digambar sebagai TIGA garis per sisi: batas atas, nilai pivotnya,
     dan batas bawah. Pita utuh butuh seri area tersendiri; tiga garis tipis
     menyampaikan hal yang sama dengan sepersepuluh kerumitannya, dan batas
     itulah yang sebenarnya dibaca saat menilai sentuhan. */
  const garisZona = useMemo(() => {
    if (!zona) return [];
    const g: GarisHarga[] = [];
    if (zona.resisten) {
      g.push({ harga: zona.resisten.atas, warna: 'rgba(248,113,113,.28)', label: '' });
      g.push({ harga: zona.resisten.nilai, warna: 'rgba(248,113,113,.7)', label: 'R' });
      g.push({ harga: zona.resisten.bawah, warna: 'rgba(248,113,113,.28)', label: '' });
    }
    if (zona.support) {
      g.push({ harga: zona.support.atas, warna: 'rgba(16,185,129,.28)', label: '' });
      g.push({ harga: zona.support.nilai, warna: 'rgba(16,185,129,.7)', label: 'S' });
      g.push({ harga: zona.support.bawah, warna: 'rgba(16,185,129,.28)', label: '' });
    }
    return g;
  }, [zona]);

  const smi = useMemo(() => {
    /* Osilator dari Pine MENGGANTI panel SMI bawaan saat ada — dua osilator
       di satu panel dengan skala berbeda tidak bisa dibaca, dan yang baru
       saja dijalankan orangnya adalah yang ingin dilihatnya. */
    const dariPine = (pine?.plot ?? []).filter((p) => p.osilator);
    if (dariPine.length) {
      return { smi: dariPine[0].nilai, signal: dariPine[1]?.nilai ?? [] };
    }
    return tampilSmi && lilin.closes.length >= 30 ? deretSmi(lilin) : null;
  }, [tampilSmi, lilin, pine]);

  /* Posisi yang sedang terbuka MENANG atas rencana: kalau sudah masuk, yang
     digambar adalah level posisinya, bukan rancangan sebelumnya. */
  const aksiPosisi = aksi?.posisi ?? null;
  const aksiTunda = aksi?.tunda ?? null;

  /* Begitu posisinya SELESAI — SL kena, TP kena, atau ditutup manual — semua
     garisnya ikut hilang. Garis order yang sudah mati tapi masih tergambar
     akan terbaca sebagai order yang masih hidup, dan itu lebih menyesatkan
     daripada chart kosong. */
  const adaPosisiSebelumnya = useRef(false);
  useEffect(() => {
    if (adaPosisiSebelumnya.current && !aksiPosisi) {
      setRencana({});
      setDraf(null);
      entryDigeser.current = false;
    }
    adaPosisiSebelumnya.current = !!aksiPosisi;
  }, [aksiPosisi]);

  /* ── Jenis order dari LETAK garis entry ────────────────────────────
     Entry di harga pasar = Market. BUY di atas pasar = Buy Stop (mengejar
     tembusan), BUY di bawah = Buy Limit (menunggu diskon); SELL kebalikan
     persisnya. Aturan yang sama dengan bursa mana pun — dan karena jenisnya
     mengikuti seretan, menyeret garis entry ADALAH cara memilih jenis. */
  const jenisEntry: JenisEntry = useMemo(() => {
    const market = aksi?.hargaKini;
    const e = rencana.entry;
    if (!draf || !e || !market) return 'MARKET';
    if (Math.abs(e - market) / market < 0.0005) return 'MARKET';
    if (draf === 'BUY') return e > market ? 'STOP' : 'LIMIT';
    return e < market ? 'STOP' : 'LIMIT';
  }, [draf, rencana.entry, aksi?.hargaKini]);
  const labelJenis = jenisEntry === 'MARKET' ? 'Market'
    : `${draf === 'BUY' ? 'Buy' : 'Sell'} ${jenisEntry === 'STOP' ? 'Stop' : 'Limit'}`;
  const garisSeret: GarisSeret[] = useMemo(() => {
    const sumber = aksiPosisi
      ? { entry: aksiPosisi.masuk, sl: aksiPosisi.sl, tp: aksiPosisi.tp }
      : aksiTunda
      ? { entry: aksiTunda.entry, sl: aksiTunda.sl, tp: aksiTunda.tp }
      : rencana;
    const kunci = !!aksiPosisi || !!aksiTunda;
    const g: GarisSeret[] = [];

    /* Risiko & imbalan DITULIS DI GARISNYA.
       ─────────────────────────────────────────────────────────────────
       SL bukan sekadar harga — ia jumlah uang yang hilang kalau tersentuh.
       Untuk posisi yang sudah jalan, angkanya dari ukuran posisi
       sesungguhnya; untuk tiket yang sedang disusun, dari setelan risiko.
       Menaruhnya di label garis berarti menyeret garis LANGSUNG terlihat
       akibatnya dalam dolar, bukan cuma dalam harga. */
    const e = sumber.entry, s = sumber.sl, tpN = sumber.tp;
    let ketSl = '', ketTp = '';
    if (e && s && tpN) {
      if (aksiPosisi) {
        ketSl = `· -${uang(aksiPosisi.risiko)}`;
        ketTp = `· +${uang(aksiPosisi.unit * Math.abs(tpN - aksiPosisi.masuk))}`;
      } else if (aksi?.mode === 'real') {
        /* Mode REAL: dolar dari ukuran order yang SEBENARNYA akan dikirim —
           qty = modal × leverage / entry, bukan dari setelan risiko demo. */
        const qty = (nyataSetelan.modal * nyataSetelan.leverage) / e;
        ketSl = `· -${uang(qty * Math.abs(e - s))}`;
        ketTp = `· +${uang(qty * Math.abs(tpN - e))}`;
      } else if (aksi) {
        const r = aksi.risiko;
        ketSl = `· -${uang(r)}`;
        ketTp = `· +${uang(r * (Math.abs(tpN - e) / Math.abs(e - s)))}`;
      }
    }
    const ketEntry = aksiTunda
      ? `· ${aksiTunda.arah === 'BUY' ? 'Buy' : 'Sell'} ${aksiTunda.jenis === 'STOP' ? 'Stop' : 'Limit'} menunggu`
      : draf ? `· ${labelJenis}` : '';

    if (sumber.entry) g.push({ id: 'entry', harga: sumber.entry, warna: '#d4d4d8', label: 'Entry', ket: ketEntry, bisaSeret: !kunci });
    if (sumber.sl) g.push({ id: 'sl', harga: sumber.sl, warna: '#f87171', label: 'SL', ket: ketSl, bisaSeret: !kunci });
    if (sumber.tp) g.push({ id: 'tp', harga: sumber.tp, warna: '#10b981', label: 'TP', ket: ketTp, bisaSeret: !kunci });
    return g;
  }, [aksiPosisi, aksiTunda, rencana, aksi, draf, labelJenis, nyataSetelan]);

  const terakhir = lilin.closes[lilin.closes.length - 1];
  const sebelumnya = lilin.closes[lilin.closes.length - 2];
  const gerak = terakhir && sebelumnya ? ((terakhir - sebelumnya) / sebelumnya) * 100 : 0;

  /* ── Hitung mundur penutupan lilin ──────────────────────────────────
     Dihitung dari JAM SEKARANG, bukan dari waktu lilin terakhir. Klines
     yang kita terima disegarkan tiap 15 detik; kalau hitung mundurnya
     bersandar pada stempel lilin, angkanya akan melompat 15 detik sekali
     alih-alih berdetak.

     Batas lilin di Binance selalu kelipatan bulat dari durasinya sejak
     epoch (00:00, 04:00, 08:00 untuk 4 jam), jadi sisa waktunya bisa
     dihitung tanpa tahu kapan lilin terakhir dibuka. */
  /* Teks yang sedang diketik di kotak simbol, terpisah dari simbol aktif. */
  const [ketik, setKetik] = useState(simbol);
  useEffect(() => { setKetik(simbol); }, [simbol]);
  function komitSimbol() {
    const v = ketik.trim().toUpperCase();
    /* Bentuk yang jelas bukan simbol tidak dikirim ke proxy sama sekali;
       kotaknya dikembalikan ke simbol yang sedang tampil supaya tidak ada
       yang mengira grafiknya sedang menampilkan apa yang tertulis. */
    if (!/^[A-Z0-9]{5,15}$/.test(v)) { setKetik(simbol); return; }
    if (v !== simbol) setSimbol(v);
  }

  const [detik, setDetik] = useState(0);
  useEffect(() => {
    const durasi = DURASI_TF[tf] ?? 0;
    if (!durasi) return;
    const hitung = () => setDetik(Math.max(0, durasi - (Date.now() % durasi)) / 1000);
    hitung();
    const jam = setInterval(hitung, 1000);
    return () => clearInterval(jam);
  }, [tf]);

  function jalankan() {
    setUji(true);
    /* Beri satu bingkai supaya tombolnya sempat menampilkan keadaan sibuk.
       500 lilin selesai dalam belasan milidetik, dan tombol yang berubah
       lalu kembali dalam satu frame terlihat seperti tidak ditekan. */
    setTimeout(() => {
      setHasil(jalankanUji(lilin, set));
      setUji(false);
    }, 30);
  }

  return (
    <div className="p-4 sm:p-6">
      {/* ── Bilah kendali ── */}
      <Panel>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[168px]">
            <label className="mb-1 block text-[11px] text-zinc-500">Simbol</label>
            {/* Diketik dulu, DIKOMIT belakangan.
                ──────────────────────────────────────────────────────────
                Sebelumnya tiap huruf langsung jadi simbol aktif: mengetik
                "ETHUSDT" menembakkan tujuh permintaan ke proxy, enam di
                antaranya untuk simbol yang tidak ada ("E", "ET", "ETH"…).
                Yang terlihat adalah halaman tersendat lalu grafiknya hilang
                diganti pesan galat — bukan karena pencariannya rusak, tapi
                karena setiap ketukan diperlakukan sebagai keputusan. */}
            <input list="simbolChart" value={ketik}
                   onChange={(e) => {
                     const v = e.target.value.toUpperCase();
                     setKetik(v);
                     /* Memilih dari daftar langsung berlaku — itu memang
                        sebuah pilihan, bukan setengah kata. */
                     if (SIMBOL_DASAR.includes(v)) setSimbol(v);
                   }}
                   onKeyDown={(e) => { if (e.key === 'Enter') komitSimbol(); }}
                   onBlur={komitSimbol}
                   placeholder="BTCUSDT"
                   className={cn(KELAS_ISIAN, 'angka')} />
            <datalist id="simbolChart">
              {SIMBOL_DASAR.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div className="min-w-[120px]">
            <label className="mb-1 block text-[11px] text-zinc-500">Timeframe</label>
            <select value={tf} onChange={(e) => setTf(e.target.value)} className={cn(KELAS_ISIAN, 'cursor-pointer')}>
              {TF.map((x) => <option key={x.nilai} value={x.nilai}>{x.label}</option>)}
            </select>
          </div>

          <div className="flex items-end gap-3">
            <div>
              <div className="text-[11px] text-zinc-500">Harga terakhir</div>
              <div className="angka text-[19px] font-semibold leading-tight text-zinc-100">
                {terakhir ? harga(terakhir) : '—'}
              </div>
            </div>
            {terakhir && (
              <span className={cn('angka mb-1 text-[12.5px]', gerak >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {gerak >= 0 ? '+' : ''}{gerak.toFixed(2)}%
              </span>
            )}
            {/* Hitung mundurnya sekarang MENEMPEL di sisi skala harga di dalam
                chart, sejajar label harga — sama seperti TradingView. Di
                bilah atas ia jauh dari tempat mata sedang berada. */}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className={cn('flex items-center gap-1.5 text-[11px]', memuat ? 'text-zinc-600' : 'text-emerald-500')}>
              <Radio className="size-3" /> {memuat ? 'memuat' : 'live · 3 dtk'}
            </span>
            <button onClick={() => setSegar((n) => n + 1)}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
              <RefreshCw className={cn('size-3.5', memuat && 'animate-spin')} /> Segarkan
            </button>
            <label title="Zona support & resisten dari logika yang sama dengan Screener Entry"
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700">
              <input type="checkbox" checked={tampilSnr} onChange={(e) => setTampilSnr(e.target.checked)}
                     className="size-3.5 cursor-pointer accent-zinc-200" />
              Zona SNR
            </label>
            <label title="Panel SMI di bawah chart — perhitungan yang sama dengan Screener Entry"
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700">
              <input type="checkbox" checked={tampilSmi} onChange={(e) => setTampilSmi(e.target.checked)}
                     className="size-3.5 cursor-pointer accent-zinc-200" />
              SMI
            </label>
            <button onClick={() => {
                if (replayIdx !== null) { setReplayIdx(null); return; }
                mulaiReplay.current?.();
              }}
              title={replayIdx !== null ? 'Keluar dari replay' : 'Mulai replay dari 60% data'}
              className={cn('flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors',
                replayIdx !== null
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100')}>
              <History className="size-3.5" /> Replay
              {replayIdx !== null && <span className="angka text-[10.5px]">bar {replayIdx + 1}</span>}
            </button>
          </div>
        </div>

        {galat && (
          <div className="flex items-start gap-2 border-t border-zinc-800/80 px-4 py-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <span className="text-[12.5px] text-amber-200/90">{galat}</span>
          </div>
        )}

        <div className="border-t border-zinc-800/80 px-2 pb-2">
          {lilin.times.length > 0
            ? <ChartLilin lilin={lilin} garis={garis} trade={replayIdx === null ? hasil?.trade : undefined}
                          tinggi={tampilSmi ? 680 : 560} hingga={replayIdx ?? undefined} smi={smi}
                          garisHarga={[...garisHarga, ...garisZona]}
                          onKlikBar={replayIdx === null ? undefined : setReplayIdx}
                          garisSeret={garisSeret}
                          onSeret={(id, h) => {
                            if (id === 'entry') entryDigeser.current = true;
                            seretTangan.current = true;
                            setRencana((r) => ({ ...r, [id]: h }));
                          }}
                          segmen={pine?.segmen}
                          penandaPine={pine?.penanda}
                          kotakPine={pine?.kotak}
                          mundur={DURASI_TF[tf] ? jamMundur(detik) : undefined}
                          hamparanBawah={kendaliReplay}
                          pojok={aksi ? (
                            <PojokOrder
                              posisi={aksi.posisi} hargaKini={aksi.hargaKini}
                              draf={draf} rencana={rencana} mode={aksi.mode}
                              jenis={labelJenis} risiko={aksi.risiko}
                              tunda={aksiTunda} onBatalTunda={aksi.batalTunda}
                              onGantiMode={(m) => { aksi.gantiMode(m); setKabarNyata(''); }}
                              onPilih={(arah) => {
                                setDraf(arah);
                                setKabarNyata('');
                                seretTangan.current = false;
                                /* Level yang SUDAH dipasang orangnya dipertahankan
                                   selama masih benar sisinya untuk arah ini.
                                   Menimpanya dengan usulan ATR akan membuang
                                   angka dari kartu screener yang baru saja
                                   diklik — dan itu justru alasan halaman ini
                                   dibuka. */
                                const e = rencana.entry ?? aksi.hargaKini;
                                const sisiBenar = e && rencana.sl && rencana.tp
                                  && (arah === 'BUY'
                                    ? rencana.sl < e && rencana.tp > e
                                    : rencana.sl > e && rencana.tp < e);
                                if (sisiBenar) { setRencana((r) => ({ ...r, entry: e })); return; }
                                const u = aksi.usul(arah);
                                if (u) setRencana({ entry: u.entry, sl: u.sl || undefined, tp: u.tp || undefined });
                              }}
                              onUbah={(r) => {
                                /* Entry yang DIKETIK sama sengajanya dengan
                                   yang diseret — dua-duanya keputusan, dan
                                   penyusul harga otomatis harus berhenti
                                   menimpanya. */
                                if (r.entry !== rencana.entry) entryDigeser.current = true;
                                setRencana(r);
                              }}
                              onBatal={() => { setDraf(null); setKabarNyata(''); }}
                              onKirim={() => {
                                const { entry, sl, tp } = rencana;
                                if (!draf || !entry || !sl || !tp) return;
                                if (aksi.mode === 'real') {
                                  /* Konfirmasi berisi angka ada DI DALAM
                                     kirimOrderNyata — jalur yang sama persis
                                     dengan Area Entry V2, termasuk pengaman
                                     simbol tanpa STOP_MARKET. */
                                  setSibukNyata(true); setKabarNyata('');
                                  void kirimOrderNyata({
                                    simbol, tf, arah: draf,
                                    modal: nyataSetelan.modal, leverage: nyataSetelan.leverage,
                                    entry: jenisEntry === 'MARKET' ? (aksi.hargaKini ?? entry) : entry,
                                    jenis: jenisEntry, sl, tp, metode: nyataSetelan.metode,
                                    emosi: catatanTiket.emosi, alasan: catatanTiket.alasan,
                                  }).then((h) => {
                                    setKabarNyata(h.pesan);
                                    if (h.pesan !== 'Dibatalkan.') { setDraf(null); setRencana({}); }
                                  }).catch((e) => {
                                    setKabarNyata(e instanceof Error ? e.message : 'Gagal mengirim order');
                                  }).finally(() => setSibukNyata(false));
                                  return;
                                }
                                aksi.kirim(draf, { entry, sl, tp }, jenisEntry, catatanTiket);
                                setDraf(null);
                              }}
                              nyataSetelan={nyataSetelan} aturNyata={setNyataSetelan}
                              demoSetelan={demoSetelan} aturDemo={setDemoSetelan}
                              catatan={catatanTiket} aturCatatan={setCatatanTiket}
                              sibukNyata={sibukNyata} kabar={kabarNyata || undefined}
                              onTutup={aksi.tutup} mati={aksi.mati} />
                          ) : undefined} />
            : <div className="flex h-[440px] items-center justify-center text-[12.5px] text-zinc-600">
                {memuat ? 'Memuat lilin…' : 'Tidak ada data untuk simbol ini.'}
              </div>}
        </div>
        <div className="border-t border-zinc-800/80 px-4 py-2.5 text-[11.5px] text-zinc-600">
          {lilin.times.length} lilin · {simbol} {TF.find((x) => x.nilai === tf)?.label} · lewat proxy VPS
          {hasil?.trade.length ? ` · ${hasil.trade.length} penanda trade` : ''}
        </div>

        {/* SELALU terpasang, tampil hanya saat dibuka. Efeknya tetap jalan
            meski tidak menggambar apa pun — itulah yang membuat tombol
            BUY/SELL di pojok chart tersedia sejak halaman dibuka. */}
        <div className={cn(replayIdx !== null ? 'border-t border-zinc-800/80' : 'hidden')}>
          <PanelReplay lilin={lilin} simbol={simbol} tf={tf} idx={replayIdx}
                       demoSetelan={demoSetelan}
                       setIdx={setReplayIdx} aturGaris={setGarisHarga}
                       aturAksi={setAksi} aturKendali={setKendaliReplay}
                       aturMulai={simpanMulai}
                       usulSl={usulSl} usulTp={usulTp}
                       tampil={replayIdx !== null}
                       tanpaBingkai />
        </div>
      </Panel>

      <PanelPine lilin={lilin} tf={tf} aturHasil={setPine} />

      {/* ── Setelan uji ── */}
      <Panel className="mt-4">
        <PanelHead
          judul="Backtest"
          sub="Dihitung dengan indikator yang sama persis dengan Screener Entry."
          kanan={
            <button onClick={jalankan} disabled={uji || lilin.closes.length < 60}
              className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
              {uji ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              Jalankan Backtest
            </button>
          }
        />
        <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4 xl:grid-cols-7">
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">Strategi</label>
            <select value={set.strategi} onChange={(e) => setSet({ ...set, strategi: e.target.value as Setelan['strategi'] })}
                    className={cn(KELAS_ISIAN, 'cursor-pointer')}>
              <option value="smi">SMI dari zona jenuh</option>
              <option value="ema">Silang EMA</option>
            </select>
          </div>
          {set.strategi === 'ema' && (
            <>
              <Angka label="EMA cepat" nilai={set.emaCepat} atur={(n) => setSet({ ...set, emaCepat: n })} min={2} />
              <Angka label="EMA lambat" nilai={set.emaLambat} atur={(n) => setSet({ ...set, emaLambat: n })} min={3} />
            </>
          )}
          <Angka label="SL (× ATR)" nilai={set.slAtr} atur={(n) => setSet({ ...set, slAtr: n })} langkah={0.1} />
          <Angka label="Risk : Reward" nilai={set.rr} atur={(n) => setSet({ ...set, rr: n })} langkah={0.5} />
          <Angka label="Modal ($)" nilai={set.modal} atur={(n) => setSet({ ...set, modal: n })} langkah={100} />
          <Angka label="Risiko / trade (%)" nilai={set.risikoPersen} atur={(n) => setSet({ ...set, risikoPersen: n })} langkah={0.25} />
          <Angka label="Biaya (%)" nilai={set.biayaPersen} atur={(n) => setSet({ ...set, biayaPersen: n })} langkah={0.01} />
        </div>

        {/* Asumsi ditulis di layar, bukan disembunyikan di kode. Backtest tanpa
            asumsi yang terbaca adalah angka tanpa arti. */}
        <div className="border-t border-zinc-800/80 px-5 py-3 text-[11.5px] leading-relaxed text-zinc-600">
          Entry di harga <span className="text-zinc-400">open lilin berikutnya</span> setelah sinyal, bukan di
          close lilin sinyalnya. SL/TP diperiksa terhadap high/low tiap lilin; kalau satu lilin menyentuh
          keduanya, yang dianggap kena adalah <span className="text-zinc-400">SL</span> — data lilin tidak tahu
          mana yang lebih dulu, dan menebak yang menguntungkan membuat setiap hasil terlalu bagus.
        </div>
      </Panel>

      {/* ── Hasil ── */}
      {hasil && (
        hasil.catatan ? (
          <Panel className="mt-4 px-5 py-6 text-center text-[12.5px] text-zinc-500">{hasil.catatan}</Panel>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <KartuKpi label="Total Trade" nilai={String(hasil.jumlah)}
                        catatan={`${hasil.menang} menang · ${hasil.kalah} kalah`} />
              <KartuKpi label="Winrate" nilai={persen(hasil.winrate)} catatan="dari transaksi selesai" />
              <KartuKpi label="P/L Bersih" nilai={uang(hasil.bersih, true)}
                        warna={hasil.bersih >= 0 ? 'text-emerald-500' : 'text-red-400'}
                        catatan={`modal ${uang(set.modal)} → ${uang(hasil.ekuitasAkhir)}`} />
              <KartuKpi label="Profit Factor"
                        nilai={hasil.faktorProfit === null ? '—' : hasil.faktorProfit === Infinity ? '∞' : hasil.faktorProfit.toFixed(2)}
                        catatan="gross profit / gross loss" />
              <KartuKpi label="Max Drawdown" nilai={`${hasil.drawdown.toFixed(1)}%`}
                        warna={hasil.drawdown > 10 ? 'text-red-400' : undefined}
                        catatan="penurunan terdalam dari puncak" />
            </div>

            <Panel className="mt-4">
              <PanelHead judul="Daftar Trade" sub={`${hasil.jumlah} transaksi — penandanya ikut tergambar di chart.`} />
              <div className="px-5 pb-5">
                <TabelBungkus className="max-h-[380px] overflow-y-auto">
                  <Tabel>
                    <thead className="sticky top-0 bg-zinc-950">
                      <tr>
                        <Th>#</Th><Th>Masuk</Th><Th>Arah</Th>
                        <Th className="text-right">Entry</Th><Th className="text-right">Keluar</Th>
                        <Th>Sebab</Th><Th className="text-right">P/L</Th><Th className="text-right">Ekuitas</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {hasil.trade.map((t) => (
                        <Tr key={t.no}>
                          <Td className="angka text-zinc-600">{t.no}</Td>
                          <Td className="whitespace-nowrap text-zinc-500">{tanggalPendek(t.masukWaktu)}</Td>
                          <Td><span className={cn('text-[11.5px]', t.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>{t.arah}</span></Td>
                          <Td className="angka text-right text-zinc-400">{harga(t.masuk)}</Td>
                          <Td className="angka text-right text-zinc-400">{harga(t.keluar)}</Td>
                          <Td><span className={cn('rounded px-1.5 py-0.5 text-[10px]',
                            t.sebab === 'TP' ? 'bg-emerald-500/10 text-emerald-500'
                              : t.sebab === 'SL' ? 'bg-red-500/10 text-red-400'
                              : 'bg-zinc-800 text-zinc-400')}>{t.sebab}</span></Td>
                          <Td className={cn('angka text-right', t.pnl >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                            {uang(t.pnl, true)}
                          </Td>
                          <Td className="angka text-right text-zinc-300">{uang(t.ekuitas)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Tabel>
                </TabelBungkus>
              </div>
            </Panel>
          </>
        )
      )}

      {/* Batas yang diakui terbuka — supaya tidak ada yang mengira EA MT5-nya
          bisa diuji di sini lalu kecewa setelah mencoba. */}
      <Panel className="mt-4 px-5 py-4">
        <div className="text-[12.5px] text-zinc-400">Menguji EA MetaTrader 5</div>
        <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">
          Backtest di halaman ini berjalan untuk pasar kripto lewat proxy VPS. Menguji Expert Advisor
          MetaTrader butuh Strategy Tester MT5, yang berjalan di Windows dan tidak bisa dijalankan dari
          halaman web — jalurnya adalah VPS Windows tersendiri yang menjalankan MT5 plus jembatan
          perintah. Itu tahap berikutnya, bukan sesuatu yang tersembunyi di balik tombol ini.
        </p>
      </Panel>
    </div>
  );
}
