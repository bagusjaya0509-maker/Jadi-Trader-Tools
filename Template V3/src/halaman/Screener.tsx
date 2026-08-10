import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Check, X, ExternalLink, Star, Activity, Wallet, CheckCheck,
  TrendingUp, ShieldAlert, ChevronRight,
} from 'lucide-react';
import { Panel, PanelHead, KartuKpi, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { MiniChart } from '@/components/mini-chart';
import { cn, harga, persen, uang } from '@/lib/utils';
import { SINYAL_PANTAU, SINYAL_PRIORITAS, type Sinyal } from '@/data/contoh';
import { useRiwayat, usePosisi } from '@/lib/data';
import { statGabungan } from '@/lib/hitung';
import { useKoneksi } from '@/lib/koneksi';
import { useHargaPasar } from '@/lib/harga';

/* ════════════════════════════════════════════════════════════════════════
   SCREENER ENTRY
   ════════════════════════════════════════════════════════════════════════
   Dua section, dua bentuk kartu yang SENGAJA berbeda:

     · Area Pantau    — mini chart + ceklist, TANPA angka order. Grafiknya
                        justru yang paling berguna di sini: zona SNR yang
                        jadi alasan koin ini muncul cuma bisa dilihat sebagai
                        bentuk. Yang dibuang entry/SL/TP/risk — daftar ini
                        isinya koin yang layak DILIHAT, dan angka order di
                        sampingnya membuatnya terbaca sudah layak dieksekusi.
     · Parallel Signal — ceklist + area entry, TANPA grafik. Di sini levelnya
                        sudah pasti, jadi yang dibutuhkan angkanya; chart 4
                        jam sungguhan tetap satu klik jauhnya.
   ════════════════════════════════════════════════════════════════════════ */

function Pilih({ nilai, opsi, onChange, mati }: {
  nilai: string; opsi: { v: string; t: string }[]; onChange: (v: string) => void; mati?: boolean;
}) {
  return (
    <select
      value={nilai} disabled={mati}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-9 cursor-pointer appearance-none rounded-md border border-zinc-800 bg-zinc-900/60 pl-3 pr-8',
        'text-[12.5px] text-zinc-300 outline-none transition-colors hover:border-zinc-700',
        'focus-visible:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-40'
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='3' stroke-linecap='round'><path d='M6 9l6 6 6-6'/></svg>\")",
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
      }}
    >
      {opsi.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
    </select>
  );
}

function Cek({ ok, teks }: { ok: boolean; teks: string }) {
  return (
    <div className={cn('flex items-start gap-2 text-[12px] leading-relaxed', ok ? 'text-zinc-400' : 'text-zinc-500')}>
      {ok
        ? <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" strokeWidth={2.4} />
        : <X className="mt-0.5 size-3.5 shrink-0 text-red-400" strokeWidth={2.4} />}
      <span>{teks}</span>
    </div>
  );
}

/** Kepala kartu — sama untuk kedua section supaya barisnya tetap sejajar. */
function KepalaKartu({ s, urutan }: { s: Sinyal; urutan: number }) {
  const beli = s.arah === 'BUY';
  return (
    <div className="flex items-center gap-2 border-b border-zinc-800/80 px-4 py-3">
      <span className="angka text-[11px] text-zinc-600">#{urutan}</span>
      <span className="text-[14px] font-semibold tracking-tight text-zinc-100">{s.simbol.replace('USDT', '')}</span>
      <Star className="size-3.5 cursor-pointer text-zinc-600 transition-colors hover:text-amber-400" />
      <span className="ml-auto rounded-md bg-zinc-800/60 px-2 py-0.5 text-[10.5px] text-zinc-400">{s.tag}</span>
      <span className={cn(
        'rounded-md px-2.5 py-1 text-[11px] font-semibold',
        beli ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
      )}>
        {s.arah}
      </span>
    </div>
  );
}

