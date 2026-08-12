import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radar, ExternalLink, CandlestickChart } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn, harga as fHarga } from '@/lib/utils';
import { bacaKoneksi } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   SINYAL PANTAUAN — hasil kurasi agen Pemburu Sinyal
   ════════════════════════════════════════════════════════════════════════
   Sinyal dari komunitas yang LOLOS disiplin agen: pair, arah, entry, SL,
   dan TP harus lengkap — sinyal tanpa SL ditolak di hulu dan tidak pernah
   sampai ke panel ini. Sumber dan analisnya ditulis terbuka (disadur
   dengan atribusi), umurnya dihitung di layar, dan R:R dihitung dari
   levelnya sendiri — bukan dari klaim siapa pun.

   Pair Binance membuka chart kita langsung dengan garis SL/TP terpasang;
   pair forex menaut ke chart sumbernya.
   ════════════════════════════════════════════════════════════════════════ */

const PROXY_BAWAAN = 'https://103-253-145-38.sslip.io';

interface Sinyal {
  id: string;
  pair: string;
  arah: 'BUY' | 'SELL';
  tf: string;
  entry: number;
  sl: number;
  tp: number;
  sumber: string;
  analis: string;
  waktu: number;
  catatan: string;
  tautan?: string;
}

function umur(ts: number): string {
  const h = Math.floor((Date.now() - ts) / 3_600_000);
  if (h < 1) return 'baru saja';
  if (h < 24) return `${h} jam lalu`;
  const hari = Math.floor(h / 24);
  return `${hari} hari lalu`;
}

/** "hari ini 21.43" / "Sen 06.13" — cukup untuk tahu agennya masih hidup.
 *  Sengaja memuat JAM: "2 jam lalu" tidak menjawab pertanyaan yang
 *  sebenarnya diajukan, yaitu apakah pemeriksaan terakhir terjadi sebelum
 *  atau sesudah sesi pasar yang sedang dilihat. */
function kapan(ts: number): string {
  const d = new Date(ts);
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const sekarang = new Date();
  const samaHari = d.toDateString() === sekarang.toDateString();
  if (samaHari) return `hari ini ${jam}`;
  const kemarin = new Date(sekarang.getTime() - 86_400_000);
  if (d.toDateString() === kemarin.toDateString()) return `kemarin ${jam}`;
  return `${d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })} ${jam}`;
}

