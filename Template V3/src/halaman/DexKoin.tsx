import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, ShieldCheck, ShieldQuestion, TriangleAlert } from 'lucide-react';
import { Panel } from '@/components/efferd-ui';
import { Memuat } from '@/components/memuat';
import { ChartLilin } from '@/components/chart-lilin';
import { PanelBeliKoin } from '@/components/panel-beli-koin';
import type { Lilin } from '@/lib/pasar';
import { cn } from '@/lib/utils';
import {
  ambilLilinDex, ambilAmanDex, tulisHarga, tulisUsd,
  type KolamDex, type TfDex, type KoinPantau, type FaktaAman,
} from '@/lib/coin-listing';

/* ════════════════════════════════════════════════════════════════════════
   KOIN DEX — GRAFIK DAN BELI, DI JALURNYA SENDIRI
   ════════════════════════════════════════════════════════════════════════
   Halaman ini lahir dari satu keputusan pemilik, 21 Sep 2026: mode DEX
   "punya jalan tersendiri aja biar semuanya bisa bekerja sesuai dengan jalan
   originalnya dex".

   Keputusan itu bukan soal tata letak. Koin DEX berjalan dengan aturan yang
   memang berbeda dari koin bursa, dan tiap perbedaannya punya akibat di
   layar:

   • Harganya milik KOLAM, bukan milik token. Satu token bisa punya sepuluh
     kolam dengan sepuluh harga; yang dipakai di sini yang paling dalam,
     dan nomor kolamnya ditulis supaya bisa dicocokkan sendiri.
   • Tidak ada order book, tidak ada leverage, tidak ada SL/TP. Yang terjadi
     sesudah tombol beli ditekan cuma satu: token pindah ke dompet.
   • Kontraknya bisa berbuat hal-hal yang tidak bisa dilakukan koin bursa —
     mencetak pasokan baru, membekukan saldo, mengubah dirinya sendiri.
     Karena itu pemeriksaan kontrak duduk SEJAJAR dengan grafik di sini,
     bukan di halaman lain.

   ── KENAPA BUKAN DI CHART & ENTRY ───────────────────────────────────────
   Pernah dipertimbangkan dan sengaja tidak dilakukan. Chart & Entry berisi
   panel order Hyperliquid: leverage, SL, TP, likuidasi. Menaruh pembelian
   spot tanpa pelindung apa pun di sebelahnya berarti dua tombol beli
   bersebelahan yang akibatnya berbeda jauh — dan kebiasaan tangan tidak
   membaca label.

   Jadi jalurnya dipisah sejak alamatnya: /dex-koin, dibuka dari baris
   Lintasan Koin, dan pulang ke sana.
   ════════════════════════════════════════════════════════════════════════ */

const TF: { nilai: TfDex; label: string }[] = [
  { nilai: '5m', label: '5m' },
  { nilai: '15m', label: '15m' },
  { nilai: '1h', label: '1H' },
  { nilai: '4h', label: '4H' },
  { nilai: '1d', label: '1D' },
];

/** Penjelajah blok per jaringan, untuk membuka kontraknya sendiri. */
const PENJELAJAH: Record<string, (a: string) => string> = {
  solana: (a) => `https://solscan.io/token/${a}`,
  eth: (a) => `https://etherscan.io/token/${a}`,
  bsc: (a) => `https://bscscan.com/token/${a}`,
  base: (a) => `https://basescan.org/token/${a}`,
  arbitrum: (a) => `https://arbiscan.io/token/${a}`,
  polygon_pos: (a) => `https://polygonscan.com/token/${a}`,
};

