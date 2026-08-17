import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { ArrowRight, Eye, Wallet, Percent, TrendingUp, Scale, Clock } from 'lucide-react';
import { Panel, PanelHead, KartuKpi } from '@/components/efferd-ui';
import { TabelPosisi } from '@/components/tabel-posisi';
import { uang } from '@/lib/utils';
import {
  KPI_PREVIEW, BULANAN_PREVIEW, SALDO_HARIAN_PREVIEW,
  POSISI_KRIPTO_PREVIEW, POSISI_TRADEFI_PREVIEW,
  AKTIVITAS_CONTOH, PERFORMA_CONTOH,
} from '@/lib/contoh-pratinjau';

/* ════════════════════════════════════════════════════════════════════════
   PREVIEW — halaman berdiri sendiri, tanpa login, tanpa hook
   ════════════════════════════════════════════════════════════════════════
   KENAPA HALAMAN TERSENDIRI, bukan data contoh yang disuntikkan ke panel
   asli. Tiga percobaan pertama menyuntikkan contoh ke dalam `useAkunMt5`,
   `ambilPerforma`, dan `usePorto`. Tiap suntikan menutup SATU keadaan dan
   meninggalkan yang lain terbuka — panel Trade-Fi tetap $0.00 untuk akun
   pratinjau, karena contohnya cuma berlaku saat BELUM login sementara
   pengguna pratinjau justru SUDAH login.

   Menambal keadaan satu per satu tidak akan pernah selesai, dan tiap
   tambalan menambah cabang baru di jalur yang memegang uang sungguhan.

   Halaman ini menghapus seluruh kelas masalah itu: seluruh datanya
   DIOPER SEBAGAI PROP ke komponen yang memang murni — `Panel`,
   `KartuKpi`, `TabelPosisi`, dan grafik Recharts. Tidak ada satu pun
   hook data yang dipanggil di sini, jadi tidak ada satu pun jalur baru
   menuju logika nyata. Logika asli tiap panel tetap persis seperti
   sebelum halaman ini ada.

   TANPA LOGIN, dan itu memang gunanya: orang yang sedang menimbang
   produk tidak boleh disuruh mendaftar untuk melihat bentuk barangnya.
   ════════════════════════════════════════════════════════════════════════ */

function Judul({ anak, ket }: { anak: string; ket: string }) {
  return (
    <div className="mb-3 mt-8 first:mt-0">
      <h2 className="text-[15px] font-medium text-zinc-100">{anak}</h2>
      <p className="text-[12.5px] text-zinc-500">{ket}</p>
    </div>
  );
}

