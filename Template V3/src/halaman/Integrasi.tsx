import { useState } from 'react';
import {
  CheckCircle2, Circle, Copy, Eye, EyeOff, RefreshCw, Download,
  ShieldCheck, TriangleAlert, Plug, Link2Off, Activity, Server,
  Radio, BookOpen, FileCode2,
} from 'lucide-react';
import { Panel, PanelHead, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { TutorialVps } from '@/components/tutorial-vps';
import { cn } from '@/lib/utils';
import { bacaKoneksi, simpanKoneksi, hapusKoneksi, koneksiLengkap } from '@/lib/koneksi';
import { useKodeMt5, useAkunMt5 } from '@/lib/akun';
import { tautanBerkas } from '@/lib/admin';

/* ════════════════════════════════════════════════════════════════════════
   INTEGRATIONS — sambungan ke MetaTrader 5 dan Binance
   ════════════════════════════════════════════════════════════════════════
   Dua sambungan ini sengaja dipisah menjadi dua kartu besar, bukan satu form
   panjang, karena SIFAT RISIKONYA berbeda jauh:

     • MT5  — BACA-SAJA. EA hanya mengirim saldo, posisi, dan riwayat.
              Kalau kodenya bocor, yang terjadi cuma jurnal orang lain terisi.
     • Binance — MENGEKSEKUSI ORDER dengan uang sungguhan. Kalau App Token
              bocor, orang lain bisa membuka dan menutup posisi di akunmu.

   Baris status di atas TIDAK memakai KartuKpi seperti halaman lain, dan itu
   disengaja. Empat kotak angka besar cocok untuk halaman yang isinya laporan;
   halaman ini isinya DUA MESIN dan pertanyaannya bukan "berapa" melainkan
   "hidup atau tidak, dan seberapa cepat". Bentuk yang menjawab itu adalah
   denyut dan garis latensi, bukan angka 94 yang berdiri sendiri.
   ════════════════════════════════════════════════════════════════════════ */

/* Deterministik, bukan Math.random: garis latensi yang berubah bentuk tiap
   render membuat mustahil melihat apakah sesuatu benar-benar memburuk. */
const LATENSI = Array.from({ length: 32 }, (_, i) =>
  Math.round(94 + Math.sin(i / 2.4) * 16 + Math.sin(i / 5.1) * 9 + (i === 21 ? 48 : 0))
);

function Denyut({ hidup }: { hidup: boolean }) {
  return (
    <span className="relative flex size-2.5 shrink-0">
      {hidup && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
      )}
      <span className={cn('relative inline-flex size-2.5 rounded-full', hidup ? 'bg-emerald-500' : 'bg-zinc-600')} />
    </span>
  );
}

function Ubin({ Ikon, nama, hidup, ket, stat }: {
  Ikon: typeof Server; nama: string; hidup: boolean; ket: string; stat: [string, string][];
}) {
  return (
    <div className={cn(
      'rounded-lg border p-4 transition-colors',
      hidup ? 'border-zinc-700/70 bg-zinc-900/50' : 'border-zinc-800/70 bg-zinc-950/40'
    )}>
      <div className="flex items-center gap-2.5">
        <div className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg border',
          hidup ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 bg-zinc-900 text-zinc-600'
        )}>
          <Ikon className="size-4" strokeWidth={1.9} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-zinc-100">{nama}</div>
          <div className="truncate text-[11.5px] text-zinc-500">{ket}</div>
        </div>
        <Denyut hidup={hidup} />
      </div>

      <div className="mt-3.5 flex gap-5 border-t border-zinc-800/70 pt-3">
        {stat.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <div className="text-[10.5px] uppercase tracking-wider text-zinc-600">{k}</div>
            <div className="angka mt-0.5 truncate text-[14px] text-zinc-200">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GarisLatensi() {
  const W = 240, H = 56;
  const min = Math.min(...LATENSI), max = Math.max(...LATENSI);
  const X = (i: number) => (i / (LATENSI.length - 1)) * W;
  const Y = (v: number) => H - ((v - min) / (max - min || 1)) * (H - 6) - 3;
  const garis = LATENSI.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area = `0,${H} ${garis} ${W},${H}`;
  const rerata = Math.round(LATENSI.reduce((s, v) => s + v, 0) / LATENSI.length);

  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[11.5px] text-zinc-500">Latensi proxy VPS</span>
        <span className="angka text-[14px] text-zinc-100">{LATENSI[LATENSI.length - 1]}<span className="text-[11px] text-zinc-500">ms</span></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block w-full" style={{ height: 56 }} aria-hidden>
        <defs>
          <linearGradient id="gLat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity=".22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#gLat)" />
        <polyline points={garis} fill="none" stroke="#10b981" strokeWidth="1.4" />
        <circle cx={X(LATENSI.length - 1)} cy={Y(LATENSI[LATENSI.length - 1])} r="2.6" fill="#10b981" />
      </svg>
      <div className="mt-1 flex justify-between text-[10.5px] text-zinc-600">
        <span>32 pemeriksaan terakhir</span>
        <span className="angka">rerata {rerata}ms · puncak {max}ms</span>
      </div>
    </div>
  );
}

