import { useState } from 'react';
import { Clock, RefreshCw, ShieldAlert } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { useAuth } from '@/lib/auth';
import { useLaporan, tandaiLaporan } from '@/lib/admin';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   ERROR & FIXING — laporan bug, saran, dan error dari pengguna
   ════════════════════════════════════════════════════════════════════════
   Dulu panel "Activity" di halaman Sales Report. Pindah ke Maintenance atas
   permintaan pemilik, dan tempatnya memang di sini: Sales Report menjawab
   "usahanya untung berapa", sementara daftar ini menjawab "apa yang rusak".
   Dua pertanyaan yang tidak pernah ditanyakan bersamaan, dan yang kedua
   selalu kalah perhatian kalau diletakkan di sebelah angka pemasukan.

   Berdiri sendiri, tidak memakai pembantu di Pemilik.tsx: yang di sana
   tidak diekspor, dan menyalinnya ke sini lebih murah daripada membuat satu
   halaman bergantung pada isi dalam halaman lain.
   ════════════════════════════════════════════════════════════════════════ */

function jamLalu(ms: number) {
  const detik = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (detik < 60) return 'baru saja';
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} mnt lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.floor(jam / 24)} hari lalu`;
}

export default function PanelLaporanPengguna() {
  const { pemilik } = useAuth();
  const laporan = useLaporan();
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState('');

  /* Saringan status. Bawaannya "belum selesai" — daftar yang selalu terbuka
     pada SEMUA laporan membuat yang sudah dibereskan bulan lalu ikut
     menumpuk di layar, dan yang baru masuk tenggelam di bawahnya. */
  const [saring, setSaring] = useState<'baru' | 'semua'>('baru');
  const tampil = laporan.data.filter((l) => (saring === 'semua' ? true : l.status === 'baru'));
  const jumlahBaru = laporan.data.filter((l) => l.status === 'baru').length;

  async function selesaikan(id: string) {
    setSibuk(true); setPesan('');
    try {
      await tandaiLaporan(id, 'selesai');
      setPesan('Laporan ditandai selesai.');
      laporan.muatUlang();
    } catch (e) {
      setPesan('Gagal: ' + (e instanceof Error ? e.message : 'tidak diketahui'));
    } finally { setSibuk(false); }
  }

  return (
    <Panel>
      <PanelHead
        judul="Laporan Pengguna"
        sub="Bug, saran, dan error yang dikirim dari dalam aplikasi."
        kanan={
          <div className="flex items-center gap-2">
            {/* Dua tombol saringan, bukan satu sakelar: label sakelar harus
                menyebut keadaan LAIN untuk bisa dimengerti, dan orang selalu
                sepersekian detik ragu apakah tulisannya keadaan sekarang
                atau keadaan sesudah ditekan. */}
            <div className="flex rounded-md border border-zinc-800 p-0.5">
              {([['baru', `Belum selesai${jumlahBaru ? ` · ${jumlahBaru}` : ''}`], ['semua', 'Semua']] as const).map(([nilai, label]) => (
                <button key={nilai} onClick={() => setSaring(nilai)}
                  className={cn('cursor-pointer rounded px-2 py-1 text-[11.5px] transition-colors',
                    saring === nilai ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={laporan.muatUlang} title="Segarkan" aria-label="Segarkan laporan"
              className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
              <RefreshCw className={cn('size-3.5', laporan.memuat && 'animate-spin')} />
            </button>
          </div>
        } />

      <div className="px-5 pb-5">
        {pesan && (
          <div className={cn('mb-3 rounded-lg border px-3 py-2 text-[12.5px]',
            /gagal/i.test(pesan) ? 'border-amber-500/30 bg-amber-500/5 text-amber-200/90'
              : 'border-zinc-800 bg-zinc-900/60 text-zinc-300')}>
            {pesan}
          </div>
        )}

        {laporan.memuat && !laporan.data.length && (
          <div className="py-6 text-center text-[12.5px] text-zinc-600">Memuat…</div>
        )}
        {laporan.galat && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" strokeWidth={2} />
            <div className="text-[12.5px] text-amber-200/90">{laporan.galat}</div>
          </div>
        )}
        {!laporan.memuat && !laporan.galat && !tampil.length && (
          <div className="py-6 text-center text-[12.5px] text-zinc-600">
            {saring === 'baru' && laporan.data.length
              ? 'Semua laporan sudah dibereskan.'
              : 'Belum ada laporan dari pengguna.'}
          </div>
        )}

        {tampil.map((l) => (
          <div key={l.id} className="flex gap-3 border-b border-zinc-800/50 py-3 last:border-0">
            <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
              <Clock className="size-3 text-zinc-500" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] uppercase',
                  l.jenis === 'error' ? 'bg-red-500/10 text-red-400'
                    : l.jenis === 'saran' ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-amber-500/10 text-amber-400')}>{l.jenis}</span>
                {l.status === 'baru' ? (
                  <button onClick={() => void selesaikan(l.id)} disabled={sibuk || !pemilik}
                    title={pemilik ? undefined : 'Hanya pemilik yang boleh menandai selesai'}
                    className="cursor-pointer text-[10px] text-zinc-500 underline-offset-2 transition-colors hover:text-emerald-500 hover:underline disabled:cursor-not-allowed disabled:opacity-50">
                    tandai selesai
                  </button>
                ) : (
                  <span className="text-[10px] text-emerald-600/80">{l.status}</span>
                )}
              </div>
              {/* Pesannya UTUH, tidak lagi dipotong tiga baris. Di Sales
                  Report panel ini cuma sepertiga lebar layar dan potongan
                  itu perlu; di halamannya sendiri, laporan error yang
                  terpenggal di tengah jejak galat tidak bisa dipakai. */}
              <div className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-zinc-300">{l.pesan}</div>
              <div className="mt-0.5 text-[11.5px] text-zinc-600">
                {l.halaman}{l.email ? ` · ${l.email}` : ''} · {jamLalu(l.waktu)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
