import { useEffect, useMemo, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { Wallet, Percent, TrendingUp, Scale, Clock } from 'lucide-react';
import { Panel, PanelHead, KartuKpi, BadgeTren, TipGrafik, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen, harga, tanggalPendek } from '@/lib/utils';
import { statGabungan, statPer, plPerBulan, saldoDuaBulan, type Bulan } from '@/lib/hitung';

import { useRiwayat, usePosisi, useSaldoAwal, terbitkanRingkasan } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { useHargaPasar } from '@/lib/harga';
import { LabelContoh, SpandukContoh } from '@/components/gerbang';
import { useAkunMt5, useAkunBinance } from '@/lib/akun';
import { useArusKas, arusBersih } from '@/lib/tulis-jurnal';
import { PanelEvaluasi } from '@/components/panel-evaluasi';

/* ════════════════════════════════════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════════════════════════════════════
   Kerangka Efferd dipertahankan persis — empat KPI, dua grafik, tiga panel
   bawah. Yang diganti isinya:

     Active users / Revenue / Conversion / New signups
       -> Total Saldo / Winrate / P/L Bersih / Profit Factor  (kripto + tradefi)
     Net revenue     -> Hasil trading bulanan
     Channel sales   -> Saldo bulan lalu vs bulan ini, per tanggal
     Recent invoices -> Posisi terbuka kripto
     Billing health  -> Order terbuka MT5 (trade-fi)
     Activity        -> tetap, tapi khusus aktivitas pengguna ini
   ════════════════════════════════════════════════════════════════════════ */

/** Waktu relatif. Stempel mentah ("1786106780000") tidak berarti apa-apa
 *  bagi pembaca; yang ingin diketahui adalah seberapa baru kejadiannya. */
function lalu(ms: number) {
  if (!ms) return '';
  const d = Math.max(0, Date.now() - ms);
  const menit = Math.floor(d / 60_000);
  if (menit < 1) return 'baru saja';
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  return hari < 30 ? `${hari} hari lalu` : tanggalPendek(ms);
}


/* Tooltip bulanan: total DAN rinciannya per jurnal.
   ──────────────────────────────────────────────────────────────────────
   Ditulis sendiri, bukan memakai TipUang bersama, karena yang perlu
   dijawab di sini adalah pertanyaan yang cuma muncul di panel ini:
   "kenapa angkanya beda dengan kalender jurnal saya?" */
function TipBulan({ active, payload }: { active?: boolean; payload?: { payload: Bulan }[] }) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  const baris = (nama: string, n: number) => (
    <div className="flex items-center justify-between gap-6">
      <span className="text-zinc-500">{nama}</span>
      <span className={cn('angka', n >= 0 ? 'text-emerald-500' : 'text-red-400')}>{uang(n, true)}</span>
    </div>
  );
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/95 px-3 py-2 text-[12px] shadow-lg backdrop-blur-sm">
      <div className="mb-1.5 text-zinc-300">{b.bulan} · {b.trade} transaksi</div>
      {baris('Trade-Fi', b.forex)}
      {baris('Kripto', b.kripto)}
      <div className="mt-1.5 border-t border-zinc-800 pt-1.5">{baris('Gabungan', b.pnl)}</div>
    </div>
  );
}