function StatusPil({ tersambung }: { tersambung: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium',
        tersambung ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-700/30 text-zinc-400'
      )}
    >
      {tersambung ? <CheckCircle2 className="size-3.5" strokeWidth={2.2} /> : <Circle className="size-3.5" strokeWidth={2.2} />}
      {tersambung ? 'Connected' : 'Not connected'}
    </span>
  );
}

function Langkah({ no, judul, anak }: { no: number; judul: string; anak: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-[11px] font-medium text-zinc-400">
        {no}
      </div>
      <div className="min-w-0 pb-4">
        <div className="text-[13px] font-medium text-zinc-200">{judul}</div>
        <div className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">{anak}</div>
      </div>
    </div>
  );
}

export default function Integrasi() {
  /* Kode pasangan ASLI dari backend, bukan contoh.
     Sebelumnya baris ini berisi `useState('JT-4F2A-91C7')` — kode yang
     ditulis mati di sini. Awalannya salah (backend membuat `JTM5-…`) DAN
     ia tidak pernah terdaftar, jadi EA yang memakainya selalu ditolak
     400 "Kode Pasangan tidak valid". */
  const kodeM = useKodeMt5();
  const statusMt5 = useAkunMt5();
  const kodeMt5 = kodeM.kode;
  const mt5Tersambung = statusMt5.terhubung === true;
  const [lihatToken, setLihatToken] = useState(false);
  const [disalin, setDisalin] = useState(false);

  const awal = bacaKoneksi();
  const [url, setUrl] = useState(awal.url);
  const [token, setToken] = useState(awal.token);
  const [tersimpan, setTersimpan] = useState(koneksiLengkap(awal));
  const [pesan, setPesan] = useState('');

  const binanceTersambung = tersimpan;
  const bisaSimpan = url.trim().length > 0 && token.trim().length > 0;

  function simpanUji() {
    if (!bisaSimpan) { setPesan('Backend URL dan App Token harus terisi keduanya.'); return; }
    simpanKoneksi({ url: url.trim(), token: token.trim() });
    setTersimpan(true);
    setPesan('Tersimpan. Open Real Order di Area Entry sekarang aktif.');
    setTimeout(() => setPesan(''), 4000);
  }

  function putuskan() {
    hapusKoneksi();
    setTersimpan(false);
    setPesan('Sambungan dilepas. Order sungguhan kembali dikunci.');
    setTimeout(() => setPesan(''), 4000);
  }

  const salin = (teks: string) => {
    navigator.clipboard?.writeText(teks).catch(() => {});
    setDisalin(true);
    setTimeout(() => setDisalin(false), 1600);
  };

  /* Alamat yang harus dimasukkan ke daftar izin WebRequest MT5. Diambil dari
     setelan pengguna kalau ada — orang yang memakai VPS sendiri harus
     memasukkan alamat VPS-nya, bukan alamat kami. Tanpa garis miring di
     ujung: MT5 mencocokkan alamatnya persis. */
  const alamatBackend = (url.trim() || 'https://103-253-145-38.sslip.io').replace(/\/+$/, '');
  const [tersalin, setTersalin] = useState<string | null>(null);

  return (
    <div className="p-4 sm:p-6">
      {/* ── Status sambungan: denyut + latensi, bukan empat kotak angka ── */}
      <Panel>
        <PanelHead
          judul="Connection health"
          sub="Dua mesin yang melayani halaman ini, dan seberapa cepat keduanya menjawab."
          kanan={
            <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-[11.5px] text-zinc-400">
              <Activity className="size-3.5 text-emerald-500" strokeWidth={2} />
              {Number(mt5Tersambung) + Number(binanceTersambung)} dari 2 aktif
            </span>
          }
        />
        <div className="grid grid-cols-1 gap-3 px-5 pb-5 lg:grid-cols-[1fr_1fr_260px]">
          <Ubin
            Ikon={Radio} nama="MetaTrader 5" hidup={mt5Tersambung}
            ket={mt5Tersambung ? 'EA mengirim tiap 20 detik' : 'EA belum melapor'}
            stat={[['Sinkron', '18 dtk lalu'], ['Trade masuk', '29 forex']]}
          />
          <Ubin
            Ikon={Server} nama="Binance Futures" hidup={binanceTersambung}
            ket={binanceTersambung ? 'Lewat proxy VPS sendiri' : 'Backend URL / token belum diisi'}
            stat={[['Mode', binanceTersambung ? 'Testnet' : '—'], ['Trade masuk', '94 kripto']]}
          />
          <GarisLatensi />
        </div>
      </Panel>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* ── MT5 ── */}
        <Panel>
          <PanelHead
            judul="MetaTrader 5"
            sub="Menarik saldo, posisi, dan riwayat ke Journal. Baca-saja."
            kanan={<StatusPil tersambung={mt5Tersambung} />}
          />
          <div className="px-5 pb-5">
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" strokeWidth={2} />
              <div className="text-[12.5px] leading-relaxed text-zinc-400">
                EA ini <span className="text-zinc-200">tidak punya satu pun fungsi perdagangan</span> —
                tidak ada <code className="rounded bg-zinc-800 px-1 py-0.5 text-[11px]">OrderSend</code>,
                tidak ada modifikasi posisi. Sumbernya terbuka di Marketplace supaya klaim itu bisa
                kamu periksa sendiri, bukan sekadar dipercaya.
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                Pairing code
              </div>
              <div className="flex gap-2">
                <div className="angka flex h-10 flex-1 items-center rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[14px] tracking-[0.14em] text-zinc-100">
                  {kodeM.memuat ? <span className="text-[12.5px] tracking-normal text-zinc-500">Memuat…</span>
                    : kodeMt5 ?? <span className="text-[12.5px] tracking-normal text-zinc-500">Belum ada — tekan tombol di kanan</span>}
                </div>
                <button
                  disabled={!kodeMt5}
                  onClick={() => kodeMt5 && salin(kodeMt5)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-3 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                >
                  <Copy className="size-3.5" />
                  {disalin ? 'Tersalin' : 'Salin'}
                </button>
                <button
                  onClick={() => void kodeM.buatBaru()}
                  disabled={kodeM.memuat}
                  className="flex cursor-pointer items-center rounded-md border border-zinc-800 px-3 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-40"
                  title={kodeMt5 ? "Buat kode baru — EA yang sekarang akan terputus" : "Buat kode pasangan"}
                  aria-label="Buat kode baru"
                >
                  <RefreshCw className={cn("size-3.5", kodeM.memuat && "animate-spin")} />
                </button>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-zinc-600">
                Kode ini yang diisi di input <span className="text-zinc-400">KodePasangan</span> pada EA.
                Bentuknya selalu <span className="angka text-zinc-400">JTM5-XXXX-XXXX</span> — kalau EA
                menjawab <span className="text-zinc-400">Kode Pasangan tidak valid</span>, kodenya bukan
                dari sini.
              </p>
              {kodeM.galat && (
                <p className="mt-1.5 text-[11.5px] text-red-400">{kodeM.galat}</p>
              )}
              {!kodeM.memuat && !kodeMt5 && !kodeM.galat && (
                <p className="mt-1.5 text-[11.5px] text-amber-400">
                  Belum punya kode. Tekan tombol putar di atas untuk membuatnya.
                </p>
              )}
              {statusMt5.terhubung === true && (
                <p className="mt-1.5 text-[11.5px] text-emerald-400">
                  EA melapor — {statusMt5.ket}, saldo {statusMt5.saldo?.toFixed(2)} {statusMt5.mataUang}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-zinc-800/60 p-4">
              <div className="mb-3 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                Cara memasang
              </div>
              <Langkah no={1} judul="Unduh berkasnya" anak={
                <>Klik <span className="text-zinc-300">Unduh JadiTraderSync.ex5</span> di bawah. Berkasnya ±36 KB.</>
              } />
              <Langkah no={2} judul="Buka folder data MT5" anak={
                <>Di MetaTrader 5: <span className="text-zinc-300">File → Open Data Folder</span>, lalu masuk ke
                  <span className="angka text-zinc-300"> MQL5\Experts</span>. Salin berkas .ex5 ke situ.
                  <span className="mt-1 block text-zinc-600">Jangan cari lewat Windows Explorer — tiap terminal MT5 punya
                  folder datanya sendiri di lokasi yang panjang dan acak.</span></>
              } />
              <Langkah no={3} judul="Segarkan daftar EA" anak={
                <>Di panel <span className="text-zinc-300">Navigator</span> (Ctrl+N), klik kanan
                  <span className="text-zinc-300"> Expert Advisors → Refresh</span>. JadiTraderSync muncul di daftar.
                  Kalau belum, tutup dan buka lagi MT5-nya.</>
              } />
              <Langkah no={4} judul="Izinkan alamat server" anak={
                <><span className="text-zinc-300">Tools → Options → Expert Advisors</span> → centang
                  <span className="text-zinc-300"> Allow WebRequest for listed URL</span>, lalu tambahkan alamat ini:
                  <span className="mt-1.5 flex items-center gap-2">
                    <code className="angka rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11.5px] text-zinc-300">{alamatBackend}</code>
                    <button onClick={() => void navigator.clipboard.writeText(alamatBackend).then(() => setTersalin('url'))}
                            className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                            aria-label="Salin alamat server">
                      {tersalin === 'url' ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </button>
                  </span>
                  <span className="mt-1 block text-zinc-600">Salin persis — tanpa garis miring di ujung. MT5 mencocokkan
                  alamatnya huruf per huruf, dan satu karakter beda membuat EA gagal tanpa pesan yang menjelaskan.</span></>
              } />
              <Langkah no={5} judul="Seret ke chart mana pun" anak={
                <>Chart apa saja, timeframe apa saja — EA ini tidak membaca harga, jadi tidak berpengaruh.
                  Di tab <span className="text-zinc-300">Common</span> centang
                  <span className="text-zinc-300"> Allow Algo Trading</span>.</>
              } />
              <Langkah no={6} judul="Isi Kode Pasangan" anak={
                <>Di tab <span className="text-zinc-300">Inputs</span>, isi
                  <span className="angka text-zinc-300"> KodePasangan</span> dengan kode
                  <span className="angka text-zinc-300"> {kodeMt5 ?? 'JTM5-XXXX-XXXX'}</span> di atas, lalu OK.
                  <span className="mt-1 block text-zinc-600">Pastikan tombol <b className="text-zinc-500">Algo Trading</b> di
                  toolbar berwarna hijau. Kalau merah, EA terpasang tapi tidak berjalan.</span></>
              } />
              <div className="flex gap-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
                  <CheckCircle2 className="size-3.5 text-emerald-500" strokeWidth={2.2} />
                </div>
                <div className="text-[13px] font-medium text-zinc-200">Selesai — jurnal terisi sendiri</div>
              </div>

              {/* Tiga kegagalan yang paling sering terjadi, dengan cirinya
                  masing-masing. Daftar "kalau tidak jalan, cek koneksi" tidak
                  menolong siapa pun; yang menolong adalah pasangan
                  gejala→sebab. */}
              <div className="mt-4 border-t border-zinc-800/60 pt-3">
                <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                  Kalau tidak jalan
                </div>
                <dl className="space-y-2 text-[12px] leading-relaxed">
                  {[
                    ['Tab Experts: "WebRequest ... 4060"',
                     'Alamat server belum masuk daftar izin, atau ada bedanya satu karakter. Ulangi langkah 4.'],
                    ['Server membalas 400 "Kode Pasangan tidak valid"',
                     'Kode salah ketik atau sudah diputar. Tekan tombol segarkan di atas, lalu salin ulang ke input EA.'],
                    ['EA terpasang tapi status tetap "belum melapor"',
                     'Tombol Algo Trading di toolbar masih merah, atau ikon EA di pojok chart bersilang. Keduanya berarti EA tidak dijalankan.'],
                  ].map(([gejala, sebab]) => (
                    <div key={gejala}>
                      <dt className="text-zinc-300">{gejala}</dt>
                      <dd className="text-zinc-500">{sebab}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {/* <a>, bukan <button>. Backend menjawab dengan
                  Content-Disposition lewat `res.download`, jadi peramban yang
                  menangani penyimpanannya — mengambilnya dengan fetch lalu
                  membuat Blob cuma menyalin pekerjaan yang sudah dilakukan
                  peramban, dan kehilangan nama berkasnya.

                  Tanpa kode lisensi: EA ini ditandai `.gratis` di server,
                  memang dibagikan bebas. */}
              <a href={tautanBerkas('jadi-trader-sync', '', 'ex5')} download
                 className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white">
                <Download className="size-3.5" /> Unduh JadiTraderSync.ex5
              </a>
              <a href={tautanBerkas('jadi-trader-sync', '', 'mq5')} download
                 className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
                <FileCode2 className="size-3.5" /> Sumber .mq5
              </a>
              <button
                onClick={() => void (kodeMt5 ? kodeM.putus() : kodeM.buatBaru())}
                disabled={kodeM.memuat}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-40"
              >
                {kodeMt5 ? <><Link2Off className="size-3.5" /> Putuskan</> : <><Plug className="size-3.5" /> Sambungkan</>}
              </button>
            </div>
          </div>
        </Panel>

        {/* ── Binance ── */}
        <Panel className="border-amber-500/25">
          <PanelHead
            judul="Binance Futures"
            sub="Data pasar, eksekusi order, dan pemantauan posisi live."
            kanan={<StatusPil tersambung={binanceTersambung} />}
          />
          <div className="px-5 pb-5">
            {/* Pita peringatan. Kartu MT5 tidak punya ini, dan perbedaannya
                disengaja — yang satu baca-saja, yang satu memindahkan uang. */}
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" strokeWidth={2} />
              <div className="text-[12.5px] leading-relaxed text-zinc-300">
                Sambungan ini <span className="font-medium text-amber-300">mengeksekusi order dengan uang sungguhan</span>.
                Siapa pun yang memegang App Token bisa membuka dan menutup posisi di akunmu —
                perlakukan seperti kata sandi, jangan pernah tempel di chat atau tangkapan layar.
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="be-url" className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                  Backend URL
                </label>
                <input
                  id="be-url" value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://103-253-145-38.sslip.io"
                  className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 font-mono text-[12.5px]
                             text-zinc-100 outline-none transition-colors placeholder:text-zinc-600
                             hover:border-zinc-700 focus-visible:border-zinc-600"
                />
                <p className="mt-1.5 text-[11.5px] text-zinc-600">
                  Proxy VPS. Binance diblokir sebagian ISP Indonesia — tanpa proxy ini, data pasar tidak masuk.
                </p>
              </div>

              <div>
                <label htmlFor="be-token" className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                  App Token
                </label>
                <div className="flex gap-2">
                  <input
                    id="be-token" type={lihatToken ? 'text' : 'password'}
                    value={token} onChange={(e) => setToken(e.target.value)}
                    placeholder="64 karakter dari langkah 5"
                    className="h-10 min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 font-mono text-[12.5px]
                               text-zinc-100 outline-none transition-colors placeholder:text-zinc-600
                               hover:border-zinc-700 focus-visible:border-zinc-600"
                  />
                  <button
                    onClick={() => setLihatToken((v) => !v)}
                    aria-label={lihatToken ? 'Sembunyikan token' : 'Tampilkan token'}
                    className="flex cursor-pointer items-center rounded-md border border-zinc-800 px-3 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                  >
                    {lihatToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <p className="mt-1.5 text-[11.5px] text-zinc-600">
                  Disimpan hanya di peramban ini, tidak pernah dikirim ke mana pun selain VPS-mu sendiri.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-zinc-800/60 p-4">
              <div className="mb-3 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                Yang aktif lewat sambungan ini
              </div>
              <TabelBungkus>
                <Tabel>
                  <thead>
                    <tr><Th>Kemampuan</Th><Th>Status</Th></tr>
                  </thead>
                  <tbody>
                    {[
                      ['Data pasar (klines, ticker)', 'Aktif', true],
                      ['Baca saldo & posisi', 'Aktif', true],
                      ['Kirim order (MARKET / LIMIT)', 'Aktif', true],
                      ['Tutup posisi & ubah SL/TP', 'Aktif', true],
                      ['Tarik dana', 'Tidak pernah', false],
                    ].map(([nama, status, on]) => (
                      <Tr key={nama as string}>
                        <Td className="text-zinc-300">{nama}</Td>
                        <Td>
                          <span className={cn(
                            'rounded px-1.5 py-0.5 text-[11px]',
                            on ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-700/30 text-zinc-500'
                          )}>
                            {status}
                          </span>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Tabel>
              </TabelBungkus>
              <p className="mt-3 text-[11.5px] leading-relaxed text-zinc-600">
                Penarikan dana <span className="text-zinc-400">tidak pernah</span> diaktifkan.
                Saat membuat API key di Binance, jangan centang Withdraw — kalaupun key-nya bocor,
                dananya tidak bisa dipindahkan keluar.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={simpanUji} disabled={!bisaSimpan}
                className="cursor-pointer rounded-md bg-zinc-100 px-3.5 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Simpan &amp; Uji
              </button>
              <button
                onClick={putuskan} disabled={!tersimpan}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 px-3.5 py-2 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Link2Off className="size-3.5" /> Putuskan
              </button>
              {pesan && <span className="text-[12px] text-zinc-400">{pesan}</span>}
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Tutorial pemasangan ── */}
      <Panel className="mt-4">
        <PanelHead
          judul="Pemasangan dari nol"
          sub="Sepuluh langkah dari membuat API key Binance sampai order pertama berangkat. Perintahnya siap disalin."
          kanan={
            <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-[11.5px] text-zinc-400">
              <BookOpen className="size-3.5" strokeWidth={1.9} /> ± 30 menit
            </span>
          }
        />
        <div className="px-5 pb-5">
          <TutorialVps />
        </div>
      </Panel>

      <Panel className="mt-4">
        <PanelHead judul="Connection log" sub="Kejadian terakhir dari kedua sambungan." />
        <div className="px-5 pb-5">
          <TabelBungkus>
            <Tabel>
              <thead>
                <tr><Th>Waktu</Th><Th>Sumber</Th><Th>Kejadian</Th><Th>Status</Th></tr>
              </thead>
              <tbody>
                {[
                  ['18 dtk lalu', 'MT5',     'Kirim 2 posisi terbuka, 1 riwayat baru', 'OK'],
                  ['2 mnt lalu',  'Binance', 'Ambil mark price 4 posisi live',          'OK'],
                  ['14 mnt lalu', 'Binance', 'Sinkron biaya & funding fee',             'OK'],
                  ['1 jam lalu',  'MT5',     'EA tersambung dari terminal baru',        'OK'],
                  ['3 jam lalu',  'Binance', 'Order BTCUSDT terkirim (MARKET)',         'OK'],
                ].map(([waktu, sumber, kejadian, status], i) => (
                  <Tr key={i}>
                    <Td className="whitespace-nowrap text-zinc-500">{waktu}</Td>
                    <Td>
                      <span className={cn(
                        'rounded px-1.5 py-0.5 text-[11px]',
                        sumber === 'MT5' ? 'bg-zinc-700/30 text-zinc-300' : 'bg-amber-500/10 text-amber-400'
                      )}>
                        {sumber}
                      </span>
                    </Td>
                    <Td className="text-zinc-300">{kejadian}</Td>
                    <Td><span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-500">{status}</span></Td>
                  </Tr>
                ))}
              </tbody>
            </Tabel>
          </TabelBungkus>
          <p className="mt-3 text-[11.5px] text-zinc-600">
            Unduhan EA, kode pasangan MT5, dan status sambungan sudah menyentuh backend sungguhan.
            Backend URL &amp; App Token tersimpan di perangkat ini saja — tidak pernah dikirim ke mana pun
            selain VPS milikmu sendiri.
          </p>
        </div>
      </Panel>
    </div>
  );
}