function BarisHarga({ s, ket }: { s: Sinyal; ket: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2 text-[11.5px] text-zinc-500">
      <span>{ket}</span>
      <span className="angka text-[13px] text-zinc-100">{harga(s.harga)}</span>
      <span className={cn('angka', s.ubah24j >= 0 ? 'text-emerald-500' : 'text-red-400')}>
        {s.ubah24j >= 0 ? '+' : ''}{s.ubah24j.toFixed(2)}%
      </span>
    </div>
  );
}

function TombolChart() {
  return (
    <button className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-zinc-800 py-2 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100">
      <ExternalLink className="size-3" /> Buka chart 4 jam
    </button>
  );
}

/** Area Pantau — mini chart + ceklist tiga baris, persis logic pantau.
 *
 *  Grafiknya TETAP ADA: zona SNR yang jadi alasan koin ini muncul cuma bisa
 *  dilihat sebagai bentuk, bukan dibaca sebagai angka. Yang dibuang hanya
 *  entry, SL, TP, dan risk — daftar ini isinya koin yang layak DILIHAT, dan
 *  angka order di sampingnya membuatnya terbaca sudah layak dieksekusi. */
function KartuPantau({ s, urutan }: { s: Sinyal; urutan: number }) {
  const ekstrem = s.kondisi === 'overbought' || s.kondisi === 'oversold';
  const beli = s.arah === 'BUY';
  return (
    <Panel className="overflow-hidden">
      <KepalaKartu s={s} urutan={urutan} />

      <div className="border-b border-zinc-800/60 bg-zinc-950/40 px-2 pt-2">
        <MiniChart seed={urutan * 3} arah={s.arah} zonaPada={beli ? 0.72 : 0.26} smi={s.smi} />
      </div>

      <div className="px-4 py-3">
        <BarisHarga s={s} ket="SMI 4H · sentuhan M5" />
        <div className="space-y-1.5">
          <Cek ok={ekstrem} teks={`SMI 4 jam ${s.kondisi} (${s.smi.toFixed(1)})`} />
          <Cek ok teks={`Candle M5 sentuh zona ${s.zonaSisi} di ${harga(s.zonaLevel)}`} />
          <div className="flex items-start gap-2 text-[12px] text-zinc-500">
            <span className="mt-0.5">•</span>
            <span>Lebar zona ±{harga(s.lebarZona)}</span>
          </div>
        </div>
        <TombolChart />
      </div>
    </Panel>
  );
}

/** Parallel Signal — ceklist + area entry. Levelnya sudah dihitung, jadi
 *  boleh ditampilkan. Tetap tanpa grafik. */
