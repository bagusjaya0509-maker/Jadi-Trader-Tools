import { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { Wallet, Percent, TrendingUp, Scale, Clock } from 'lucide-react';
import { Panel, PanelHead, KartuKpi, BadgeTren, TipGrafik, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen, harga, tanggalPendek } from '@/lib/utils';
import { statGabungan, statPer, plPerBulan, saldoBulanIni } from '@/lib/hitung';

import { useRiwayat, usePosisi, useSaldoAwal } from '@/lib/data';
import { useHargaPasar } from '@/lib/harga';
import { LabelContoh } from '@/components/gerbang';
import { useAkunMt5, useAkunBinance } from '@/lib/akun';
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

function TipUang({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 shadow-xl">
      <div className="text-[11px] text-zinc-500">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="angka text-[12.5px]" style={{ color: p.color }}>
          {p.name}: {uang(p.value, true)}
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const { data: RIWAYAT, contoh } = useRiwayat();
  const { data: posisiMentah } = usePosisi();
  const hargaPasar = useHargaPasar(posisiMentah.map((p) => p.simbol));
  const POSISI_TERBUKA = posisiMentah.map((p) => ({ ...p, hargaKini: hargaPasar[p.simbol] ?? p.hargaKini }));
  const saldoAwal = useSaldoAwal();
  const stat = statGabungan(RIWAYAT, saldoAwal);
  /* Rincian dari daftar yang SAMA dengan totalnya. Dashboard adalah
     penjumlahan jurnal Trade-Fi dan Kripto — kalau ketiganya tidak berasal
     dari satu array, angkanya pasti berselisih cepat atau lambat. */
  /* Saldo awal dibebankan ke Trade-Fi saja, PERSIS seperti di halaman Jurnal.
     Kalau dibebankan ke keduanya ia terhitung dua kali, dan penjumlahan dua
     jurnal tidak akan pernah sama dengan total di dashboard. */
  const forex = statPer(RIWAYAT, 'forex', saldoAwal);
  const kripto = statPer(RIWAYAT, 'kripto', 0);

  /* Bulan dan kurva saldo DIHITUNG dari transaksi, tidak lagi dari daftar
     yang ditulis tangan di data/porto.ts. Daftar itu berisi Maret–Agustus
     dengan angka karangan, jadi akun yang transaksinya baru mulai bulan ini
     tetap menampilkan lima bulan riwayat yang tidak pernah terjadi. */
  const perBulan = useMemo(() => plPerBulan(RIWAYAT), [RIWAYAT]);
  const kurvaSaldo = useMemo(() => saldoBulanIni(RIWAYAT, saldoAwal), [RIWAYAT, saldoAwal]);

  const bulanIni = perBulan[perBulan.length - 1];
  const bulanLalu = perBulan[perBulan.length - 2];
  /* Tanpa bulan pembanding, tren tidak bisa dihitung — dan menampilkan 0%
     akan terbaca sebagai "tidak berubah", bukan "belum ada pembandingnya". */
  const trenBulan = bulanIni && bulanLalu && Math.abs(bulanLalu.pnl) > 0.005
    ? Number((((bulanIni.pnl - bulanLalu.pnl) / Math.abs(bulanLalu.pnl)) * 100).toFixed(1))
    : null;

  const awalKurva = kurvaSaldo[0]?.saldo ?? saldoAwal;
  const akhirKurva = kurvaSaldo[kurvaSaldo.length - 1]?.saldo ?? saldoAwal;
  const selisihSaldo = awalKurva ? ((akhirKurva - awalKurva) / Math.abs(awalKurva)) * 100 : 0;

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
  const saldoForex = mt5.terhubung === true && mt5.saldo !== null ? mt5.saldo : forex.saldo;
  const saldoKripto = binance.terhubung === true && binance.saldo !== null ? binance.saldo : kripto.saldo;
  const totalSaldo = saldoForex + saldoKripto;
  const sumberSaldo = [
    mt5.terhubung === true ? 'MT5' : null,
    binance.terhubung === true ? 'Binance' : null,
  ].filter(Boolean);
  const POSISI_MT5 = mt5.posisi;
  const pnlMt5 = POSISI_MT5.reduce((s, p) => s + p.profit, 0);
  /* null = tidak ada satu pun posisi yang membawa PnL dari bursa. Menjumlahkan
     `undefined` jadi 0 akan menampilkan "$0,00" — angka yang terbaca sebagai
     "impas" padahal artinya "tidak tahu". */
  const pnlKripto = POSISI_TERBUKA.some((p) => p.pnlFloat !== undefined)
    ? POSISI_TERBUKA.reduce((s, p) => s + (p.pnlFloat ?? 0), 0)
    : null;

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
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHead
            judul="Hasil Trading Bulanan"
            sub={perBulan.length
              ? `P/L per bulan · ${perBulan.length} bulan dengan transaksi`
              : 'Belum ada transaksi.'}
            kanan={trenBulan === null ? undefined : <BadgeTren nilai={trenBulan} />}
          />
          <div className="h-[260px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perBulan} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                <XAxis dataKey="bulan" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={44}
                       tickFormatter={(v) => `$${v}`} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,.04)' }} content={<TipUang />} />
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
            sub="Saldo berjalan per tanggal, dihitung dari transaksi jurnal."
            kanan={kurvaSaldo.length > 1 ? <BadgeTren nilai={Number(selisihSaldo.toFixed(1))} /> : undefined}
          />
          <div className="h-[260px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kurvaSaldo} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={44}
                       tickFormatter={(v) => `$${v}`} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip content={<TipGrafik />} cursor={{ stroke: 'rgba(255,255,255,.12)' }} />
                <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#fafafa" strokeWidth={1.8} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* ── Tiga panel bawah ── */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel>
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
                          <div className="text-[10.5px] text-zinc-600">{p.venue} · {p.tf}</div>
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
          </div>
        </Panel>

        <Panel>
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
            {POSISI_MT5.length === 0 && (
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