export function Dashboard() {
  const { data: RIWAYAT, contoh } = useRiwayat();
  const { data: posisiMentah, pending: ORDER_PENDING } = usePosisi();
  const hargaPasar = useHargaPasar(posisiMentah.map((p) => p.simbol));
  const POSISI_TERBUKA = posisiMentah.map((p) => ({ ...p, hargaKini: hargaPasar[p.simbol] ?? p.hargaKini }));
  const saldoAwal = useSaldoAwal();

  /* SETORAN & PENARIKAN ikut dihitung, persis seperti di halaman Jurnal.
     ──────────────────────────────────────────────────────────────────────
     Jurnal memakai `saldoAwal + arusBersih(...)` sebagai modal; dashboard
     dulu hanya `saldoAwal`. Begitu ada satu setoran saja, kedua halaman
     langsung berselisih — dan selisihnya terbaca sebagai "dashboardnya
     tidak sinkron", padahal keduanya benar menurut rumusnya masing-masing.

     Arus kas dibebankan ke sumbernya sendiri, sama seperti di Jurnal:
     setoran MT5 tidak boleh menaikkan saldo kripto. */
  const { data: arus } = useArusKas();
  const arusForex = arusBersih(arus, 'forex');
  const arusKripto = arusBersih(arus, 'kripto');
  const modalTotal = saldoAwal + arusForex + arusKripto;

  const stat = statGabungan(RIWAYAT, modalTotal);
  /* Rincian dari daftar yang SAMA dengan totalnya. Dashboard adalah
     penjumlahan jurnal Trade-Fi dan Kripto — kalau ketiganya tidak berasal
     dari satu array, angkanya pasti berselisih cepat atau lambat. */
  /* Saldo awal dibebankan ke Trade-Fi saja, PERSIS seperti di halaman Jurnal.
     Kalau dibebankan ke keduanya ia terhitung dua kali, dan penjumlahan dua
     jurnal tidak akan pernah sama dengan total di dashboard. */
  const forex = statPer(RIWAYAT, 'forex', saldoAwal + arusForex);
  const kripto = statPer(RIWAYAT, 'kripto', arusKripto);

  /* Bulan dan kurva saldo DIHITUNG dari transaksi, tidak lagi dari daftar
     yang ditulis tangan di data/porto.ts. Daftar itu berisi Maret–Agustus
     dengan angka karangan, jadi akun yang transaksinya baru mulai bulan ini
     tetap menampilkan lima bulan riwayat yang tidak pernah terjadi. */
  const perBulan = useMemo(() => plPerBulan(RIWAYAT), [RIWAYAT]);

  const bulanIni = perBulan[perBulan.length - 1];
  const bulanLalu = perBulan[perBulan.length - 2];
  /* Tanpa bulan pembanding, tren tidak bisa dihitung — dan menampilkan 0%
     akan terbaca sebagai "tidak berubah", bukan "belum ada pembandingnya". */
  const trenBulan = bulanIni && bulanLalu && Math.abs(bulanLalu.pnl) > 0.005
    ? Number((((bulanIni.pnl - bulanLalu.pnl) / Math.abs(bulanLalu.pnl)) * 100).toFixed(1))
    : null;

  /* Posisi MT5 NYATA dari EA, bukan tiga baris contoh yang ditulis di
     data/porto.ts. Profitnya sudah dikonversi dari akun sen di lib/akun.ts. */
  const mt5 = useAkunMt5();
  const binance = useAkunBinance();

  /* TOTAL SALDO = saldo jurnal Trade-Fi + saldo jurnal Kripto, dengan aturan
     yang SAMA dengan kartu saldo di halaman Jurnal: kalau brokernya
     tersambung, angka broker yang dipakai; kalau tidak, hasil hitungan
     jurnal. Sebelumnya dashboard selalu memakai hitungan jurnal, jadi ia
     berselisih dengan jurnal begitu MT5 atau Binance tersambung — dua
     halaman menyebut hal yang sama dengan dua angka berbeda. */
  /* `saldo !== null` SAJA, bukan `terhubung === true`: EA yang offline
     masih membawa saldo laporan terakhirnya (atau salinan lokalnya), dan
     angka itu tetap yang paling benar sampai ada transaksi baru. Syarat
     lama membuat saldo mundur ke hitungan jurnal lama tiap MT5 desktop
     ditutup — lalu angka mundur itu ikut TERBIT ke ringkasan yang dibaca
     halaman depan. */
  const saldoForex = mt5.saldo !== null ? mt5.saldo : forex.saldo;
  const saldoKripto = binance.saldo !== null ? binance.saldo : kripto.saldo;
  const totalSaldo = saldoForex + saldoKripto;
  const sumberSaldo = [
    mt5.terhubung === true ? 'MT5' : null,
    binance.terhubung === true ? 'Binance' : null,
  ].filter(Boolean);

  /* Kurva saldo BERANGKAT DARI `totalSaldo`, angka yang sama persis dengan
     kartu Total Saldo di atasnya dan kartu saldo di halaman Jurnal — saldo
     broker kalau MT5/Binance tersambung, hitungan jurnal kalau tidak.
     ──────────────────────────────────────────────────────────────────────
     Setoran & penarikan SENGAJA TIDAK IKUT. Saldo broker sudah memuat uang
     yang masuk dan keluar; menambahkannya lagi sebagai peristiwa di kurva
     berarti menghitungnya dua kali, dan hari-hari sebelumnya jadi meleset
     sebesar setoran itu. Yang menggerakkan kurva cuma P/L transaksi —
     satu-satunya hal yang belum terkandung di titik acuannya.

     Harus dihitung SETELAH totalSaldo diketahui, karena ia titik jangkarnya. */
  const kurvaSaldo = useMemo(
    () => saldoDuaBulan(RIWAYAT, saldoAwal, [], totalSaldo),
    [RIWAYAT, saldoAwal, totalSaldo]
  );
  const titikIni = kurvaSaldo.filter((k) => k.ini !== null);
  const adaBulanLalu = kurvaSaldo.some((k) => k.lalu !== null);
  const awalKurva = titikIni[0]?.ini ?? saldoAwal;
  const akhirKurva = titikIni[titikIni.length - 1]?.ini ?? saldoAwal;
  const selisihSaldo = awalKurva ? ((akhirKurva - awalKurva) / Math.abs(awalKurva)) * 100 : 0;
  const POSISI_MT5 = mt5.posisi;
  const pnlMt5 = POSISI_MT5.reduce((s, p) => s + p.profit, 0);
  /* null = tidak ada satu pun posisi yang membawa PnL dari bursa. Menjumlahkan
     `undefined` jadi 0 akan menampilkan "$0,00" — angka yang terbaca sebagai
     "impas" padahal artinya "tidak tahu". */
  const pnlKripto = POSISI_TERBUKA.some((p) => p.pnlFloat !== undefined)
    ? POSISI_TERBUKA.reduce((s, p) => s + (p.pnlFloat ?? 0), 0)
    : null;

  /* ── Terbitkan ringkasan untuk halaman depan ──────────────────────
     Hanya pemilik, hanya kalau isinya berubah, dan ditunda 2 detik supaya
     perubahan yang datang beruntun (saldo broker menyusul beberapa ratus
     milidetik setelah jurnal) cuma menghasilkan satu tulisan. */
  const { pemilik } = useAuth();
  const sidikTerbit = useRef('');
  useEffect(() => {
    /* `contoh` ikut jadi penjaga: halaman depan menampilkan angka ini sebagai
       rekam jejak sungguhan, dan menerbitkan hitungan yang berasal dari
       transaksi contoh akan membuatnya berbohong. */
    if (!pemilik || !RIWAYAT.length || contoh) return;
    const r = {
      saldo: Number(totalSaldo.toFixed(2)),
      jumlah: stat.jumlah,
      winrate: Number((stat.winrate ?? 0).toFixed(1)),
      bersih: Number(stat.bersih.toFixed(2)),
      kurva: titikIni.map((x) => x.ini as number),
      tumbuh: Number(selisihSaldo.toFixed(1)),
      sejak: Math.min(...RIWAYAT.map((t) => t.waktu).filter((x) => x > 0)),
    };
    const sidik = JSON.stringify(r);
    if (sidik === sidikTerbit.current) return;
    const j = setTimeout(() => {
      sidikTerbit.current = sidik;
      void terbitkanRingkasan(r, RIWAYAT).catch((e) => console.warn('ringkasan tidak terbit:', e));
    }, 2000);
    return () => clearTimeout(j);
  }, [pemilik, RIWAYAT.length, totalSaldo, stat, kurvaSaldo, selisihSaldo]);

  /* Aktivitas dirakit dari KEJADIAN NYATA: transaksi terakhir yang ditutup,
     posisi yang sedang terbuka, dan status sambungan. Daftar sebelumnya
     ditulis tangan ("Klien baru mendaftar: sinta.dewi") dan tidak pernah
     berubah — panel yang selalu menampilkan hal yang sama berhenti dibaca
     dalam sehari, dan lebih buruk: ia terlihat seperti kabar sungguhan. */
  const aktivitas = useMemo(() => {
    const keluar: { teks: string; waktu: number }[] = [];

    [...RIWAYAT].sort((a, b) => b.waktu - a.waktu).slice(0, 4).forEach((t) => {
      keluar.push({
        teks: `${t.pair} ${t.arah} ditutup ${uang(t.pnl, true)}`,
        waktu: t.waktu,
      });
    });

    POSISI_TERBUKA.slice(0, 2).forEach((p) => {
      keluar.push({ teks: `Posisi ${p.simbol} ${p.arah} terbuka di ${p.venue}`, waktu: p.buka });
    });

    if (mt5.terhubung === true) {
      keluar.push({ teks: `EA JadiTraderSync melapor — ${POSISI_MT5.length} posisi MT5 terbuka`, waktu: Date.now() });
    }
    if (binance.terhubung === true) {
      keluar.push({ teks: 'Binance Futures tersambung lewat proxy VPS', waktu: Date.now() });
    }

    return keluar.sort((a, b) => b.waktu - a.waktu).slice(0, 6);
  }, [RIWAYAT, POSISI_TERBUKA, POSISI_MT5.length, mt5.terhubung, binance.terhubung]);

  return (
    <div className="p-4 sm:p-6">
      <SpandukContoh contoh={contoh} />
      {contoh && <div className="mb-4"><LabelContoh tampil /></div>}
      {/* ── KPI: gabungan kripto + trade-fi ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Total Saldo"   nilai={uang(totalSaldo)}
                  catatan={`Trade-Fi ${uang(saldoForex)} + Kripto ${uang(saldoKripto)}`
                    + (sumberSaldo.length ? ` · live ${sumberSaldo.join(' & ')}` : '')}
                  Ikon={Wallet} />
        <KartuKpi label="Winrate"       nilai={persen(stat.winrate)} catatan={`${stat.menang} menang · ${stat.kalah} kalah`} Ikon={Percent} />
        <KartuKpi label="P/L Bersih"    nilai={uang(stat.bersih, true)} catatan={`${uang(stat.untung, true)} / -${uang(stat.rugi)}`} Ikon={TrendingUp} />
        <KartuKpi
          label="Profit Factor"
          nilai={stat.faktorProfit === null ? '—' : stat.faktorProfit === Infinity ? '∞' : stat.faktorProfit.toFixed(2)}
          catatan={(stat.faktorProfit ?? 0) >= 1 ? 'di atas titik impas' : 'di bawah titik impas'}
          Ikon={Scale}
        />
      </div>

      {/* ── Dua grafik ── */}
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHead
            judul="Hasil Trading Bulanan"
            sub={perBulan.length
              ? `Trade-Fi + Kripto digabung · ${perBulan.length} bulan dengan transaksi`
              : 'Belum ada transaksi.'}
            kanan={trenBulan === null ? undefined : <BadgeTren nilai={trenBulan} />}
          />
          <div className="h-[220px] px-2 pb-4 sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={perBulan} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                <XAxis dataKey="bulan" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={44}
                       tickFormatter={(v) => `$${v}`} />
                {/* Tooltip yang MENYEBUT rinciannya. Batang di sini adalah
                    Trade-Fi + Kripto; kalender di halaman Jurnal menampilkan
                    satu jurnal saja. Keduanya benar — dan tanpa rincian yang
                    bisa dibaca, selisihnya terbaca sebagai angka yang salah. */}
                <Tooltip cursor={{ fill: 'rgba(255,255,255,.04)' }} content={<TipBulan />} />
                {/* Warna batang mengikuti tanda P/L — bulan rugi tidak boleh
                    terlihat sama dengan bulan untung hanya karena tingginya
                    kebetulan mirip. */}
                <Bar dataKey="pnl" name="P/L" radius={[4, 4, 0, 0]} maxBarSize={44}>
                  {perBulan.map((b) => (
                    <Cell key={b.kunci} fill={b.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHead
            judul="Saldo Bulan Ini"
            sub={adaBulanLalu
              ? 'Putih = bulan ini · abu putus-putus = bulan lalu pada tanggal yang sama.'
              : 'Saldo berjalan per tanggal. Bulan lalu belum ada transaksinya, jadi belum ada pembanding.'}
            kanan={titikIni.length > 1 ? <BadgeTren nilai={Number(selisihSaldo.toFixed(1))} /> : undefined}
          />
          <div className="h-[220px] px-2 pb-4 sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={kurvaSaldo} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={44}
                       tickFormatter={(v) => `$${v}`} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip content={<TipGrafik />} cursor={{ stroke: 'rgba(255,255,255,.12)' }} />
                {/* Bulan lalu digambar DULU supaya garis bulan ini ada di
                    atasnya — yang sedang berjalan adalah yang dibaca. */}
                {adaBulanLalu && (
                  <Line type="monotone" dataKey="lalu" name="Bulan lalu" stroke="#71717a" strokeWidth={1.4}
                        strokeDasharray="4 4" dot={false} connectNulls />
                )}
                <Line type="monotone" dataKey="ini" name="Bulan ini" stroke="#fafafa" strokeWidth={1.8}
                      dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* ── Tiga panel bawah ──
          Bukan tiga kolom sama lebar. Dua panel kiri memuat TABEL — pair,
          size, entry, SL/TP, P/L — dan sepertiga layar memaksa angkanya
          terbungkus. Activity cuma satu baris teks per kejadian, jadi
          kolom paling sempit justru bentuk alaminya. Lima kolom dibagi
          2 : 2 : 1. */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          <PanelHead
            judul="Posisi Terbuka — Kripto"
            sub="Order yang sedang berjalan di Binance."
            kanan={
              /* Total PnL floating kripto — pasangan dari angka yang sama di
                 panel Trade-Fi sebelah. Tanpa ini dua panel yang berdampingan
                 menjawab pertanyaan yang sama dengan cara berbeda. */
              pnlKripto === null
                ? <span className="text-[11.5px] text-zinc-500">{POSISI_TERBUKA.length} posisi</span>
                : <span className={cn('angka text-[12.5px]', pnlKripto >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                    {uang(pnlKripto, true)}
                  </span>
            }
          />
          <div className="px-5 pb-5">
            <TabelBungkus>
              <Tabel>
                <thead>
                  <tr><Th>Pair</Th><Th className="text-right">Size</Th><Th className="text-right">Entry</Th>
                      <Th className="text-right">Gerak</Th><Th className="text-right">P/L</Th></tr>
                </thead>
                <tbody>
                  {POSISI_TERBUKA.map((p) => {
                    const gerak = ((p.hargaKini - p.entry) / p.entry) * 100 * (p.arah === 'BUY' ? 1 : -1);
                    return (
                      <Tr key={p.id}>
                        <Td>
                          <span className="text-zinc-200">{p.simbol.replace('USDT', '')}</span>
                          <span className={cn('ml-1.5 text-[10.5px]', p.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>
                            {p.arah}
                          </span>
                          {/* SL & TP menumpang baris keterangan, bukan jadi dua
                            kolom baru: tabel ini sudah lima kolom di panel
                            setengah lebar. SL yang belum dipasang ditulis
                            terang-terangan — itu justru yang harus terlihat. */}
                        <div className="text-[10.5px] text-zinc-600">
                          {p.venue} · {p.tf}
                          {' · SL '}
                          <span className={cn('angka', p.sl > 0 ? 'text-red-400/80' : 'text-amber-400/80')}>
                            {p.sl > 0 ? harga(p.sl) : 'belum'}
                          </span>
                          {p.tp > 0 && <> · TP <span className="angka text-emerald-500/80">{harga(p.tp)}</span></>}
                        </div>
                        </Td>
                        {/* Size dan P/L hanya ada kalau datanya dari bursa.
                            Dokumen publik sengaja tidak menyiarkan keduanya —
                            ukuran posisi membocorkan besar akun. Tanda hubung
                            berarti "tidak disiarkan", bukan "nol". */}
                        <Td className="angka text-right text-zinc-400">
                          {p.jumlah ? p.jumlah.toLocaleString('id-ID', { maximumFractionDigits: 4 }) : '—'}
                        </Td>
                        <Td className="angka text-right text-zinc-400">{harga(p.entry)}</Td>
                        <Td className={cn('angka text-right', gerak >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                          {gerak >= 0 ? '+' : ''}{gerak.toFixed(2)}%
                        </Td>
                        <Td className={cn('angka text-right',
                          p.pnlFloat === undefined ? 'text-zinc-600'
                            : p.pnlFloat >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                          {p.pnlFloat === undefined ? '—' : uang(p.pnlFloat, true)}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Tabel>
            </TabelBungkus>

            {/* PENDING — order yang sudah terkirim tapi belum ke-fill.
                Sengaja di bawah tabel dan bukan di dalamnya: ini BUKAN
                posisi, tidak punya P/L, dan menaruhnya sebaris dengan
                posisi nyata akan membuat orang mengira ia sudah jalan.
                Tapi ia juga tidak boleh disembunyikan — order yang tak
                terlihat di mana pun akan dipesan ulang. */}
            {ORDER_PENDING.length > 0 && (
              <div className="mt-3 border-t border-zinc-800/60 pt-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-amber-400/80">
                  <Clock className="size-3" strokeWidth={2} />
                  Menunggu harga · {ORDER_PENDING.length} order
                </div>
                {ORDER_PENDING.map((o) => (
                  <div key={o.id} className="flex items-baseline justify-between gap-2 py-1">
                    <div className="min-w-0">
                      <span className="text-[12.5px] text-zinc-300">{o.simbol.replace('USDT', '')}</span>
                      <span className={cn('ml-1.5 text-[10.5px]',
                        o.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>{o.arah}</span>
                      <span className="ml-1.5 text-[10.5px] text-zinc-600">
                        {o.tipe.replace('_MARKET', ' Stop').replace('LIMIT', 'Limit')}
                      </span>
                    </div>
                    <div className="angka shrink-0 text-[11.5px] text-zinc-500">
                      {o.qty.toLocaleString('id-ID', { maximumFractionDigits: 4 })} @{' '}
                      <span className="text-amber-400/90">{harga(o.pemicu || o.harga)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHead
            judul="Order Terbuka — Trade-Fi"
            sub="Dari MetaTrader 5, lewat EA JadiTraderSync."
            kanan={
              <span className={cn('angka text-[12.5px]', pnlMt5 >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {uang(pnlMt5, true)}
              </span>
            }
          />
          <div className="space-y-2.5 px-5 pb-5">
            {POSISI_MT5.length === 0 && mt5.pending.length === 0 && (
              <div className="px-1 py-6 text-center text-[12.5px] text-zinc-500">
                {mt5.terhubung === true ? 'Tidak ada posisi MT5 terbuka.' : mt5.ket}
              </div>
            )}
            {POSISI_MT5.map((p) => (
              <div key={p.tiket} className="rounded-lg border border-zinc-800/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-zinc-200">{p.simbol}</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px]',
                      p.arah === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400')}>
                      {p.arah}
                    </span>
                    <span className="angka text-[11px] text-zinc-600">{p.lot} lot</span>
                  </div>
                  <span className={cn('angka text-[12.5px]', p.profit >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                    {uang(p.profit, true)}
                  </span>
                </div>
                <div className="mt-1.5 flex gap-4 text-[11px] text-zinc-500">
                  <span>Entry <span className="angka text-zinc-400">{harga(p.hargaBuka)}</span></span>
                  <span>Kini <span className="angka text-zinc-400">{harga(p.hargaKini)}</span></span>
                  {/* SL/TP 0 berarti TIDAK DIPASANG, bukan "di harga nol".
                      Menampilkan "0" untuk itu keliru dan menyesatkan. */}
                  <span>SL <span className="angka text-red-400/80">{p.sl ? harga(p.sl) : '—'}</span></span>
                  <span>TP <span className="angka text-emerald-500/80">{p.tp ? harga(p.tp) : '—'}</span></span>
                </div>
              </div>
            ))}

            {/* PENDING MT5 — Sell Stop / Buy Limit dsb yang menunggu harga.
                MT5 menyimpannya terpisah dari posisi, dan EA di bawah v2.05
                tidak melaporkannya sama sekali. Sekarang ia punya tempat
                sendiri di sini, dengan bingkai kuning supaya tidak terbaca
                sebagai posisi yang sudah jalan. */}
            {mt5.pending.length > 0 && (
              <div className="border-t border-zinc-800/60 pt-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-amber-400/80">
                  <Clock className="size-3" strokeWidth={2} />
                  Menunggu harga · {mt5.pending.length} order
                </div>
                <div className="space-y-1.5">
                  {mt5.pending.map((o) => (
                    <div key={o.tiket} className="rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[12.5px] text-zinc-200">{o.simbol}</span>
                          <span className={cn('rounded px-1.5 py-0.5 text-[10px]',
                            o.arah === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400')}>
                            {o.jenis.replace('_', ' ')}
                          </span>
                          <span className="angka text-[11px] text-zinc-600">{o.lot} lot</span>
                        </div>
                        <span className="angka shrink-0 text-[12.5px] text-amber-400/90">{harga(o.harga)}</span>
                      </div>
                      <div className="mt-1.5 flex gap-4 text-[11px] text-zinc-500">
                        <span>SL <span className="angka text-red-400/80">{o.sl ? harga(o.sl) : '—'}</span></span>
                        <span>TP <span className="angka text-emerald-500/80">{o.tp ? harga(o.tp) : '—'}</span></span>
                        <span className="text-zinc-700">#{o.tiket}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHead judul="Activity" sub="Kejadian terakhir di akunmu." />
          <div className="px-5 pb-5">
            {aktivitas.length === 0 && (
              <div className="py-6 text-center text-[12.5px] text-zinc-500">Belum ada kejadian.</div>
            )}
            {aktivitas.map((a, i) => (
              <div key={i} className="flex gap-3 py-2.5">
                <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
                  <Clock className="size-3 text-zinc-500" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] text-zinc-200">{a.teks}</div>
                  <div className="text-[11.5px] text-zinc-500">{lalu(a.waktu)}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <PanelEvaluasi trade={RIWAYAT} saldoAwal={saldoAwal} />

      {/* Rincian sumber — supaya angka gabungan di atas bisa DIPERIKSA */}
      <Panel className="mt-4">
        <PanelHead judul="Rincian Sumber" sub="Dari mana angka gabungan di atas berasal." />
        <div className="px-5 pb-5">
          <TabelBungkus>
            <Tabel>
              <thead>
                <tr><Th>Sumber</Th><Th className="text-right">Trade</Th><Th className="text-right">Winrate</Th>
                    <Th className="text-right">Profit</Th><Th className="text-right">Loss</Th><Th className="text-right">Bersih</Th>
                    <Th className="text-right">Saldo</Th></tr>
              </thead>
              <tbody>
                {[['Trade-Fi (MT5)', forex, saldoForex], ['Kripto (Binance)', kripto, saldoKripto]].map(([nama, s, sal]: any) => (
                  <Tr key={nama}>
                    <Td className="text-zinc-300">{nama}</Td>
                    <Td className="angka text-right text-zinc-400">{s.jumlah}</Td>
                    <Td className="angka text-right text-zinc-400">{persen(s.winrate)}</Td>
                    <Td className="angka text-right text-emerald-500">{uang(s.untung, true)}</Td>
                    <Td className="angka text-right text-red-400">-{uang(s.rugi)}</Td>
                    <Td className={cn('angka text-right', s.bersih >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                      {uang(s.bersih, true)}
                    </Td>
                    <Td className="angka text-right text-zinc-300">{uang(sal)}</Td>
                  </Tr>
                ))}
                <Tr className="border-t border-zinc-800">
                  <Td className="font-medium text-zinc-100">Gabungan</Td>
                  <Td className="angka text-right font-medium">{stat.jumlah}</Td>
                  <Td className="angka text-right font-medium">{persen(stat.winrate)}</Td>
                  <Td className="angka text-right font-medium text-emerald-500">{uang(stat.untung, true)}</Td>
                  <Td className="angka text-right font-medium text-red-400">-{uang(stat.rugi)}</Td>
                  <Td className={cn('angka text-right font-medium', stat.bersih >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                    {uang(stat.bersih, true)}
                  </Td>
                  <Td className="angka text-right font-medium text-zinc-100">{uang(totalSaldo)}</Td>
                </Tr>
              </tbody>
            </Tabel>
          </TabelBungkus>
        </div>
      </Panel>
    </div>
  );
}

export default Dashboard;
