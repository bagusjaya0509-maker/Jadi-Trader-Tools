import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Lock, Unlock, Trash2, Send, LineChart, X, CheckCircle2,
  TrendingUp, TrendingDown, RefreshCw,
} from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn, uang, persen, harga as fHarga, tanggalPendek } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useRiwayat, useSaldoAwal } from '@/lib/data';
import { statGabungan, kurvaEkuitas } from '@/lib/hitung';
import {
  daftarAnalisa, kirimAnalisa, hapusAnalisa, bukaIsi, mintaAkses,
  statusSaya, putuskanAkses,
  type RingkasAnalisa, type IsiAnalisa, type PermintaanMasuk,
} from '@/lib/analisa';

/* ════════════════════════════════════════════════════════════════════════
   COPY TRADING — analisa berbayar antar pengguna
   ════════════════════════════════════════════════════════════════════════
   Analis memposting rencana trade (entry/SL/TP + alasan) dengan harga.
   Level dan alasannya TERKUNCI sampai pembeli disetujui; yang selalu
   terbuka adalah rekam jejak analisnya — winrate, profit factor, dan kurva
   ekuitas yang diambil OTOMATIS dari jurnalnya sendiri saat memposting,
   bukan diketik tangan. Orang menilai analis dari catatannya, bukan dari
   pengakuannya.

   PEMBAYARAN v1 — jujur soal batasnya: transfer manual ke analis, bukti
   dikirim, analis menyetujui, isi terbuka. Gerbang pembayaran otomatis
   menyusul lewat halaman Billing; alur persetujuannya sudah sama, tinggal
   mengganti "bukti transfer" dengan callback pembayaran.
   ════════════════════════════════════════════════════════════════════════ */

const KELAS_ISIAN =
  'h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 text-[12.5px] text-zinc-200 ' +
  'outline-none transition-colors hover:border-zinc-700 focus-visible:border-zinc-600';

/* Sparkline kurva ekuitas — SVG polos, tanpa pustaka: 60 titik tidak butuh
   Recharts, dan modal ini harus ringan karena dibuka dari daftar. */
function Sparkline({ kurva }: { kurva: number[] }) {
  if (kurva.length < 2) return <div className="py-6 text-center text-[12px] text-zinc-600">Kurva belum tersedia.</div>;
  const min = Math.min(...kurva), maks = Math.max(...kurva);
  const rentang = maks - min || 1;
  const titik = kurva.map((v, i) =>
    `${(i / (kurva.length - 1)) * 300},${60 - ((v - min) / rentang) * 56 + 2}`).join(' ');
  const naik = kurva[kurva.length - 1] >= kurva[0];
  return (
    <svg viewBox="0 0 300 64" className="h-24 w-full">
      <polyline points={titik} fill="none" stroke={naik ? '#10b981' : '#f87171'} strokeWidth="1.6" />
    </svg>
  );
}

function ModalPortofolio({ a, tutup }: { a: RingkasAnalisa; tutup: () => void }) {
  const s = a.snapshot;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={tutup}>
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[14px] font-medium text-zinc-100">Portofolio {a.nama}</div>
            <div className="text-[11.5px] text-zinc-500">
              Diambil otomatis dari jurnalnya saat analisa diposting — bukan diketik tangan.
            </div>
          </div>
          <button onClick={tutup} className="cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
            <X className="size-4" />
          </button>
        </div>
        {s ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Saldo', uang(s.saldo)],
                ['Winrate', persen(s.winrate)],
                ['Profit factor', s.pf ? s.pf.toFixed(2) : '—'],
                ['Transaksi', String(s.jumlah)],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-zinc-800/60 p-3">
                  <div className="text-[11px] text-zinc-500">{l}</div>
                  <div className="angka mt-0.5 text-[16px] font-semibold text-zinc-100">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-zinc-800/60 p-3">
              <div className="mb-1 text-[11px] text-zinc-500">Kurva ekuitas (60 titik terakhir)</div>
              <Sparkline kurva={s.kurva} />
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-[12.5px] text-zinc-600">Analis ini belum menyertakan snapshot.</p>
        )}
      </div>
    </div>
  );
}

