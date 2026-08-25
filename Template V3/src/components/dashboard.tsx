import { useEffect, useMemo, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { Wallet, Percent, TrendingUp, Scale, Clock } from 'lucide-react';
import { Panel, PanelHead, KartuKpi, BadgeTren, TipGrafik, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen, harga, tanggalPendek } from '@/lib/utils';
import { plPerBulan, type Bulan } from '@/lib/hitung';

import { usePosisi, terbitkanRingkasan } from '@/lib/data';
/* Modal, statistik, saldo broker, dan kurva TIDAK lagi dihitung di sini —
   semuanya datang dari useRingkasanAkun(), hook yang sama yang menggambar
   kartu hero halaman depan. Itu sebabnya daftar impor ini menyusut. */
import { useRingkasanAkun } from '@/lib/ringkasan';
import { useAuth } from '@/lib/auth';
import { useHargaPasar } from '@/lib/harga';
import { LabelContoh, SpandukContoh } from '@/components/gerbang';
import { versiKurangDari, VERSI_EA_PENDING } from '@/lib/akun';
import { PanelEvaluasi } from '@/components/panel-evaluasi';
import { TabelPosisi } from '@/components/tabel-posisi';
import { barisPendingKripto, rencanaLokal } from '@/lib/pending-kripto';
import { bacaSpekMt5 } from '@/lib/pasar';
import { simbolDasarMt5 } from '@/lib/simbol';

/* Risiko & target dalam DOLAR — rumus yang SAMA dengan panel Posisi Terbuka
   di Chart & Entry. Ditulis dua kali di dua berkas dan itu disengaja: satu
   angka uang yang dihitung berbeda di dua layar jauh lebih buruk daripada
   satu fungsi yang ditulis dua kali, jadi kalau salah satunya diubah, yang
   lain HARUS ikut.
     · kripto   — jumlah koin x jarak harga
     · Trade-Fi — lot x dolar per lot per 1.0 harga (dilaporkan EA)
   undefined kalau SL/TP belum dipasang atau ukurannya tidak diketahui —
   nol di sana akan terbaca "tidak ada risiko". */
function uangDariJarak(jarak: number, unitPerHarga: number): number | undefined {
  if (!(jarak > 0) || !(unitPerHarga > 0)) return undefined;
  return jarak * unitPerHarga;
}

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
  /* SATU sumber hitungan, dipakai layar ini DAN kartu hero halaman depan.

     Dulu rumusnya ditulis di sini, dan hero memakai konstanta yang ditulis
     tangan — jadi kedua layar tidak pernah bisa cocok, apa pun yang
     dikerjakan orangnya. Sekarang keduanya menggambar objek yang sama.
     Lihat lib/ringkasan.ts untuk riwayat selisih yang mendahuluinya. */
  const {
    RIWAYAT, contoh, saldoAwal, stat, forex, kripto,
    mt5, binance, saldoForex, saldoKripto, totalSaldo, sumberSaldo,
    kurvaSaldo, titikIni, adaBulanLalu, selisihSaldo, angka,
  } = useRingkasanAkun();
  const { data: posisiMentah, pending: pendingMentah, stop: stopKripto, contoh: kriptoContoh } = usePosisi();
  /* Harga bursa TIDAK diambil untuk data contoh: barisnya sudah membawa
     hargaKini dan pnlFloat yang saling cocok, dan menimpanya dengan harga
     hari ini membuat kolom Gerak menghitung selisih terhadap entry karangan. */
  const hargaPasar = useHargaPasar(kriptoContoh ? [] : posisiMentah.map((p) => p.simbol));
  const POSISI_TERBUKA = posisiMentah.map((p) => ({ ...p, hargaKini: hargaPasar[p.simbol] ?? p.hargaKini }));
  /* Baris pending dipetakan lib/pending-kripto.ts — pemetaan yang SAMA
     dengan panel Posisi Terbuka di Chart & Entry. Sebelumnya panel ini
     memetakan sendiri dan hasilnya berbeda: SL/TP tidak pernah tampil di
     sini, padahal panel Trade-Fi tepat di sebelahnya menampilkannya. */
  const rencana = useMemo(() => rencanaLokal(), [pendingMentah]);
  const ORDER_PENDING = barisPendingKripto(pendingMentah, stopKripto, rencana);
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
    /* Objek yang SAMA dengan yang digambar kartu hero — bukan disusun ulang
       di sini. Menyusunnya ulang berarti dua daftar field yang harus
       diperbarui bersamaan, dan yang satu pasti terlupa. */
    const r = angka;
    const sidik = JSON.stringify(r);
    if (sidik === sidikTerbit.current) return;
    const j = setTimeout(() => {
      sidikTerbit.current = sidik;
      void terbitkanRingkasan(r, RIWAYAT).catch((e) => console.warn('ringkasan tidak terbit:', e));
    }, 2000);
    return () => clearTimeout(j);
  }, [pemilik, RIWAYAT.length, contoh, angka]);

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
      {/* `riwayat` dioper supaya spanduknya bisa mengenali transaksi contoh
          yang SUDAH terimpor — tanpa itu ia tidak punya cara menawarkan
          penghapusannya, dan impor jadi keputusan sekali jalan. */}
      <SpandukContoh contoh={contoh} riwayat={RIWAYAT} />
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
                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.09} />
                <XAxis dataKey="bulan" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={44}
                       tickFormatter={(v) => `$${v}`} />
                {/* Tooltip yang MENYEBUT rinciannya. Batang di sini adalah
                    Trade-Fi + Kripto; kalender di halaman Jurnal menampilkan
                    satu jurnal saja. Keduanya benar — dan tanpa rincian yang
                    bisa dibaca, selisihnya terbaca sebagai angka yang salah. */}
                <Tooltip cursor={{ fill: 'currentColor', fillOpacity: 0.06 }} content={<TipBulan />} />
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
                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.09} />
                <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={44}
                       tickFormatter={(v) => `$${v}`} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip content={<TipGrafik />} cursor={{ stroke: 'currentColor', strokeOpacity: 0.22 }} />
                {/* Bulan lalu digambar DULU supaya garis bulan ini ada di
                    atasnya — yang sedang berjalan adalah yang dibaca. */}
                {adaBulanLalu && (
                  <Line type="monotone" dataKey="lalu" name="Bulan lalu" stroke="#71717a" strokeWidth={1.4}
                        strokeDasharray="4 4" dot={false} connectNulls />
                )}
                <Line type="monotone" dataKey="ini" name="Bulan ini" stroke="currentColor" strokeWidth={1.8}
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
            <TabelPosisi
              kosong="Tidak ada posisi kripto terbuka."
              baris={POSISI_TERBUKA.map((p) => ({
                kunci: p.id,
                simbol: p.simbol.replace('USDT', ''),
                arah: p.arah,
                /* Tanda hubung berarti "tidak disiarkan", bukan "nol":
                   dokumen publik sengaja tidak menyiarkan ukuran posisi
                   karena itu membocorkan besar akun. */
                ukuran: p.jumlah ? p.jumlah.toLocaleString('id-ID', { maximumFractionDigits: 4 }) : '',
                ukuranNum: p.jumlah,
                entry: p.entry,
                hargaKini: p.hargaKini,
                sl: p.sl, tp: p.tp,
                ukuranUsd: (p.jumlah ?? 0) > 0 && p.entry > 0 ? (p.jumlah ?? 0) * p.entry : undefined,
                risikoUsd: uangDariJarak(p.sl > 0 ? Math.abs(p.entry - p.sl) : 0, p.jumlah ?? 0),
                imbalUsd: uangDariJarak(p.tp > 0 ? Math.abs(p.tp - p.entry) : 0, p.jumlah ?? 0),
                pnl: p.pnlFloat,
                ket: [p.venue, p.tf && p.tf !== '—' ? p.tf : ''].filter(Boolean).join(' · '),
              }))}
            />

            {/* PENDING — order yang sudah terkirim tapi belum ke-fill.
                Sengaja di bawah tabel dan bukan di dalamnya: ini BUKAN
                posisi, tidak punya P/L, dan menaruhnya sebaris dengan
                posisi nyata akan membuat orang mengira ia sudah jalan.
                Tapi ia juga tidak boleh disembunyikan — order yang tak
                terlihat di mana pun akan dipesan ulang. */}
            {ORDER_PENDING.length > 0 && (
              <div className="mt-3 border-t border-zinc-800/60 pt-3">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-amber-400/80">
                  <Clock className="size-3" strokeWidth={2} />
                  Menunggu harga · {ORDER_PENDING.length} order
                </div>
                {/* Susunannya SAMA PERSIS dengan pending Trade-Fi di panel
                    sebelah: simbol + jenis + ukuran di kiri, harga di kanan,
                    SL/TP di baris keterangan. Dulu di sini cuma qty dan harga,
                    dan dua panel berdampingan yang menjawab pertanyaan sama
                    dengan isi berbeda memaksa orang menebak mana yang benar.

                    Enam baris terlihat, sisanya digulir — tingginya kelipatan
                    tinggi baris dua-baris teks, sama seperti daftar Trade-Fi. */}
                <div className="gulir-senyap max-h-[320px] divide-y divide-zinc-800/60 overflow-y-auto">
                  {ORDER_PENDING.map((o) => (
                    <div key={o.kunci} className="py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[12.5px] text-zinc-200">{o.simbol.replace('USDT', '')}</span>
                          <span className={cn('text-[10.5px]',
                            o.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>
                            {o.arah} {o.jenis}
                          </span>
                          <span className="angka shrink-0 text-[11px] text-zinc-600">{o.ukuran}</span>
                        </div>
                        <span className="angka shrink-0 text-[12.5px] text-amber-400/90">{harga(o.harga)}</span>
                      </div>
                      {/* Ditulis hanya kalau ordernya memang membawanya, dan
                          label "rencana" wajib ikut kalau stopnya baru catatan
                          lokal: angka tanpa keterangan terbaca sebagai stop
                          yang sudah hidup di bursa, padahal ia baru dipasang
                          saat entry-nya terisi. */}
                      {(o.sl > 0 || o.tp > 0) && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-4 text-[10.5px] text-zinc-600">
                          <span>SL <span className="angka text-red-400/80">{o.sl ? harga(o.sl) : '—'}</span></span>
                          <span>TP <span className="angka text-emerald-500/80">{o.tp ? harga(o.tp) : '—'}</span></span>
                          {o.rencana && (
                            <span className="rounded bg-zinc-800/80 px-1.5 py-px text-[9.5px] text-zinc-500"
                                  title="Stop sungguhan baru dipasang di Binance begitu entry-nya terisi.">
                              rencana
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
            {/* EA lama TIDAK BISA melaporkan pending order — dan diamnya
                layar terbaca sebagai "tidak ada order", padahal bisa saja
                ada empat yang terpasang di terminal. Dua keadaan yang
                sangat berbeda tidak boleh terlihat sama, jadi versinya
                disebut terang-terangan beserta cara memperbaikinya. */}
            {mt5.terhubung === true && mt5.versiEa && versiKurangDari(mt5.versiEa, VERSI_EA_PENDING) && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.04] px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">
                EA v{mt5.versiEa} belum mengirim pending order.
                <span className="text-amber-200/60">
                  {' '}Kompilasi ulang <span className="angka">JadiTraderSyncV2.mq5</span> ke v{VERSI_EA_PENDING} (F7 di MetaEditor),
                  lalu pasang ulang EA-nya. Posisi terbuka tetap tercatat seperti biasa.
                </span>
              </div>
            )}
            {/* Susunan kolom SAMA PERSIS dengan panel kripto di sebelah.
                Dulu di sini kartu: Gerak tidak ada, Size bukan kolom, dan
                dua panel berdampingan menjawab pertanyaan yang sama dengan
                dua bentuk berbeda — orang jadi mengira datanya beda. */}
            <TabelPosisi
              kosong={mt5.terhubung === true ? 'Tidak ada posisi MT5 terbuka.' : mt5.ket}
              baris={POSISI_MT5.map((p) => ({
                kunci: p.tiket,
                simbol: p.simbol,
                arah: p.arah,
                ukuran: `${p.lot} lot`,
                ukuranNum: p.lot,
                entry: p.hargaBuka,
                hargaKini: p.hargaKini,
                sl: p.sl, tp: p.tp,
                pnl: p.profit,
                risikoUsd: uangDariJarak(p.sl > 0 ? Math.abs(p.hargaBuka - p.sl) : 0,
                  (bacaSpekMt5(simbolDasarMt5(p.simbol)) ?? 0) * p.lot),
                imbalUsd: uangDariJarak(p.tp > 0 ? Math.abs(p.tp - p.hargaBuka) : 0,
                  (bacaSpekMt5(simbolDasarMt5(p.simbol)) ?? 0) * p.lot),
                ket: `#${p.tiket}`,
              }))}
            />

            {/* PENDING MT5 — Sell Stop / Buy Limit dsb yang menunggu harga.
                MT5 menyimpannya terpisah dari posisi, dan EA di bawah v2.05
                tidak melaporkannya sama sekali. Sekarang ia punya tempat
                sendiri di sini, dengan bingkai kuning supaya tidak terbaca
                sebagai posisi yang sudah jalan. */}
            {mt5.pending.length > 0 && (
              <div className="border-t border-zinc-800/60 pt-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-amber-400/80">
                  <Clock className="size-3" strokeWidth={2} />
                  Menunggu harga · {mt5.pending.length} order
                </div>
                {/* GARIS pemisah, bukan kotak per order — sama seperti daftar
                    posisi kripto di sebelah. Lima kartu berbingkai membuat
                    panel ini terlihat lebih "berat" daripada posisi yang
                    benar-benar berjalan, padahal order menunggu justru yang
                    paling ringan bobotnya.

                    EMPAT yang terlihat, sisanya digulir: tinggi panel harus
                    berhenti tumbuh di titik tertentu, kalau tidak deretan
                    order pending mendorong seluruh halaman ke bawah. */}
                <div className="gulir-senyap max-h-[320px] divide-y divide-zinc-800/60 overflow-y-auto">
                  {[...mt5.pending].sort((a, b) => b.waktu - a.waktu).map((o) => (
                    <div key={o.tiket} className="py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[12.5px] text-zinc-200">{o.simbol}</span>
                          <span className={cn('text-[10.5px]',
                            o.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>
                            {o.jenis.replace('_', ' ')}
                          </span>
                          <span className="angka text-[11px] text-zinc-600">{o.lot} lot</span>
                        </div>
                        <span className="angka shrink-0 text-[12.5px] text-amber-400/90">{harga(o.harga)}</span>
                      </div>
                      <div className="mt-0.5 flex gap-4 text-[10.5px] text-zinc-600">
                        <span>SL <span className="angka text-red-400/80">{o.sl ? harga(o.sl) : '—'}</span></span>
                        <span>TP <span className="angka text-emerald-500/80">{o.tp ? harga(o.tp) : '—'}</span></span>
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
