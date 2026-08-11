import { useEffect, useMemo, useState } from 'react';
import { Play, Loader2, RefreshCw, Radio, TriangleAlert } from 'lucide-react';
import { Panel, PanelHead, KartuKpi, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen, harga, tanggalPendek } from '@/lib/utils';
import { ChartLilin, type Garis } from '@/components/chart-lilin';
import { ambilKlines, type Lilin } from '@/lib/pasar';
import { jalankanUji, garisIndikator, SETELAN_BAWAAN, type Setelan, type HasilUji } from '@/lib/backtest';
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
  const [simbol, setSimbol] = useState('BTCUSDT');
  const [tf, setTf] = useState('4h');
  const [lilin, setLilin] = useState<Lilin>({ opens: [], highs: [], lows: [], closes: [], times: [] });
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [segar, setSegar] = useState(0);
  const [set, setSet] = useState<Setelan>(SETELAN_BAWAAN);
  const [hasil, setHasil] = useState<HasilUji | null>(null);
  const [uji, setUji] = useState(false);

  /* ── Data realtime ──────────────────────────────────────────────────
     Ditarik ulang tiap 15 detik, sama dengan umur cache di lib/pasar.ts —
     memintanya lebih sering hanya akan menerima salinan cache yang sama. */
  useEffect(() => {
    let hidup = true;
    async function tarik() {
      try {
        const l = await ambilKlines(simbol, tf, 500);
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
    const jam = setInterval(tarik, 15_000);
    return () => { hidup = false; clearInterval(jam); };
  }, [simbol, tf, segar]);

  /* Hasil backtest DIBUANG saat simbol/timeframe/setelan berubah. Tabel
     trade dari BTC 4 jam yang masih terpampang di bawah chart ETH 5 menit
     adalah cara paling halus untuk salah membaca hasil. */
  useEffect(() => { setHasil(null); }, [simbol, tf, set]);

  const garis: Garis[] = useMemo(() => {
    if (set.strategi !== 'ema' || !lilin.closes.length) return [];
    const g = garisIndikator(lilin, set);
    return [
      { nama: `EMA ${set.emaCepat}`, nilai: g.cepat ?? [], warna: '#fbbf24' },
      { nama: `EMA ${set.emaLambat}`, nilai: g.lambat ?? [], warna: '#60a5fa' },
    ];
  }, [lilin, set]);

  const terakhir = lilin.closes[lilin.closes.length - 1];
  const sebelumnya = lilin.closes[lilin.closes.length - 2];
  const gerak = terakhir && sebelumnya ? ((terakhir - sebelumnya) / sebelumnya) * 100 : 0;

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
            <input list="simbolChart" value={simbol}
                   onChange={(e) => setSimbol(e.target.value.toUpperCase())}
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
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className={cn('flex items-center gap-1.5 text-[11px]', memuat ? 'text-zinc-600' : 'text-emerald-500')}>
              <Radio className="size-3" /> {memuat ? 'memuat' : 'live · 15 dtk'}
            </span>
            <button onClick={() => setSegar((n) => n + 1)}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
              <RefreshCw className={cn('size-3.5', memuat && 'animate-spin')} /> Segarkan
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
            ? <ChartLilin lilin={lilin} garis={garis} trade={hasil?.trade} tinggi={440} />
            : <div className="flex h-[440px] items-center justify-center text-[12.5px] text-zinc-600">
                {memuat ? 'Memuat lilin…' : 'Tidak ada data untuk simbol ini.'}
              </div>}
        </div>
        <div className="border-t border-zinc-800/80 px-4 py-2.5 text-[11.5px] text-zinc-600">
          {lilin.times.length} lilin · {simbol} {TF.find((x) => x.nilai === tf)?.label} · lewat proxy VPS
          {hasil?.trade.length ? ` · ${hasil.trade.length} penanda trade` : ''}
        </div>
      </Panel>

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