function KartuParallel({ s, urutan }: { s: Sinyal; urutan: number }) {
  const ekstrem = s.kondisi === 'overbought' || s.kondisi === 'oversold';
  const beli = s.arah === 'BUY';
  return (
    <Panel className="overflow-hidden">
      <KepalaKartu s={s} urutan={urutan} />
      <div className="px-4 py-3">
        <BarisHarga s={s} ket="Channel + SNR 4H" />

        <div className="space-y-1.5">
          <Cek ok={ekstrem} teks={`SMI 4 jam ${s.kondisi} (${s.smi.toFixed(1)})`} />
          <Cek ok teks={`Close balik ke dalam channel (${beli ? 'rail bawah' : 'rail atas'})`} />
          <div className="flex items-start gap-2 text-[12px] text-zinc-500">
            <span className="mt-0.5">•</span>
            <span>Zona {s.zonaSisi} {harga(s.zonaLevel)} · lebar ±{harga(s.lebarZona)}</span>
          </div>
        </div>

        {/* Area entry: SL sengaja diberi ruang setengah lebar zona di bawah
            kotak SNR — liquidity sweep hampir selalu mampir di situ dulu. */}
        <div className="mt-3 rounded-md border border-zinc-800/70 bg-zinc-950/40 p-2.5">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Area entry</div>
          <div className="space-y-1 text-[11.5px]">
            {[
              ['Entry', harga(s.harga), 'text-zinc-200'],
              ['SL', harga(s.sl), 'text-red-400'],
              ['TP', `${harga(s.tp1)} · ${harga(s.tp2)}`, 'text-emerald-500'],
              ['Risk', persen(s.risiko, 2), 'text-zinc-200'],
            ].map(([k, v, w]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-zinc-500">{k}</span>
                <span className={cn('angka truncate', w)}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <TombolChart />
      </div>
    </Panel>
  );
}

/* Badge rezim BTC. Ditempatkan di kepala tiap section, bukan sebagai kartu
   KPI tersendiri — rezim itu KONTEKS untuk membaca sinyal di bawahnya, bukan
   angka yang berdiri sendiri. */
function Rezim({ nilai, arah }: { nilai: number; arah: string }) {
  const warna = arah === 'BUY' ? 'text-emerald-500' : arah === 'SELL' ? 'text-red-400' : 'text-zinc-400';
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-[11.5px]">
      <span className="text-zinc-500">Rezim BTC</span>
      <span className={cn('font-medium', warna)}>{arah}</span>
      <span className="angka text-zinc-600">SMI {nilai.toFixed(1)}</span>
    </span>
  );
}

export default function Screener() {
  const [mode, setMode] = useState('snrh4');
  const [tf, setTf] = useState('4h');
  const [cari, setCari] = useState('');
  const [tolak, setTolak] = useState(false);

  const { siap } = useKoneksi();
  const { data: RIWAYAT } = useRiwayat();
  const { data: POSISI_TERBUKA } = usePosisi();
  /* Harga pasar disuntikkan ke posisi. Kalau proxy tidak menjawab, petanya
     kosong dan `hargaKini` bawaan (= entry) tetap dipakai — kolom Gerak
     menampilkan 0,00%, bukan angka karangan. */
  const hargaPasar = useHargaPasar(POSISI_TERBUKA.map((p) => p.simbol));
  const posisi = POSISI_TERBUKA.map((p) => ({ ...p, hargaKini: hargaPasar[p.simbol] ?? p.hargaKini }));
  const stat = statGabungan(RIWAYAT);
  const daftar = SINYAL_PRIORITAS.filter((s) => !cari || s.simbol.toLowerCase().includes(cari.toLowerCase()));
  const floating = posisi.reduce((s, p) => {
    const g = (p.hargaKini - p.entry) / p.entry * (p.arah === 'BUY' ? 1 : -1);
    return s + g * 80;
  }, 0);

  const TF = [
    { v: '15m', t: 'TF 15m' }, { v: '30m', t: 'TF 30m' },
    { v: '1h', t: 'TF 1H' }, { v: '4h', t: 'TF 4H' }, { v: '1d', t: 'TF 1D' },
  ];

  /* Penjaga order sungguhan. Tanpa VPS dan token, permintaan order akan
     ditolak proxy dengan 401 — pesan itu tidak menjelaskan apa pun kepada
     orang yang belum pernah memasang backend. Lebih baik dihentikan di sini
     sambil menunjukkan ke mana harus pergi. */
  function bukaOrderSungguhan() {
    if (!siap) { setTolak(true); return; }
    setTolak(false);
    // Prototipe: pengiriman sungguhan menyusul saat backend tersambung.
  }

  return (
    <div className="p-4 sm:p-6">
      {/* ── Area Pantau ── */}
      <Panel>
        <PanelHead
          judul="Area Pantau"
          sub="Koin dengan SMI 4 jam ekstrem yang candle M5-nya sedang menyentuh zona SNR."
          kanan={
            <div className="flex flex-wrap items-center gap-2">
              <Rezim nilai={39.0} arah="NETRAL" />
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
                <input
                  value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari koin…"
                  className="h-9 w-36 rounded-md border border-zinc-800 bg-zinc-900/60 pl-8 pr-3 text-[12.5px]
                             text-zinc-200 outline-none transition-colors placeholder:text-zinc-600
                             hover:border-zinc-700 focus-visible:border-zinc-600"
                />
              </div>
              <Pilih nilai={tf} onChange={setTf} opsi={TF} />
              <button className="cursor-pointer rounded-md bg-zinc-100 px-3 py-2 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
                Cari Sinyal
              </button>
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
          {SINYAL_PANTAU.map((s, i) => <KartuPantau key={s.simbol} s={s} urutan={i + 1} />)}
        </div>
      </Panel>

      {/* ── Parallel Signal ── */}
      <Panel className="mt-4">
        <PanelHead
          judul="Parallel Signal"
          sub={mode === 'snrh4'
            ? 'Mode SNR H4 — timeframe terkunci 4 jam (zona) + M5 (sentuhan).'
            : 'Sinyal parallel channel pada timeframe terpilih.'}
          kanan={
            <div className="flex flex-wrap items-center gap-2">
              <Rezim nilai={41.2} arah="BUY" />
              <Pilih nilai={tf} onChange={setTf} opsi={TF} mati={mode === 'snrh4'} />
              <Pilih nilai={mode} onChange={setMode} opsi={[
                { v: 'snrh4', t: 'Sinyal SNR H4' },
                { v: 'snr', t: 'Sentuh SNR (channel + S/R)' },
                { v: 'only', t: 'Parallel Only' },
              ]} />
            </div>
          }
        />
        {daftar.length === 0 ? (
          <div className="px-5 pb-10 pt-4 text-center text-[13px] text-zinc-500">
            Tidak ada sinyal cocok dengan “{cari}”.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
            {daftar.map((s, i) => <KartuParallel key={s.simbol} s={s} urutan={i + 1} />)}
          </div>
        )}
      </Panel>

      {/* Empat KPI turun ke bawah Parallel Signal: angka-angka ini merangkum
          APA YANG SUDAH DILAKUKAN, bukan apa yang sedang dicari. Di puncak
          halaman ia menunda hal yang dibuka orang untuk dilihat. */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Posisi Terbuka"    nilai={String(posisi.length)} catatan="2 live · 2 simulasi" Ikon={Activity} />
        <KartuKpi label="Total PNL Floating" nilai={uang(floating, true)} catatan="belum direalisasi"
                  warna={floating >= 0 ? 'text-emerald-500' : 'text-red-400'} Ikon={TrendingUp} />
        <KartuKpi label="Transaksi Selesai"  nilai={String(stat.jumlah)} catatan={`${stat.menang} menang · ${stat.kalah} kalah`} Ikon={CheckCheck} />
        <KartuKpi label="Total PNL Realized" nilai={uang(stat.bersih, true)} catatan={`winrate ${persen(stat.winrate)}`}
                  warna={stat.bersih >= 0 ? 'text-emerald-500' : 'text-red-400'} Ikon={Wallet} />
      </div>

      {/* ── Area Entry ── */}
      <Panel className="mt-4">
        <PanelHead
          judul="Area Entry"
          sub="Susun order sebelum dikirim. Ukuran, arah, dan level dihitung di sini."
        />
        <div className="px-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Modal per posisi ($)', '30'],
              ['Leverage (x)', '1'],
            ].map(([label, isi]) => (
              <div key={label}>
                <label className="mb-1 block text-[11px] text-zinc-500">{label}</label>
                <input defaultValue={isi} inputMode="numeric"
                  className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 font-mono text-[12.5px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600" />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">Sinyal terpilih</label>
              <Pilih nilai="bome" onChange={() => {}} opsi={[
                { v: 'bome', t: 'BOME — SELL (SNR H4)' },
                { v: 'sei', t: 'SEI — BUY (SNR H4)' },
                { v: 'manual', t: 'Koin manual…' },
              ]} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">Arah order</label>
              <Pilih nilai="ikut" onChange={() => {}} opsi={[
                { v: 'ikut', t: 'Ikut sinyal' },
                { v: 'buy', t: 'Paksa BUY' },
                { v: 'sell', t: 'Paksa SELL' },
              ]} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">Jenis order</label>
              <Pilih nilai="market" onChange={() => {}} opsi={[
                { v: 'market', t: 'Market' },
                { v: 'limit', t: 'Limit' },
                { v: 'stop', t: 'Stop market' },
              ]} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">SL manual</label>
              <input placeholder="otomatis dari zona"
                className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 font-mono text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">TP manual</label>
              <input placeholder="otomatis 1:1 / 1:2"
                className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 font-mono text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600" />
            </div>
            <div className="flex items-end">
              <button className="h-9 w-full cursor-pointer rounded-md bg-zinc-100 text-[12.5px] font-semibold text-zinc-950 transition-colors hover:bg-white">
                Open Demo Order
              </button>
            </div>
          </div>

          {/* Tombol order sungguhan dipisah dan diberi warna berbeda dari
              tombol demo. Dua aksi yang bedanya "uang sungguhan" tidak boleh
              terlihat kembar dan bersebelahan. */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-3">
            <span className="flex-1 text-[12px] leading-relaxed text-zinc-400">
              Order sungguhan memakai saldo Binance-mu. Periksa ukuran dan SL sebelum menekan.
            </span>
            <span className={cn(
              'rounded px-2 py-1 text-[11px]',
              siap ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-700/30 text-zinc-400'
            )}>
              {siap ? 'VPS tersambung' : 'VPS belum diatur'}
            </span>
            <button
              onClick={bukaOrderSungguhan}
              className="cursor-pointer rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-[12.5px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              Open Real Order
            </button>
          </div>

          {tolak && (
            <div
              role="alert"
              className="mt-3 flex flex-wrap items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/[0.07] p-3.5"
            >
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-400" strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-red-300">Order dibatalkan — sambungan belum lengkap</div>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
                  Order sungguhan berangkat lewat VPS-mu sendiri, bukan lewat server kami. Isi dulu
                  <span className="text-zinc-200"> Backend URL</span> dan
                  <span className="text-zinc-200"> App Token</span> di halaman Integrations —
                  di sana ada tutorial lengkapnya, dari membuat API key Binance sampai VPS-nya jalan.
                </p>
                <Link
                  to="/integrasi"
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white"
                >
                  Buka Integrations <ChevronRight className="size-3.5" />
                </Link>
              </div>
              <button onClick={() => setTolak(false)} aria-label="Tutup"
                className="cursor-pointer text-zinc-600 transition-colors hover:text-zinc-300">
                <X className="size-4" />
              </button>
            </div>
          )}

          <div className="mt-4">
            <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">Posisi Terbuka</div>
            <TabelBungkus>
              <Tabel>
                <thead>
                  <tr>
                    <Th>Pair</Th><Th>TF</Th><Th>Venue</Th>
                    <Th className="text-right">Entry</Th><Th className="text-right">SL</Th>
                    <Th className="text-right">TP</Th><Th className="text-right">Harga</Th>
                    <Th className="text-right">Gerak</Th><Th />
                  </tr>
                </thead>
                <tbody>
                  {posisi.map((p) => {
                    const gerak = ((p.hargaKini - p.entry) / p.entry) * 100 * (p.arah === 'BUY' ? 1 : -1);
                    return (
                      <Tr key={p.id}>
                        <Td>
                          <span className="font-medium text-zinc-100">{p.simbol.replace('USDT', '')}</span>
                          <span className={cn('ml-2 text-[11px]', p.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>{p.arah}</span>
                        </Td>
                        <Td className="text-zinc-500">{p.tf}</Td>
                        <Td className="text-[12px] text-zinc-500">{p.venue}</Td>
                        <Td className="angka text-right text-zinc-300">{harga(p.entry)}</Td>
                        <Td className="angka text-right text-red-400">{harga(p.sl)}</Td>
                        <Td className="angka text-right text-emerald-500">{harga(p.tp)}</Td>
                        <Td className="angka text-right text-zinc-100">{harga(p.hargaKini)}</Td>
                        <Td className={cn('angka text-right', gerak >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                          {gerak >= 0 ? '+' : ''}{gerak.toFixed(2)}%
                        </Td>
                        <Td className="text-right">
                          <button className="cursor-pointer rounded border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-400">
                            Close
                          </button>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Tabel>
            </TabelBungkus>
          </div>
        </div>
      </Panel>
    </div>
  );
}
