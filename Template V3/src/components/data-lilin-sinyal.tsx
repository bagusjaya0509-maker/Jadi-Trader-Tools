import { CandlestickChart, CircleHelp } from 'lucide-react';
import { cn, uang } from '@/lib/utils';
import type { RingkasAnalisa } from '@/lib/analisa';

/* ════════════════════════════════════════════════════════════════════════
   DATA LILIN — jejak penilaian tiap sinyal
   ════════════════════════════════════════════════════════════════════════
   Rak keempat di Daftar Signal, di samping kanan "Sudah selesai".

   Seluruh papan peringkat di produk ini berdiri di atas satu janji: hasil
   sinyal TIDAK ditulis siapa pun, ia dibaca dari lilin sungguhan sejak
   detik sinyalnya diposting. Janji itu diulang di beberapa layar, dan
   sampai sekarang tidak ada satu tempat pun yang bisa dipakai orang untuk
   MEMERIKSANYA. Layar ini tempatnya.

   Yang ditampilkan bukan angka baru — semuanya sudah dipakai di tempat
   lain — melainkan asal-usulnya: dari bursa mana lilinnya diambil, di
   timeframe berapa, kapan entry-nya tersentuh, dan kapan hasilnya jatuh.
   Dengan itu siapa pun bisa membuka chart yang sama di jam yang sama dan
   membantahnya kalau kami salah.

   ── KENAPA JAM SENTUHAN DITAHAN UNTUK SINYAL YANG MASIH JALAN ─────────
   Waktu entry tersentuh menunjuk SATU lilin, dan lilin itu terbuka untuk
   siapa pun di Binance. Rentang high–low-nya mempersempit tebakan entry
   sampai beberapa dolar — yaitu memberikan sebagian dari yang justru
   dijual analisnya. Server menahannya sampai sinyalnya selesai (gerbang
   yang sama dengan sampul dan level); di sini yang tampil cuma "sudah
   tersentuh", yang memang sudah publik di kartunya.
   ════════════════════════════════════════════════════════════════════════ */

/** "19 Agu 14:32" — tanggal DAN jam, karena yang diperiksa di sini justru
 *  urutan kejadiannya. Tanggal saja tidak cukup untuk membuka chart di
 *  tempat yang sama. */
function jamPendek(ms?: number | null) {
  if (!ms) return null;
  return new Date(ms).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).replace(/\./g, ':');
}

/** Sumber lilin yang dipakai penilai. Server mencatatnya sejak 20 Agu 2026;
 *  sinyal yang selesai sebelum itu tidak punya catatannya, dan untuk kripto
 *  nilainya bisa disebutkan dengan pasti — `ambilKlines` selalu menarik 15m
 *  dari Binance Futures, tidak pernah dari yang lain. Untuk MT5 timeframe-nya
 *  dipilih per sinyal, jadi yang lama cuma bisa menyebut bursanya. */
function sumberLilin(a: RingkasAnalisa): { teks: string; pasti: boolean } {
  if (a.sumberLilin) return { teks: a.sumberLilin, pasti: true };
  const kripto = a.pasar ? a.pasar === 'kripto' : /USDT$/i.test(a.pasangan || '');
  return kripto
    ? { teks: 'Binance Futures · 15m', pasti: true }
    : { teks: 'MT5 (EA)', pasti: false };
}

const SEL = 'px-3 py-2.5 align-top';