export default function Preview() {
  const k = KPI_PREVIEW;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Pita penanda, TIDAK bisa ditutup ────────────────────────────
          Seluruh halaman ini karangan. Satu-satunya hal yang membuatnya
          jujur adalah kalimat yang mengatakannya, dan kalimat itu tidak
          boleh punya tombol tutup. */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-sky-500/25 bg-sky-500/[0.08] px-4 py-2.5 backdrop-blur">
        <Eye className="size-4 shrink-0 text-sky-300" strokeWidth={2} />
        <span className="flex-1 text-[12.5px] text-zinc-200">
          <span className="font-medium text-sky-200">Preview</span> — seluruh angka di halaman ini
          data contoh, bukan hasil trading siapa pun. Dibuat untuk memperlihatkan bentuk alatnya.
        </span>
        <Link to="/pratinjau"
          className="rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
          Coba dengan akunmu
        </Link>
      </div>

      <div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6">
        <Judul anak="Dashboard" ket="Empat angka yang paling sering dilihat, dihitung dari jurnal." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KartuKpi label="Total Saldo"   nilai={uang(k.saldo)}   catatan={`Trade-Fi ${uang(k.saldoTradeFi)} + Kripto ${uang(k.saldoKripto)}`} Ikon={Wallet} />
          <KartuKpi label="Winrate"       nilai={`${k.winrate.toFixed(1)}%`} catatan={`${k.menang} menang · ${k.kalah} kalah`} Ikon={Percent} />
          <KartuKpi label="P/L Bersih"    nilai={uang(k.pnl)} delta={k.pnlPersen}
                    catatan={`${uang(k.untung)} / ${uang(-k.rugi)}`} Ikon={TrendingUp} />
          <KartuKpi label="Profit Factor" nilai={k.profitFactor.toFixed(2)} catatan="di atas titik impas" Ikon={Scale} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Panel>
            <PanelHead judul="Hasil Trading Bulanan" sub="Trade-Fi + Kripto digabung · 6 bulan dengan transaksi" />
            <div className="h-[260px] px-2 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={BULANAN_PREVIEW} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="bulan" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false}
                         tickFormatter={(v) => `$${v}`} width={52} />
                  <Tooltip cursor={{ fill: '#ffffff08' }}
                           contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                           formatter={(v: number) => [uang(v), 'Hasil']} />
                  <Bar dataKey="hasil" radius={[3, 3, 0, 0]}>
                    {BULANAN_PREVIEW.map((b) => (
                      <Cell key={b.bulan} fill={b.hasil >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel>
            <PanelHead judul="Saldo Bulan Ini" sub="Naik-turun saldo harian sepanjang bulan berjalan." />
            <div className="h-[260px] px-2 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={SALDO_HARIAN_PREVIEW} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="prevSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="hari" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false}
                         tickFormatter={(v) => `$${Math.round(v)}`} width={58} domain={['dataMin - 20', 'dataMax + 20']} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                           formatter={(v: number) => [uang(v), 'Saldo']} />
                  <Area type="monotone" dataKey="saldo" stroke="#fafafa" strokeWidth={1.6} fill="url(#prevSaldo)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <Judul anak="Posisi Terbuka" ket="Kripto dari Binance, Trade-Fi dari MetaTrader 5 lewat EA." />
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel>
            <PanelHead judul="Posisi Terbuka — Kripto" sub="Order yang sedang berjalan di Binance."
                       kanan={<span className="text-[12px] text-emerald-500">{uang(POSISI_KRIPTO_PREVIEW.reduce((s, b) => s + (b.pnl ?? 0), 0))}</span>} />
            <div className="px-5 pb-5">
              <TabelPosisi baris={POSISI_KRIPTO_PREVIEW} kosong="Tidak ada posisi kripto terbuka." />
            </div>
          </Panel>

          <Panel>
            <PanelHead judul="Order Terbuka — Trade-Fi" sub="Dari MetaTrader 5, lewat EA JadiTraderSync."
                       kanan={<span className="text-[12px] text-emerald-500">{uang(POSISI_TRADEFI_PREVIEW.reduce((s, b) => s + (b.pnl ?? 0), 0))}</span>} />
            <div className="px-5 pb-5">
              <TabelPosisi baris={POSISI_TRADEFI_PREVIEW} kosong="Tidak ada posisi MT5 terbuka." />
            </div>
          </Panel>
        </div>

        <Judul anak="Copy Signal" ket="Analis diurutkan dari hasil sinyalnya, bukan dari jumlah pengikut." />
        <Panel>
          <PanelHead judul="Papan Peringkat Analis"
                     sub="Nama dan angka di bawah bukan analis sungguhan — ia memperlihatkan bentuk peringkatnya saja."
                     kanan={<span className="angka text-[11px] text-zinc-600">{PERFORMA_CONTOH.berjalan} sinyal berjalan</span>} />
          <div className="px-5 pb-5">
            <div className="divide-y divide-zinc-800/60">
              {PERFORMA_CONTOH.analis.map((a, i) => (
                <div key={a.uid} className="flex items-center gap-3 py-2.5">
                  <span className="angka w-5 shrink-0 text-[12px] text-zinc-600">{i + 1}</span>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] text-zinc-300">
                    {a.nama.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[13px] text-zinc-200">{a.nama}</span>
                      {a.agen && (
                        <span className="rounded bg-sky-500/12 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">AI Agent</span>
                      )}
                    </span>
                    <span className="block text-[11.5px] text-zinc-500">
                      {(a.winrate * 100).toFixed(1)}% winrate · {a.total} sinyal · {a.batal} dibatalkan
                    </span>
                  </span>
                  <span className={`angka shrink-0 text-[13px] ${a.hasilDolar >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                    {uang(a.hasilDolar)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-zinc-600">
              Estimasi dari modal {uang(PERFORMA_CONTOH.modal)} dengan risiko {PERFORMA_CONTOH.risikoPersen}% per sinyal.
              Biaya, slippage, dan ukuran posisi sebenarnya tidak ikut dihitung — ini gambaran rekam jejak,
              bukan hasil trading yang bisa dijanjikan.
            </p>
          </div>
        </Panel>

        <Judul anak="Aktivitas" ket="Kejadian terakhir di akun — order terkirim, TP kena, EA melapor." />
        <Panel>
          <div className="divide-y divide-zinc-800/60 px-5 pb-5">
            {AKTIVITAS_CONTOH.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 py-2.5">
                <Clock className="mt-0.5 size-3.5 shrink-0 text-zinc-600" strokeWidth={2} />
                <span className="flex-1 text-[12.5px] text-zinc-300">{a.teks}</span>
                <span className="shrink-0 text-[11.5px] text-zinc-600">{sejak(a.waktu)}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* ── Penutup ────────────────────────────────────────────────────
            Ditaruh di BAWAH, sesudah orangnya melihat isinya. Ajakan yang
            muncul sebelum ia tahu barangnya apa cuma menghalangi. */}
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h3 className="text-[15px] font-medium text-zinc-100">Sudah lihat bentuknya?</h3>
          <p className="mt-1 max-w-[60ch] text-[12.5px] leading-relaxed text-zinc-400">
            Masuk untuk memakainya dengan datamu sendiri. Saat pertama masuk kamu akan ditanya:
            pakai data contoh ini sebagai isi awal, atau mulai dari nol. Dua-duanya bisa diubah
            kapan saja.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/pratinjau"
              className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-4 py-2.5 text-[13px] font-medium text-zinc-950 transition-colors hover:bg-white">
              Coba 24 jam <ArrowRight className="size-4" />
            </Link>
            <Link to="/akses"
              className="inline-flex items-center gap-2 rounded-md border border-zinc-800 px-4 py-2.5 text-[13px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
              Ambil akses 30 hari
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "2 jam lalu". Ditulis di sini, bukan diimpor dari lib tanggal aplikasi:
 *  halaman ini sengaja tidak bergantung pada apa pun yang bisa berubah
 *  karena keperluan halaman lain. */
function sejak(ms: number): string {
  const d = Date.now() - ms;
  const menit = Math.round(d / 60_000);
  if (menit < 60) return `${Math.max(1, menit)} menit lalu`;
  const jam = Math.round(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.round(jam / 24)} hari lalu`;
}
