import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Check, X, ExternalLink, Star, Activity, Wallet, CheckCheck,
  TrendingUp, ShieldAlert, ChevronRight, Loader2, RotateCcw, WifiOff, Plus,
} from 'lucide-react';
import { Panel, PanelHead, KartuKpi, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { MiniChart } from '@/components/mini-chart';
import { cn, harga as fharga, persen, uang } from '@/lib/utils';
import { useRiwayat, usePosisi } from '@/lib/data';
import { statGabungan } from '@/lib/hitung';
import { useKoneksi } from '@/lib/koneksi';
import { useHargaPasar } from '@/lib/harga';
import { proxyHidup } from '@/lib/pasar';
import {
  useSimbol, togglFavorit, blokirSimbol, pulihkanSimbol, tambahSimbol,
} from '@/lib/simbol';
import {
  pindaiPantau, pindaiParallel,
  type SinyalPantau, type SinyalParallel, type ModeParallel,
} from '@/lib/pindai';

/* ════════════════════════════════════════════════════════════════════════
   SCREENER ENTRY — memindai pasar sungguhan
   ════════════════════════════════════════════════════════════════════════
   Sebelumnya halaman ini memakai data contoh: kartunya cantik tapi tidak
   pernah berubah, bintangnya tidak menyimpan apa pun, dan tombol Cari
   Sinyal tidak memindai apa pun. Sekarang keduanya nyata — lihat
   `lib/pindai.ts`, yang memanggil inti perhitungan yang sama persis dengan
   screener V2.

   Dua bentuk kartu, dan bedanya disengaja:

     · Area Pantau    — mini chart + ceklist, TANPA angka order. Grafiknya
                        yang paling berguna di sini: zona SNR cuma bisa
                        dilihat sebagai bentuk. Daftar ini isinya koin yang
                        layak DILIHAT; angka order di sampingnya membuatnya
                        terbaca sudah layak dieksekusi.
     · Parallel Signal — ceklist + area entry, TANPA grafik. Levelnya sudah
                        pasti, jadi yang dibutuhkan angkanya.
   ════════════════════════════════════════════════════════════════════════ */

const TF = [
  { v: '15m', t: 'TF 15m' }, { v: '30m', t: 'TF 30m' },
  { v: '1h', t: 'TF 1H' }, { v: '4h', t: 'TF 4H' }, { v: '1d', t: 'TF 1D' },
];

const MODE: { v: ModeParallel; t: string }[] = [
  { v: 'snrh4', t: 'Sinyal SNR H4' },
  { v: 'snr', t: 'Sentuh SNR (channel + S/R)' },
  { v: 'only', t: 'Parallel Only' },
];

/** Semua koin aktif dipindai — 115 bawaan, ditambah yang kamu cari sendiri.
 *  Sempat dibatasi 40 demi kecepatan, dan itu keliru: koin yang tidak ikut
 *  dipindai tidak akan pernah memunculkan sinyal, dan tidak ada satu pun
 *  tanda di layar bahwa ia dilewati. Screener yang diam-diam melewatkan
 *  dua pertiga pasar lebih buruk daripada screener yang lambat. */
const BATAS_PINDAI = Infinity;

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

/** Chart 4 jam di TradingView. Selalu 4 jam, tidak pernah 5 menit —
 *  zona yang jadi alasan sinyalnya memang digambar di sana. */
function tautanChart(simbol: string) {
  return `https://www.tradingview.com/chart/?symbol=BINANCE:${simbol}&interval=240`;
}

function KepalaKartu({ s, urutan, favorit, onBintang, onHapus }: {
  s: SinyalPantau; urutan: number; favorit: boolean;
  onBintang: () => void; onHapus: () => void;
}) {
  const beli = s.arah === 'BUY';
  return (
    <div className="flex items-center gap-2 border-b border-zinc-800/80 px-4 py-3">
      <span className="angka text-[11px] text-zinc-600">#{urutan}</span>
      <span className="text-[14px] font-semibold tracking-tight text-zinc-100">
        {s.simbol.replace('USDT', '')}
      </span>
      <button
        onClick={onBintang}
        aria-label={favorit ? 'Hapus dari favorit' : 'Jadikan favorit'}
        title={favorit ? 'Hapus dari favorit' : 'Jadikan favorit'}
        className="cursor-pointer transition-colors"
      >
        <Star className={cn('size-3.5', favorit ? 'fill-amber-400 text-amber-400' : 'text-zinc-600 hover:text-amber-400')} />
      </button>
      <span className="ml-auto rounded-md bg-zinc-800/60 px-2 py-0.5 text-[10.5px] text-zinc-400">{s.tier}</span>
      <span className={cn(
        'rounded-md px-2.5 py-1 text-[11px] font-semibold',
        beli ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
      )}>
        {s.arah}
      </span>
      <button
        onClick={onHapus}
        aria-label={`Hapus ${s.simbol} dari pemindaian`}
        title="Hapus koin ini dari pemindaian"
        className="cursor-pointer text-zinc-700 transition-colors hover:text-red-400"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function BarisHarga({ s, ket }: { s: SinyalPantau; ket: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2 text-[11.5px] text-zinc-500">
      <span className="truncate">{ket}</span>
      <span className="angka text-[13px] text-zinc-100">{fharga(s.harga)}</span>
      <span className={cn('angka', s.ubah24j >= 0 ? 'text-emerald-500' : 'text-red-400')}>
        {s.ubah24j >= 0 ? '+' : ''}{s.ubah24j.toFixed(2)}%
      </span>
    </div>
  );
}

function TombolChart({ simbol }: { simbol: string }) {
  return (
    <a
      href={tautanChart(simbol)} target="_blank" rel="noreferrer"
      className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-zinc-800 py-2 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
    >
      <ExternalLink className="size-3" /> Buka chart 4 jam
    </a>
  );
}

function KartuPantau({ s, urutan, favorit, onBintang, onHapus }: {
  s: SinyalPantau; urutan: number; favorit: boolean;
  onBintang: () => void; onHapus: () => void;
}) {
  const beli = s.arah === 'BUY';
  /* Lebar tetap + shrink-0: di dalam baris flex yang menggulir, kartu tanpa
     lebar akan diremas sampai isinya tidak terbaca. */
  return (
    <Panel className="w-[290px] shrink-0 overflow-hidden">
      <KepalaKartu s={s} urutan={urutan} favorit={favorit} onBintang={onBintang} onHapus={onHapus} />

      <div className="border-b border-zinc-800/60 bg-zinc-950/40 px-2 pt-2">
        <MiniChart seed={urutan * 3} arah={s.arah} zonaPada={beli ? 0.72 : 0.26} smi={s.smi} />
      </div>

      <div className="px-4 py-3">
        <BarisHarga s={s} ket={`SMI ${s.tf} · sentuhan M5`} />
        <div className="space-y-1.5">
          <Cek ok teks={`SMI ${s.tf} ${s.kondisi} (${s.smi.toFixed(1)})${s.mulaiBalik ? ' — mulai berbalik' : ''}`} />
          <Cek
            ok={!!s.sentuh}
            teks={s.sentuh
              ? `Candle M5 sentuh ${s.sentuh.sisi === 'R' ? 'resisten' : 'support'} di ${fharga(s.sentuh.level)}${s.sentuh.tolak ? ' (ekor menolak)' : ''}`
              : 'Candle M5 belum menyentuh zona SNR 4 jam'}
          />
          <div className="flex items-start gap-2 text-[12px] text-zinc-500">
            <span className="mt-0.5">•</span>
            <span>Lebar zona ±{fharga(s.lebarZona)}</span>
          </div>
        </div>
        <TombolChart simbol={s.simbol} />
      </div>
    </Panel>
  );
}

function KartuParallel({ s, urutan, favorit, onBintang, onHapus }: {
  s: SinyalParallel; urutan: number; favorit: boolean;
  onBintang: () => void; onHapus: () => void;
}) {
  return (
    <Panel className="overflow-hidden">
      <KepalaKartu s={s} urutan={urutan} favorit={favorit} onBintang={onBintang} onHapus={onHapus} />
      <div className="px-4 py-3">
        <BarisHarga s={s} ket={`Channel ${s.tf} + SNR 4H`} />

        <div className="space-y-1.5">
          <Cek ok teks={`Sentuh rail ${s.rail}, close balik ke dalam channel`} />
          <Cek
            ok={!!s.sentuh}
            teks={s.sentuh
              ? `Sentuh zona ${s.sentuh.sisi === 'R' ? 'resisten' : 'support'} di ${fharga(s.sentuh.level)}`
              : 'Tidak bersamaan dengan zona SNR 4 jam'}
          />
          <div className="flex items-start gap-2 text-[12px] text-zinc-500">
            <span className="mt-0.5">•</span>
            <span>SMI {s.smi.toFixed(1)} · lebar zona ±{fharga(s.lebarZona)}</span>
          </div>
        </div>

        {/* SL diberi ruang setengah lebar zona di luar kotak SNR —
            liquidity sweep hampir selalu mampir di situ dulu. */}
        <div className="mt-3 rounded-md border border-zinc-800/70 bg-zinc-950/40 p-2.5">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Area entry</div>
          <div className="space-y-1 text-[11.5px]">
            {([
              ['Entry', fharga(s.entry), 'text-zinc-200'],
              ['SL', fharga(s.sl), 'text-red-400'],
              ['TP', `${fharga(s.tp1)} · ${fharga(s.tp2)}`, 'text-emerald-500'],
              ['Risk', persen(s.risikoPersen, 2), 'text-zinc-200'],
            ] as const).map(([k, v, w]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-zinc-500">{k}</span>
                <span className={cn('angka truncate', w)}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <TombolChart simbol={s.simbol} />
      </div>
    </Panel>
  );
}

/** Keadaan section saat tidak ada kartu — dibedakan tiga-tiganya, karena
 *  "sedang memindai", "tidak ada yang cocok", dan "server tidak terjangkau"
 *  terlihat sama persis kalau cuma ditulis "tidak ada data". */
function Kosong({ memuat, offline, jumlahDipindai, pesan }: {
  memuat: boolean; offline: boolean; jumlahDipindai: number; pesan: string;
}) {
  if (memuat) {
    return (
      <div className="flex items-center justify-center gap-2.5 px-5 pb-10 pt-4 text-[13px] text-zinc-500">
        <Loader2 className="size-4 animate-spin" /> Memindai {jumlahDipindai} koin…
      </div>
    );
  }
  if (offline) {
    return (
      <div className="px-5 pb-10 pt-4 text-center">
        <WifiOff className="mx-auto mb-2 size-5 text-amber-500" />
        <div className="text-[13px] text-zinc-300">Proxy pasar tidak terjangkau</div>
        <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-zinc-500">
          Data harga diambil lewat VPS karena Binance diblokir sebagian ISP Indonesia.
          Periksa Backend URL di <Link to="/integrasi" className="text-zinc-300 underline decoration-zinc-700 underline-offset-2">Integrations</Link>.
        </p>
      </div>
    );
  }
  return <div className="px-5 pb-10 pt-4 text-center text-[13px] text-zinc-500">{pesan}</div>;
}

export default function Screener() {
  const [mode, setMode] = useState<ModeParallel>('snrh4');
  const [tf, setTf] = useState('4h');
  const [cari, setCari] = useState('');
  const [tolak, setTolak] = useState(false);

  const { siap } = useKoneksi();
  const { aktif, favorit, diblokir } = useSimbol();
  const { data: RIWAYAT } = useRiwayat();
  const { data: posisiMentah } = usePosisi();
  const hargaPasar = useHargaPasar(posisiMentah.map((p) => p.simbol));
  const posisi = posisiMentah.map((p) => ({ ...p, hargaKini: hargaPasar[p.simbol] ?? p.hargaKini }));
  const stat = statGabungan(RIWAYAT);

  const [pantau, setPantau] = useState<SinyalPantau[]>([]);
  const [parallel, setParallel] = useState<SinyalParallel[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [offline, setOffline] = useState(false);
  const [terakhirPindai, setTerakhirPindai] = useState<Date | null>(null);

  const favSet = useMemo(() => new Set(favorit), [favorit]);

  /* Favorit dipindai lebih dulu. Dengan batas 40 koin, koin yang sengaja
     dibintangi tidak boleh kalah oleh urutan abjad. */
  const daftarPindai = useMemo(() => {
    const fav = aktif.filter((s) => favSet.has(s));
    const sisa = aktif.filter((s) => !favSet.has(s));
    return Number.isFinite(BATAS_PINDAI) ? [...fav, ...sisa].slice(0, BATAS_PINDAI) : [...fav, ...sisa];
  }, [aktif, favSet]);

  const berjalan = useRef(false);

  const jalankan = useCallback(async () => {
    if (berjalan.current) return;
    berjalan.current = true;
    setMemuat(true);
    try {
      const hidup = await proxyHidup();
      setOffline(!hidup);
      if (!hidup) { setPantau([]); setParallel([]); return; }
      const [a, b] = await Promise.all([
        pindaiPantau(daftarPindai, tf),
        pindaiParallel(daftarPindai, tf, mode),
      ]);
      setPantau(a);
      setParallel(b);
      setTerakhirPindai(new Date());
    } finally {
      setMemuat(false);
      berjalan.current = false;
    }
  }, [daftarPindai, tf, mode]);

  /* Pemindaian pertama otomatis; sesudahnya hanya kalau timeframe atau mode
     berubah. TIDAK ada polling berkala — memindai 40 koin tiap menit
     menghabiskan kuota proxy untuk halaman yang mungkin sedang ditinggal. */
  useEffect(() => { void jalankan(); }, [jalankan]);

  const floating = posisi.reduce((s, p) => {
    const g = (p.hargaKini - p.entry) / p.entry * (p.arah === 'BUY' ? 1 : -1);
    return s + g * 80;
  }, 0);

  const saring = <T extends SinyalPantau>(d: T[]) =>
    cari ? d.filter((s) => s.simbol.toLowerCase().includes(cari.toLowerCase())) : d;

  const pantauTampil = saring(pantau);
  const parallelTampil = saring(parallel);

  function bukaOrderSungguhan() {
    if (!siap) { setTolak(true); return; }
    setTolak(false);
  }

  const kendali = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          onKeyDown={(e) => {
            /* Enter menambahkan koin yang belum ada di daftar — itu cara
               memunculkan koin yang tidak masuk 120 simbol bawaan. */
            if (e.key === 'Enter' && cari.trim()) { tambahSimbol(cari); setCari(''); }
          }}
          placeholder="Cari / tambah koin…"
          className="h-9 w-44 rounded-md border border-zinc-800 bg-zinc-900/60 pl-8 pr-3 text-[12.5px]
                     text-zinc-200 outline-none transition-colors placeholder:text-zinc-600
                     hover:border-zinc-700 focus-visible:border-zinc-600"
        />
      </div>
      {cari.trim() && (
        <button
          onClick={() => { tambahSimbol(cari); setCari(''); }}
          className="flex cursor-pointer items-center gap-1 rounded-md border border-zinc-800 px-2.5 py-2 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
        >
          <Plus className="size-3.5" /> Tambah
        </button>
      )}
      <Pilih nilai={tf} onChange={setTf} opsi={TF} mati={mode === 'snrh4'} />
      <button
        onClick={() => void jalankan()} disabled={memuat}
        className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-2 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50"
      >
        {memuat && <Loader2 className="size-3.5 animate-spin" />}
        {memuat ? 'Memindai…' : 'Cari Sinyal'}
      </button>
      {diblokir.length > 0 && (
        <button
          onClick={() => pulihkanSimbol()}
          title={`${diblokir.length} koin disembunyikan`}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-2 text-[12px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
        >
          <RotateCcw className="size-3.5" /> Pulihkan {diblokir.length}
        </button>
      )}
    </div>
  );

  const ketPindai = terakhirPindai
    ? `${daftarPindai.length} koin dipindai · ${terakhirPindai.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
    : `${daftarPindai.length} koin`;

  return (
    <div className="p-4 sm:p-6">
      {/* ── Area Pantau ── */}
      <Panel>
        <PanelHead
          judul="Area Pantau"
          sub={`Koin dengan SMI ${tf} ekstrem. Zona SNR selalu diambil dari 4 jam. ${ketPindai}.`}
          kanan={kendali}
        />
        {pantauTampil.length === 0 ? (
          <Kosong
            memuat={memuat} offline={offline} jumlahDipindai={daftarPindai.length}
            pesan={cari ? `Tidak ada koin cocok dengan “${cari}”.`
              : `Tidak ada koin dengan SMI ${tf} di wilayah ekstrem saat ini.`}
          />
        ) : (
          /* Gulir mendatar, bukan grid yang terus turun. Area Pantau bisa
             menghasilkan puluhan kartu sekaligus; dibiarkan menumpuk ke bawah,
             ia mendorong Parallel Signal dan Area Entry keluar layar — bagian
             yang justru dipakai untuk entry jadi tidak terlihat sama sekali. */
          <div className="flex gap-4 overflow-x-auto px-5 pb-5">
            {pantauTampil.map((s, i) => (
              <KartuPantau
                key={s.simbol} s={s} urutan={i + 1}
                favorit={favSet.has(s.simbol)}
                onBintang={() => togglFavorit(s.simbol)}
                onHapus={() => blokirSimbol(s.simbol)}
              />
            ))}
          </div>
        )}
      </Panel>

      {/* ── Parallel Signal ── */}
      <Panel className="mt-4">
        <PanelHead
          judul="Parallel Signal"
          sub={mode === 'snrh4'
            ? 'Mode SNR H4 — timeframe terkunci 4 jam (zona) + M5 (sentuhan).'
            : mode === 'snr'
            ? 'Channel + level S/R mana pun, tidak harus dari 4 jam.'
            : 'Murni pantulan channel, zona SNR diabaikan.'}
          kanan={
            <Pilih nilai={mode} onChange={(v) => setMode(v as ModeParallel)}
                   opsi={MODE as unknown as { v: string; t: string }[]} />
          }
        />
        {parallelTampil.length === 0 ? (
          <Kosong
            memuat={memuat} offline={offline} jumlahDipindai={daftarPindai.length}
            pesan={cari ? `Tidak ada sinyal cocok dengan “${cari}”.`
              : 'Tidak ada pantulan channel yang memenuhi syarat saat ini.'}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
            {parallelTampil.map((s, i) => (
              <KartuParallel
                key={s.simbol} s={s} urutan={i + 1}
                favorit={favSet.has(s.simbol)}
                onBintang={() => togglFavorit(s.simbol)}
                onHapus={() => blokirSimbol(s.simbol)}
              />
            ))}
          </div>
        )}
      </Panel>

      {/* Empat KPI di bawah Parallel Signal: angka-angka ini merangkum APA
          YANG SUDAH DILAKUKAN, bukan apa yang sedang dicari. */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Posisi Terbuka"    nilai={String(posisi.length)}
                  catatan={`${posisi.filter((p) => p.venue === 'Binance Live').length} live · ${posisi.filter((p) => p.venue !== 'Binance Live').length} simulasi`}
                  Ikon={Activity} />
        <KartuKpi label="Total PNL Floating" nilai={uang(floating, true)} catatan="belum direalisasi"
                  warna={floating >= 0 ? 'text-emerald-500' : 'text-red-400'} Ikon={TrendingUp} />
        <KartuKpi label="Transaksi Selesai"  nilai={String(stat.jumlah)}
                  catatan={`${stat.menang} menang · ${stat.kalah} kalah`} Ikon={CheckCheck} />
        <KartuKpi label="Total PNL Realized" nilai={uang(stat.bersih, true)}
                  catatan={`winrate ${persen(stat.winrate)}`}
                  warna={stat.bersih >= 0 ? 'text-emerald-500' : 'text-red-400'} Ikon={Wallet} />
      </div>

      {/* ── Area Entry ── */}
      <Panel className="mt-4">
        <PanelHead judul="Area Entry" sub="Susun order sebelum dikirim. Ukuran, arah, dan level dihitung di sini." />
        <div className="px-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[['Modal per posisi ($)', '30'], ['Leverage (x)', '1']].map(([label, isi]) => (
              <div key={label}>
                <label className="mb-1 block text-[11px] text-zinc-500">{label}</label>
                <input defaultValue={isi} inputMode="numeric"
                  className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 font-mono text-[12.5px] text-zinc-100 outline-none hover:border-zinc-700 focus-visible:border-zinc-600" />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">Sinyal terpilih</label>
              <Pilih
                nilai={parallelTampil[0]?.simbol ?? 'manual'}
                onChange={() => {}}
                opsi={parallelTampil.length
                  ? parallelTampil.map((s) => ({ v: s.simbol, t: `${s.simbol.replace('USDT', '')} — ${s.arah}` }))
                  : [{ v: 'manual', t: 'Belum ada sinyal — koin manual…' }]}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">Arah order</label>
              <Pilih nilai="ikut" onChange={() => {}} opsi={[
                { v: 'ikut', t: 'Ikut sinyal' }, { v: 'buy', t: 'Paksa BUY' }, { v: 'sell', t: 'Paksa SELL' },
              ]} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">Jenis order</label>
              <Pilih nilai="market" onChange={() => {}} opsi={[
                { v: 'market', t: 'Market' }, { v: 'limit', t: 'Limit' }, { v: 'stop', t: 'Stop market' },
              ]} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">SL manual</label>
              <input placeholder={parallelTampil[0] ? fharga(parallelTampil[0].sl) : 'otomatis dari zona'}
                className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 font-mono text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">TP manual</label>
              <input placeholder={parallelTampil[0] ? fharga(parallelTampil[0].tp1) : 'otomatis 1:1 / 1:2'}
                className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 font-mono text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600" />
            </div>
            <div className="flex items-end">
              <button className="h-9 w-full cursor-pointer rounded-md bg-zinc-100 text-[12.5px] font-semibold text-zinc-950 transition-colors hover:bg-white">
                Open Demo Order
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-3">
            <span className="flex-1 text-[12px] leading-relaxed text-zinc-400">
              Order sungguhan memakai saldo Binance-mu. Periksa ukuran dan SL sebelum menekan.
            </span>
            <span className={cn('rounded px-2 py-1 text-[11px]',
              siap ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-700/30 text-zinc-400')}>
              {siap ? 'VPS tersambung' : 'VPS belum diatur'}
            </span>
            <button onClick={bukaOrderSungguhan}
              className="cursor-pointer rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-[12.5px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/20">
              Open Real Order
            </button>
          </div>

          {tolak && (
            <div role="alert" className="mt-3 flex flex-wrap items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/[0.07] p-3.5">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-400" strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-red-300">Order dibatalkan — sambungan belum lengkap</div>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
                  Order sungguhan berangkat lewat VPS-mu sendiri, bukan lewat server kami. Isi dulu
                  <span className="text-zinc-200"> Backend URL</span> dan
                  <span className="text-zinc-200"> App Token</span> di halaman Integrations —
                  di sana ada tutorial lengkapnya, dari membuat API key Binance sampai VPS-nya jalan.
                </p>
                <Link to="/integrasi"
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
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
                        <Td className="angka text-right text-zinc-300">{fharga(p.entry)}</Td>
                        <Td className="angka text-right text-red-400">{fharga(p.sl)}</Td>
                        <Td className="angka text-right text-emerald-500">{fharga(p.tp)}</Td>
                        <Td className="angka text-right text-zinc-100">{fharga(p.hargaKini)}</Td>
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