export function PanelSinyal() {
  const [daftar, setDaftar] = useState<Sinyal[]>([]);
  const [diperiksa, setDiperiksa] = useState(0);

  useEffect(() => {
    let hidup = true;
    const dasar = (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
    const tarik = () => {
      fetch(`${dasar}/api/sinyal`)
        .then((r) => r.json())
        .then((j) => {
          if (!hidup) return;
          if (Array.isArray(j?.sinyal)) {
            setDaftar(j.sinyal.filter((s: Sinyal) => s.pair && s.entry && s.sl && s.tp));
          }
          if (Number(j?.diperiksa) > 0) setDiperiksa(Number(j.diperiksa));
        })
        .catch(() => { /* panel kosong lebih baik daripada panel karangan */ });
    };
    tarik();
    const jam = setInterval(tarik, 120_000);
    return () => { hidup = false; clearInterval(jam); };
  }, []);

  /* Agen dianggap AKTIF kalau pemeriksaan terakhirnya belum lewat 90 menit —
     jadwalnya tiap 30 menit, jadi dua jadwal terlewat berarti ada yang tidak
     beres (aplikasi tertutup, Chrome tidak tersambung). Lampu hijau yang
     menyala terus tanpa memandang kenyataan tidak memberi tahu apa pun. */
  const aktif = diperiksa > 0 && Date.now() - diperiksa < 90 * 60_000;

  /* Panel tetap tampil walau belum ada sinyal — supaya "belum ada sinyal
     baru" bisa dibedakan dari "agennya mati". Yang membedakan cuma baris
     status di kepalanya. */
  if (!daftar.length && !diperiksa) return null;

  /* mb-4, bukan mt-4: panel ini PEMBUKA halaman Copy Trading — jaraknya
     ke bawah (panel permintaan akses), bukan ke atas. Saat kosong ia
     null, jadi margin-nya ikut hilang tanpa menyisakan celah. */
  return (
    <Panel className="mb-4">
      <PanelHead
        judul="Sinyal Pantauan"
        sub="Dikurasi agen Pemburu Sinyal — hanya sinyal berlevel lengkap yang lolos; sumbernya ditulis terbuka."
        kanan={
          <span className="flex items-center gap-2">
            {diperiksa > 0 && (
              <span className="hidden text-[10.5px] text-zinc-500 sm:inline">
                diperiksa {kapan(diperiksa)}
              </span>
            )}
            <span className={cn('flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              aktif ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-500')}>
              <span className={cn('size-1.5 rounded-full', aktif ? 'bg-emerald-400' : 'bg-zinc-600')} />
              {aktif ? 'AI aktif' : 'AI diam'}
            </span>
            <Radar className={cn('size-4', aktif ? 'text-red-400' : 'text-zinc-600')} />
          </span>
        }
      />
      {/* Baris waktu untuk layar sempit — di sana lencana di kepala panel
          sudah penuh, dan kapan terakhir diperiksa terlalu penting untuk
          dibuang begitu saja. */}
      {diperiksa > 0 && (
        <div className="px-5 pb-1 text-[10.5px] text-zinc-600 sm:hidden">
          diperiksa {kapan(diperiksa)}
        </div>
      )}
      {!daftar.length && (
        <p className="px-5 pb-5 text-[12px] leading-relaxed text-zinc-500">
          Belum ada sinyal berlevel lengkap yang lolos.{' '}
          {aktif
            ? 'Agennya memeriksa ruang sinyal tiap 30 menit; postingan tanpa SL absolut memang ditolak di hulu.'
            : 'Agennya sedang tidak memeriksa — ia berjalan saat aplikasi Claude terbuka.'}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 px-5 pb-5 md:grid-cols-2 xl:grid-cols-3">
        {daftar.map((s) => {
          const jarakSl = Math.abs(s.entry - s.sl);
          const jarakTp = Math.abs(s.tp - s.entry);
          const rr = jarakSl > 0 ? jarakTp / jarakSl : 0;
          const kripto = s.pair.endsWith('USDT');
          /* Pair forex tidak berdolar — 181.643 yen bukan $181. */
          const f = (v: number) => (kripto ? fHarga(v) : v.toFixed(3));
          const tua = Date.now() - s.waktu > 3 * 86_400_000;
          return (
            <div key={s.id} className="rounded-xl border border-zinc-800/70 p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[13.5px] font-semibold tracking-tight text-zinc-100">{s.pair}</span>
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold',
                  s.arah === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
                  {s.arah}
                </span>
                <span className="text-[10.5px] uppercase text-zinc-600">{s.tf}</span>
                <span className={cn('ml-auto text-[10.5px]', tua ? 'text-amber-400/80' : 'text-zinc-500')}>
                  {umur(s.waktu)}{tua ? ' · periksa ulang' : ''}
                </span>
              </div>
              <div className="mb-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-zinc-900/70 py-1.5">
                  <div className="text-[9.5px] uppercase tracking-wide text-zinc-600">Entry</div>
                  <div className="angka text-[12.5px] text-zinc-200">{f(s.entry)}</div>
                </div>
                <div className="rounded-lg bg-red-500/[0.07] py-1.5">
                  <div className="text-[9.5px] uppercase tracking-wide text-red-400/70">SL</div>
                  <div className="angka text-[12.5px] text-red-400">{f(s.sl)}</div>
                </div>
                <div className="rounded-lg bg-emerald-500/[0.07] py-1.5">
                  <div className="text-[9.5px] uppercase tracking-wide text-emerald-500/70">TP</div>
                  <div className="angka text-[12.5px] text-emerald-500">{f(s.tp)}</div>
                </div>
              </div>
              <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-500">
                <span>R:R <span className={cn('angka', rr >= 1.5 ? 'text-emerald-500' : 'text-zinc-300')}>1 : {rr.toFixed(2)}</span></span>
                <span className="truncate">· {s.analis}</span>
              </div>
              <p className="mb-2.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-600" title={s.catatan}>
                {s.catatan}
              </p>
              <div className="flex items-center gap-2">
                {kripto ? (
                  <Link to={`/chart?simbol=${s.pair}&sl=${s.sl}&tp=${s.tp}`}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-950 transition-colors hover:bg-white">
                    <CandlestickChart className="size-3" /> Buka di Chart
                  </Link>
                ) : s.tautan ? (
                  <a href={s.tautan} target="_blank" rel="noreferrer"
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100">
                    <ExternalLink className="size-3" /> Chart sumber
                  </a>
                ) : null}
                <span className="ml-auto truncate text-[10px] text-zinc-600">{s.sumber}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