export default function DexKoin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const jaringan = params.get('jaringan') || '';
  const alamat = params.get('alamat') || '';
  /* Simbol ikut di alamat halaman supaya judulnya sudah benar pada frame
     pertama. Ia cuma hiasan — kalau tidak dikirim, nama kolamnya yang
     dipakai, dan kalau itu pun belum ada, potongan alamatnya. */
  const simbolAwal = params.get('simbol') || '';
  const kolamAwal = params.get('kolam') || '';

  const [tf, setTf] = useState<TfDex>('1h');
  const [lilin, setLilin] = useState<Lilin | null>(null);
  const [kolam, setKolam] = useState<KolamDex | null>(kolamAwal ? { kolam: kolamAwal } : null);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState('');

  const [aman, setAman] = useState<FaktaAman | undefined>(undefined);
  const [periksa, setPeriksa] = useState(false);

  /* ── LILIN ──────────────────────────────────────────────────────────
     Kolamnya dikirim balik ke server pada permintaan berikutnya supaya
     pencarian kolam terdalam cuma terjadi sekali, bukan tiap kali
     timeframe-nya diganti. */
  const tarik = useCallback(async (t: TfDex, pakaiKolam?: string) => {
    if (!jaringan || !alamat) return;
    setMuat(true); setGalat('');
    const h = await ambilLilinDex(jaringan, alamat, t, pakaiKolam);
    setMuat(false);
    if ('error' in h) { setGalat(h.error); return; }
    if (h.kolam) setKolam(h.kolam);
    if (!h.lilin.length) {
      setLilin(null);
      setGalat(h.kolam
        ? 'Kolamnya ada, tapi belum ada transaksi yang cukup untuk membentuk lilin di timeframe ini. Coba timeframe yang lebih kecil.'
        : 'Token ini belum punya kolam di DEX mana pun, jadi belum ada harga untuk digambar.');
      return;
    }
    setLilin({
      times: h.lilin.map((b) => b[0]),
      opens: h.lilin.map((b) => b[1]),
      highs: h.lilin.map((b) => b[2]),
      lows: h.lilin.map((b) => b[3]),
      closes: h.lilin.map((b) => b[4]),
      volumes: h.lilin.map((b) => b[5]),
    });
  }, [jaringan, alamat]);

  useEffect(() => { void tarik(tf, kolam?.kolam || kolamAwal || undefined); }, [tf, tarik]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── KONTRAK ────────────────────────────────────────────────────────
     Dijalankan sendiri saat halaman dibuka, tidak menunggu ditekan.
     Alasannya sederhana: yang tidak ditekan tidak akan pernah dibaca, dan
     satu-satunya saat pemeriksaan ini berguna adalah SEBELUM membeli. */
  const periksaKontrak = useCallback(async () => {
    if (!jaringan || !alamat) return;
    setPeriksa(true);
    const a = await ambilAmanDex(jaringan, alamat);
    setPeriksa(false);
    if (a) setAman(a);
  }, [jaringan, alamat]);

  useEffect(() => { void periksaKontrak(); }, [periksaKontrak]);

  const simbol = simbolAwal || (kolam?.nama || '').split('/')[0].trim() || alamat.slice(0, 6);

  /* `KoinPantau` bikinan, bukan baris daftar pantau. Panel beli cuma
     membaca alamat, jaringan, simbol, dan fakta keamanannya — sisanya
     medan daftar pantau yang tidak berlaku di sini dan diisi netral. */
  const koin: KoinPantau = useMemo(() => ({
    alamat, jaringan, nama: simbol, simbol, catatan: '',
    beliUsd: 0, beliToken: 0, status: 'listing',
    dibuat: 0, diperiksa: aman?.diperiksa || 0, putaran: 0,
    aman,
  }), [alamat, jaringan, simbol, aman]);

  if (!jaringan || !alamat) {
    return (
      <div className="p-4 md:p-6">
        <Panel className="p-5">
          <p className="text-[12.5px] text-zinc-400">
            Alamat halaman ini kurang lengkap — jaringan dan alamat kontraknya harus ikut.
          </p>
          <Link to="/wallet-tracking?sub=hunter"
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-sky-400 hover:text-sky-300">
            <ArrowLeft className="size-3.5" /> Kembali ke Coin Hunter
          </Link>
        </Panel>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* ── Kepala ─────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/wallet-tracking?sub=hunter"
            className="mb-1.5 inline-flex items-center gap-1.5 text-[11.5px] text-zinc-500 transition-colors hover:text-zinc-300">
            <ArrowLeft className="size-3.5" /> Lintasan Koin
          </Link>
          <h1 className="flex flex-wrap items-center gap-2 text-[16px] font-semibold text-zinc-100">
            {simbol}
            <span className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-400">
              {jaringan}
            </span>
            {kolam?.dex && (
              <span className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-500">
                {kolam.dex}
              </span>
            )}
          </h1>
          <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">
            Harga dari kolam DEX paling dalam, bukan dari bursa.
            {kolam && (kolam.jumlahKolam ?? 0) > 1 && (
              <> Token ini punya {kolam.jumlahKolam} kolam — yang lain harganya bisa berbeda.</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {TF.map((x) => (
            <button key={x.nilai} onClick={() => setTf(x.nilai)}
              className={cn('cursor-pointer rounded-md border px-2.5 py-1 text-[11.5px] transition-colors',
                tf === x.nilai
                  ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
                  : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300')}>
              {x.label}
            </button>
          ))}
          <button onClick={() => void tarik(tf, kolam?.kolam)} aria-label="Segarkan"
            className="ml-1 cursor-pointer rounded-md border border-zinc-800 p-1.5 text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300">
            <RefreshCw className={cn('size-3.5', muat && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* ── Grafik ───────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          <Panel className="overflow-hidden">
            {muat && !lilin ? (
              <Memuat pesan="Menarik lilin dari kolam DEX…" className="min-h-[420px]" />
            ) : galat && !lilin ? (
              <div className="flex min-h-[420px] items-center justify-center p-6">
                <p className="max-w-md text-center text-[12.5px] leading-relaxed text-zinc-500">{galat}</p>
              </div>
            ) : lilin ? (
              <ChartLilin key={`${jaringan}|${alamat}|${tf}`} lilin={lilin} tinggi={440}
                muatPenuh tandaAir={{ utama: simbol, sub: `${jaringan} · ${tf}` }} />
            ) : null}
          </Panel>

          {/* ── JUMLAH LILIN ITU KABAR, BUKAN CATATAN KAKI ─────────────
              GeckoTerminal cuma menerbitkan bar untuk periode yang benar-
              benar ada transaksinya — jeda tidak diisi. Jadi deret 10 lilin
              di timeframe 1 jam TIDAK berarti kolamnya berumur 10 jam; bisa
              jadi ia berumur seminggu dan cuma diperdagangkan sepuluh jam
              di antaranya.

              Perbedaan itu menentukan. Chart yang terlihat rapat dan
              berkelanjutan, padahal barnya melompati dua hari sunyi, akan
              dibaca sebagai tren — dan yang dibaca sebagai tren dijadikan
              alasan membeli. */}
          {lilin && lilin.times.length < 60 && (
            <p className="mt-2 px-1 text-[11px] leading-relaxed text-zinc-600">
              Cuma {lilin.times.length} lilin di timeframe ini — bar hanya terbit untuk jam
              yang ada transaksinya, dan jeda sepi tidak diisi. Jarak antarbar di layar
              belum tentu sama dengan jarak waktu sebenarnya.
            </p>
          )}

          {/* Fakta kolam. Ditaruh di bawah grafik, bukan di kolom kanan:
              yang di kanan adalah urusan membeli, dan angka-angka ini
              urusan menilai — dua hal yang lebih baik tidak berdempetan. */}
          {kolam && (
            <Panel className="mt-3 p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                <Fakta k="Harga" v={kolam.harga ? tulisHarga(kolam.harga) : '—'} />
                <Fakta k="Likuiditas kolam" v={kolam.likuiditas ? tulisUsd(kolam.likuiditas) : '—'} />
                <Fakta k="Volume 24 jam" v={kolam.volume24 ? tulisUsd(kolam.volume24) : '—'} />
                <Fakta k="FDV" v={kolam.fdv ? tulisUsd(kolam.fdv) : '—'} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-zinc-800/60 pt-2.5 text-[10.5px] text-zinc-600">
                <span className="angka break-all">kolam {kolam.kolam}</span>
                {PENJELAJAH[jaringan] && (
                  <a href={PENJELAJAH[jaringan](alamat)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sky-500/80 hover:text-sky-400">
                    <ExternalLink className="size-3" /> kontraknya di penjelajah blok
                  </a>
                )}
              </div>
            </Panel>
          )}
        </div>

        {/* ── Kolom beli ───────────────────────────────────────────── */}
        <div className="w-full shrink-0 space-y-3 lg:w-[350px]">
          <KartuKontrak aman={aman} sedang={periksa} onPeriksa={() => void periksaKontrak()} />
          <PanelBeliKoin koin={koin} onTutup={() => navigate('/wallet-tracking?sub=hunter')} />
        </div>
      </div>
    </div>
  );
}

function Fakta({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] text-zinc-600">{k}</div>
      <div className="angka mt-0.5 truncate text-[12.5px] text-zinc-200">{v}</div>
    </div>
  );
}

/* ── PEMERIKSAAN KONTRAK ────────────────────────────────────────────────
   Tiga keadaan, dan ketiganya harus terlihat BERBEDA:

     belum diperiksa  — kita tidak tahu apa-apa
     tidak terbaca    — sudah dicoba, penyedianya tidak punya jawaban
     sudah diperiksa  — ada temuan, atau tidak ada

   Sebelum ini yang pertama dan yang terakhir tampil sama persis: diam.
   Token yang belum pernah diperiksa terbaca seperti token yang sudah lolos
   pemeriksaan — dan diam adalah cara paling buruk untuk menyampaikan
   "tidak tahu" tepat di sebelah tombol beli. */
function KartuKontrak({ aman, sedang, onPeriksa }: {
  aman: FaktaAman | undefined; sedang: boolean; onPeriksa: () => void;
}) {
  const temuan: string[] = [];
  if (aman && !aman.kosong) {
    if (aman.bisaCetak) temuan.push('pasokan masih bisa dicetak');
    if (aman.bisaBekukan) temuan.push('saldo bisa dibekukan');
    if (aman.bisaDiubah) temuan.push('kontraknya masih bisa diubah');
    if ((aman.pajakJual ?? 0) > 10) temuan.push(`pajak jual ${aman.pajakJual}%`);
    if ((aman.pajakBeli ?? 0) > 10) temuan.push(`pajak beli ${aman.pajakBeli}%`);
  }

  const keadaan = sedang ? 'jalan' : !aman ? 'belum' : aman.kosong ? 'buta' : temuan.length ? 'bahaya' : 'bersih';

  const gaya = {
    jalan:  { bingkai: 'border-zinc-800', ikon: <Loader2 className="size-3.5 animate-spin text-zinc-500" /> },
    belum:  { bingkai: 'border-amber-500/30 bg-amber-500/[0.05]', ikon: <ShieldQuestion className="size-3.5 text-amber-400" /> },
    buta:   { bingkai: 'border-amber-500/25 bg-amber-500/[0.04]', ikon: <ShieldQuestion className="size-3.5 text-amber-400/80" /> },
    bahaya: { bingkai: 'border-red-500/40 bg-red-500/[0.06]', ikon: <TriangleAlert className="size-3.5 text-red-400" /> },
    bersih: { bingkai: 'border-zinc-800', ikon: <ShieldCheck className="size-3.5 text-emerald-500/80" /> },
  }[keadaan];

  return (
    <Panel className={cn('p-3', gaya.bingkai)}>
      <div className="flex gap-2">
        <span className="mt-0.5 shrink-0">{gaya.ikon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[12.5px] font-medium text-zinc-200">Pemeriksaan kontrak</h3>

          {keadaan === 'jalan' && (
            <p className="mt-1 text-[11.5px] text-zinc-500">Sedang memeriksa…</p>
          )}
          {keadaan === 'belum' && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-amber-200/90">
              Kontrak ini <b>belum diperiksa</b>. Itu bukan berarti aman — berarti belum ada
              yang melihatnya.
            </p>
          )}
          {keadaan === 'buta' && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-amber-200/90">
              Kontraknya <b>tidak bisa dibaca</b> pemeriksa keamanan. Sering terjadi pada token
              yang sangat baru — dan artinya tetap sama: tidak ada yang bisa dipastikan.
            </p>
          )}
          {keadaan === 'bahaya' && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-red-200/90">
              Ditemukan: {temuan.join(', ')}.
              <span className="text-red-200/60"> Bukan bukti penipuan — tapi berarti pemiliknya
                masih bisa berbuat sesuatu pada tokenmu sesudah kamu membelinya.</span>
            </p>
          )}
          {keadaan === 'bersih' && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">
              Tidak ditemukan bendera bahaya yang biasa: tidak bisa dicetak lagi, saldo tidak
              bisa dibekukan, kontraknya terkunci. Pemeriksaan ini hanya membaca kontrak —
              ia tidak tahu apa pun soal niat pembuatnya.
            </p>
          )}

          {!sedang && (
            <button onClick={onPeriksa}
              className="mt-2 cursor-pointer text-[11px] text-zinc-500 underline-offset-2 transition-colors hover:text-zinc-300 hover:underline">
              Periksa ulang
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}