export function DataLilinSinyal({ sinyal }: { sinyal: RingkasAnalisa[] }) {
  /* Terbaru di atas — sama dengan urutan rak lain, supaya perpindahan
     antar-tab tidak memaksa mata mencari ulang sinyal yang sama. */
  const baris = [...sinyal].sort((a, b) => b.dibuat - a.dibuat);

  if (!baris.length) {
    return (
      <p className="rounded-lg border border-zinc-800/60 px-4 py-6 text-center text-[12px] text-zinc-600">
        Belum ada sinyal untuk ditelusuri.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-[11.5px] leading-relaxed text-zinc-400">
        <CandlestickChart className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
        <span>
          Hasil sinyal di papan peringkat tidak diisi tangan — ia dibaca dari lilin bursa sejak
          sinyalnya diposting. Baris di bawah menunjukkan dari mana lilin itu diambil dan kapan
          tiap kejadiannya jatuh, supaya angkanya bisa diperiksa ulang di chart mana pun.
        </span>
      </p>

      {/* Tabel lebar hidup di dalam wadahnya sendiri: yang menggulir tabelnya,
          bukan halamannya. Halaman yang ikut bergeser mendatar membuat sidebar
          dan kepala kanal ikut hilang dari layar. */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800/60">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-800/80 text-[11px] font-medium text-zinc-500">
              <th className={SEL}>Sinyal</th>
              <th className={SEL}>Sumber lilin</th>
              <th className={SEL}>Diposting</th>
              <th className={SEL}>Entry tersentuh</th>
              <th className={SEL}>Hasil</th>
              <th className={cn(SEL, 'text-right')}>Estimasi</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((a) => {
              const sumber = sumberLilin(a);
              const selesai = a.hasil === 'tp' || a.hasil === 'sl';
              /* Sinyal yang belum pernah tersentuh penilai sama sekali:
                 tidak ada sumber lilin tercatat, tidak ada jenis order, dan
                 belum terisi. Dikatakan apa adanya. Menggambarnya sebagai
                 "menunggu harga" akan mengaku tahu sesuatu yang belum
                 diperiksa siapa pun. */
              const belumDinilai = !a.sumberLilin && !a.jenisEntry && !a.terisi && !a.hasil;
              const jamIsi = jamPendek(a.waktuIsi);
              return (
                <tr key={a.id} className="border-b border-zinc-800/40 text-[12px] last:border-0">
                  <td className={SEL}>
                    <span className="flex items-center gap-1.5">
                      <span className={cn('text-[10px] font-semibold',
                        a.arah === 'BUY' ? 'text-emerald-400' : 'text-red-400')}>{a.arah}</span>
                      <span className="font-medium text-zinc-200">{a.pasangan}</span>
                      {a.tf && <span className="text-[10px] text-zinc-600">{a.tf}</span>}
                    </span>
                    <span className="mt-0.5 block max-w-[240px] truncate text-[11px] text-zinc-600">
                      {a.judul}
                    </span>
                  </td>
                  <td className={cn(SEL, 'text-zinc-400')}>
                    {belumDinilai ? (
                      <span className="flex items-center gap-1.5 text-zinc-600">
                        <CircleHelp className="size-3.5" /> belum dinilai
                      </span>
                    ) : (
                      <span className={cn(!sumber.pasti && 'text-zinc-500')}
                            title={sumber.pasti ? undefined
                              : 'Timeframe yang dipakai penilai baru dicatat sejak 20 Agu 2026 — sinyal ini selesai sebelum itu.'}>
                        {sumber.teks}{!sumber.pasti && ' · tf tak tercatat'}
                      </span>
                    )}
                  </td>
                  <td className={cn(SEL, 'angka whitespace-nowrap text-zinc-400')}>{jamPendek(a.dibuat)}</td>
                  <td className={SEL}>
                    {a.terisi ? (
                      /* Jamnya cuma ada kalau server mengizinkannya — lihat
                         catatan kepala berkas. Yang tidak diizinkan tetap
                         mengatakan BAHWA ia tersentuh, karena itu memang
                         sudah publik di lencana kartunya. */
                      jamIsi
                        ? <span className="angka whitespace-nowrap text-zinc-300">{jamIsi}</span>
                        : <span className="text-zinc-500"
                                title="Jamnya terbuka setelah sinyalnya selesai — ia menunjuk satu lilin, dan lilin itu mempersempit tebakan entry">
                            sudah · jam ditahan
                          </span>
                    ) : (
                      <span className="text-zinc-600">belum</span>
                    )}
                  </td>
                  <td className={SEL}>
                    {a.hasil ? (
                      <span className="flex flex-col gap-0.5">
                        <span className={cn('w-fit rounded px-1.5 py-0.5 text-[10px] font-medium',
                          a.hasil === 'tp' ? 'bg-emerald-500/12 text-emerald-300'
                            : a.hasil === 'sl' ? 'bg-red-500/12 text-red-300'
                            : 'bg-zinc-700/40 text-zinc-400')}>
                          {a.hasil === 'batal' ? 'Dibatalkan' : a.hasil.toUpperCase()}
                        </span>
                        {!!a.waktuHasil && (
                          <span className="angka whitespace-nowrap text-[11px] text-zinc-500">
                            {jamPendek(a.waktuHasil)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-zinc-600">berjalan</span>
                    )}
                  </td>
                  <td className={cn(SEL, 'text-right')}>
                    {selesai && typeof a.hasilDolar === 'number' ? (
                      <span className={cn('angka', a.hasilDolar >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {a.hasilDolar >= 0 ? '+' : ''}{uang(a.hasilDolar)}
                      </span>
                    ) : (
                      <span className="text-zinc-700">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-600">
        Estimasi memakai modal $1.000 dengan risiko 1% per sinyal — model yang sama dengan papan
        peringkat. Ia mengabaikan biaya, slippage, dan ukuran posisi sungguhan.
      </p>
    </div>
  );
}