function KartuAnalisa({ a, status, milikku, onSegarkan }: {
  a: RingkasAnalisa;
  status: string | undefined;
  milikku: boolean;
  onSegarkan: () => void;
}) {
  const { pengguna } = useAuth();
  const [buka, setBuka] = useState(false);
  const [isi, setIsi] = useState<IsiAnalisa | null>(null);
  const [formBeli, setFormBeli] = useState(false);
  const [bukti, setBukti] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');
  const [lihatPorto, setLihatPorto] = useState(false);

  const bisaBuka = milikku || a.harga === 0 || status === 'pembeli';

  async function muatIsi() {
    setSibuk(true); setKabar('');
    try {
      setIsi(await bukaIsi(a.id));
      setBuka(true);
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Gagal membuka');
    } finally { setSibuk(false); }
  }

  async function kirimPermintaan() {
    setSibuk(true); setKabar('');
    try {
      await mintaAkses(a.id, bukti.trim(), pengguna?.displayName || pengguna?.email?.split('@')[0] || '');
      setKabar('Permintaan terkirim — menunggu persetujuan analis.');
      setFormBeli(false);
      onSegarkan();
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Gagal mengirim');
    } finally { setSibuk(false); }
  }

  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 grow">
          <div className="flex items-center gap-2">
            <span className={cn('flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold',
              a.arah === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
              {a.arah === 'BUY' ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {a.arah}
            </span>
            <span className="angka text-[12.5px] text-zinc-300">{a.pasangan}</span>
            <span className="text-[11px] text-zinc-600">· {tanggalPendek(a.dibuat)}</span>
          </div>
          <div className="mt-1 text-[13.5px] font-medium text-zinc-100">{a.judul}</div>
          <div className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{a.ringkas}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-zinc-500">
            <span>oleh <span className="text-zinc-300">{a.nama}</span></span>
            {a.snapshot && (
              <>
                <span>winrate <span className="angka text-zinc-300">{persen(a.snapshot.winrate)}</span></span>
                <span>PF <span className="angka text-zinc-300">{a.snapshot.pf ? a.snapshot.pf.toFixed(2) : '—'}</span></span>
              </>
            )}
            <span>{a.jumlahPembeli} pengcopy</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={cn('angka text-[14px] font-semibold', a.harga === 0 ? 'text-emerald-500' : 'text-zinc-100')}>
            {a.harga === 0 ? 'Gratis' : uang(a.harga)}
          </span>
          <button onClick={() => setLihatPorto(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[11.5px] text-zinc-300 transition-colors hover:border-zinc-700">
            <LineChart className="size-3.5" /> Lihat portofolio
          </button>
        </div>
      </div>

      <div className="mt-3 border-t border-zinc-800/60 pt-3">
        {buka && isi ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px]">
            <span className="text-zinc-500">Entry <span className="angka text-zinc-200">{fHarga(isi.entry)}</span></span>
            <span className="text-zinc-500">SL <span className="angka text-red-400">{fHarga(isi.sl)}</span></span>
            <span className="text-zinc-500">TP <span className="angka text-emerald-500">{fHarga(isi.tp)}</span></span>
            <Link to={`/chart?simbol=${a.pasangan}&sl=${isi.sl}&tp=${isi.tp}&arah=${a.arah}`}
              className="ml-auto flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1.5 text-[11.5px] font-medium text-zinc-950 transition-colors hover:bg-white">
              Buka di Chart
            </Link>
            {isi.alasan && <p className="w-full text-[12px] leading-relaxed text-zinc-400">{isi.alasan}</p>}
          </div>
        ) : formBeli ? (
          <div className="space-y-2">
            <p className="text-[12px] leading-relaxed text-zinc-500">
              Transfer <span className="angka text-zinc-300">{uang(a.harga)}</span> ke analis (kontak tercantum
              di ringkasannya), lalu kirim buktinya di sini. Analis menyetujui → level dan alasannya terbuka.
              Pembayaran otomatis menyusul lewat Billing.
            </p>
            <div className="flex gap-2">
              <input value={bukti} onChange={(e) => setBukti(e.target.value)}
                placeholder="Tautan / keterangan bukti transfer" className={KELAS_ISIAN} />
              <button onClick={() => void kirimPermintaan()} disabled={sibuk || bukti.trim().length < 4}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50">
                {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Kirim
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {bisaBuka ? (
              <button onClick={() => void muatIsi()} disabled={sibuk}
                className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50">
                {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Unlock className="size-3.5" />}
                Buka analisa
              </button>
            ) : status === 'menunggu' ? (
              <span className="flex items-center gap-1.5 rounded-md border border-amber-500/25 px-3 py-1.5 text-[12px] text-amber-300">
                <Loader2 className="size-3.5 animate-spin" /> Menunggu persetujuan analis
              </span>
            ) : (
              <button onClick={() => setFormBeli(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-200 transition-colors hover:border-zinc-500">
                <Lock className="size-3.5" /> Beli akses · {uang(a.harga)}
              </button>
            )}
            {milikku && (
              <button onClick={() => { if (confirm('Hapus analisa ini?')) void hapusAnalisa(a.id).then(onSegarkan); }}
                className="ml-auto flex cursor-pointer items-center gap-1 rounded-md border border-zinc-800 px-2 py-1.5 text-[11.5px] text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400">
                <Trash2 className="size-3.5" /> Hapus
              </button>
            )}
          </div>
        )}
        {kabar && <p className="mt-2 text-[12px] text-amber-300/90">{kabar}</p>}
      </div>

      {lihatPorto && <ModalPortofolio a={a} tutup={() => setLihatPorto(false)} />}
    </Panel>
  );
}

export default function Analisa() {
  const { pengguna } = useAuth();
  const { data: riwayat } = useRiwayat();
  const saldoAwal = useSaldoAwal();
  const [daftar, setDaftar] = useState<RingkasAnalisa[]>([]);
  const [masuk, setMasuk] = useState<PermintaanMasuk[]>([]);
  const [statusku, setStatusku] = useState<Record<string, string>>({});
  const [memuat, setMemuat] = useState(true);
  const [formBuka, setFormBuka] = useState(false);
  const [kabar, setKabar] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const [judul, setJudul] = useState('');
  const [pasangan, setPasangan] = useState('BTCUSDT');
  const [arah, setArah] = useState<'BUY' | 'SELL'>('BUY');
  const [hargaJual, setHargaJual] = useState(5);
  const [ringkas, setRingkas] = useState('');
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [alasan, setAlasan] = useState('');

  const segarkan = () => {
    void daftarAnalisa().then(setDaftar).finally(() => setMemuat(false));
    if (pengguna) void statusSaya().then((s) => { setMasuk(s.masuk); setStatusku(s.statusku); }).catch(() => { /* belum login */ });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(segarkan, [pengguna?.uid]);

  /* Snapshot rekam jejak DIAMBIL dari jurnal sendiri, di sinilah nilainya:
     angka yang diklaim analis harus angka yang jurnalnya bisa buktikan. */
  const snapshot = useMemo(() => {
    const stat = statGabungan(riwayat, saldoAwal);
    return {
      saldo: Number(stat.saldo.toFixed(2)),
      winrate: Number((stat.winrate ?? 0).toFixed(1)),
      pf: stat.faktorProfit === null || stat.faktorProfit === Infinity ? 0 : Number(stat.faktorProfit.toFixed(2)),
      jumlah: stat.jumlah,
      kurva: kurvaEkuitas(riwayat, saldoAwal).map((t) => t.nilai).slice(-60),
    };
  }, [riwayat, saldoAwal]);

  async function posting() {
    setSibuk(true); setKabar('');
    try {
      await kirimAnalisa({
        judul: judul.trim(), pasangan: pasangan.trim().toUpperCase(), arah,
        harga: hargaJual, ringkas: ringkas.trim(),
        isi: { entry: Number(entry) || 0, sl: Number(sl) || 0, tp: Number(tp) || 0, alasan: alasan.trim() },
        nama: pengguna?.displayName || pengguna?.email?.split('@')[0] || 'Analis',
        snapshot,
      });
      setKabar('Analisa terposting.');
      setFormBuka(false);
      setJudul(''); setRingkas(''); setEntry(''); setSl(''); setTp(''); setAlasan('');
      segarkan();
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Gagal memposting');
    } finally { setSibuk(false); }
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Permintaan masuk untuk analisaku */}
      {masuk.length > 0 && (
        <Panel className="mb-4">
          <PanelHead judul="Permintaan Akses Masuk"
            sub="Pembeli yang menunggu persetujuanmu — periksa buktinya dulu." />
          <div className="space-y-2 px-5 pb-4">
            {masuk.map((m) => (
              <div key={m.id + m.uid} className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800/60 p-3 text-[12.5px]">
                <span className="text-zinc-300">{m.nama || m.uid.slice(0, 10)}</span>
                <span className="text-zinc-500">→ {m.judul}</span>
                {m.bukti && <span className="max-w-[280px] truncate text-zinc-500" title={m.bukti}>bukti: {m.bukti}</span>}
                <span className="ml-auto flex gap-2">
                  <button onClick={() => void putuskanAkses(m.id, m.uid, 'setujui').then(segarkan)}
                    className="flex cursor-pointer items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1 text-[11.5px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25">
                    <CheckCircle2 className="size-3.5" /> Setujui
                  </button>
                  <button onClick={() => void putuskanAkses(m.id, m.uid, 'tolak').then(segarkan)}
                    className="cursor-pointer rounded-md border border-zinc-800 px-2.5 py-1 text-[11.5px] text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-400">
                    Tolak
                  </button>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Posting */}
      <Panel className="mb-4">
        <PanelHead
          judul="Copy Trading"
          sub="Posting rencana trade-mu — orang menilai dari rekam jejak jurnalmu, bukan dari klaim."
          kanan={
            <span className="flex items-center gap-2">
              <button onClick={segarkan} aria-label="Segarkan"
                className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
                <RefreshCw className={cn('size-3.5', memuat && 'animate-spin')} />
              </button>
              {pengguna && (
                <button onClick={() => setFormBuka((v) => !v)}
                  className="cursor-pointer rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
                  {formBuka ? 'Tutup form' : 'Posting analisa'}
                </button>
              )}
            </span>
          }
        />
        {formBuka && (
          <div className="border-t border-zinc-800/80 px-5 py-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] text-zinc-500">Judul</label>
                <input value={judul} onChange={(e) => setJudul(e.target.value)} className={KELAS_ISIAN} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">Pasangan</label>
                <input value={pasangan} onChange={(e) => setPasangan(e.target.value.toUpperCase())} className={cn(KELAS_ISIAN, 'angka')} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">Arah</label>
                <select value={arah} onChange={(e) => setArah(e.target.value as 'BUY' | 'SELL')} className={cn(KELAS_ISIAN, 'cursor-pointer')}>
                  <option>BUY</option><option>SELL</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">Harga akses ($, 0 = gratis)</label>
                <input type="number" value={hargaJual} onChange={(e) => setHargaJual(Number(e.target.value) || 0)} className={cn(KELAS_ISIAN, 'angka')} />
              </div>
              <div><label className="mb-1 block text-[11px] text-zinc-500">Entry</label>
                <input value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" className={cn(KELAS_ISIAN, 'angka')} /></div>
              <div><label className="mb-1 block text-[11px] text-zinc-500">SL</label>
                <input value={sl} onChange={(e) => setSl(e.target.value)} inputMode="decimal" className={cn(KELAS_ISIAN, 'angka')} /></div>
              <div><label className="mb-1 block text-[11px] text-zinc-500">TP</label>
                <input value={tp} onChange={(e) => setTp(e.target.value)} inputMode="decimal" className={cn(KELAS_ISIAN, 'angka')} /></div>
              <div className="col-span-2 sm:col-span-4">
                <label className="mb-1 block text-[11px] text-zinc-500">Ringkasan publik (terlihat sebelum dibayar — sertakan kontak pembayaranmu)</label>
                <input value={ringkas} onChange={(e) => setRingkas(e.target.value)} className={KELAS_ISIAN} />
              </div>
              <div className="col-span-2 sm:col-span-4">
                <label className="mb-1 block text-[11px] text-zinc-500">Alasan / analisa lengkap (terkunci)</label>
                <textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={3}
                  className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-2.5 text-[12.5px] text-zinc-200 outline-none focus-visible:border-zinc-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={() => void posting()} disabled={sibuk || !judul.trim() || !entry}
                className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50">
                {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Posting
              </button>
              <span className="text-[11.5px] text-zinc-600">
                Rekam jejak jurnalmu ({snapshot.jumlah} transaksi, winrate {persen(snapshot.winrate)}) ikut terlampir otomatis.
              </span>
            </div>
          </div>
        )}
        {kabar && <p className="px-5 pb-4 text-[12px] text-zinc-400">{kabar}</p>}
        {!pengguna && (
          <p className="px-5 pb-4 text-[12.5px] text-zinc-500">Masuk dulu untuk memposting atau membeli analisa.</p>
        )}
      </Panel>

      {/* Daftar */}
      {memuat ? (
        <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-zinc-500">
          <Loader2 className="size-4 animate-spin" /> Memuat analisa…
        </div>
      ) : daftar.length === 0 ? (
        <Panel className="px-5 py-10 text-center text-[13px] text-zinc-500">
          Belum ada analisa. Jadilah yang pertama memposting.
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {daftar.map((a) => (
            <KartuAnalisa key={a.id} a={a} status={statusku[a.id]}
              milikku={a.uid === pengguna?.uid} onSegarkan={segarkan} />
          ))}
        </div>
      )}
    </div>
  );
}
