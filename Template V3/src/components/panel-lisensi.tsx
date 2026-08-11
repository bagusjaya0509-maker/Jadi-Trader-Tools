import { useState } from 'react';
import { Check, X, RefreshCw, Copy, KeyRound, ShieldAlert } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn, tanggalPendek } from '@/lib/utils';
import { usePermintaanLisensi, putuskanLisensi } from '@/lib/admin';

/* ════════════════════════════════════════════════════════════════════════
   PERMINTAAN LISENSI — panel pemilik
   ════════════════════════════════════════════════════════════════════════
   Menyetujui di sini MENERBITKAN kodenya sekaligus mengaktifkannya. Dua
   langkah terpisah akan menyisakan keadaan "sudah disetujui tapi belum
   aktif", dan pembelinya menunggu sesuatu yang tidak akan datang.

   Kodenya ditampilkan SETELAH disetujui supaya bisa disalin dan dikirim ke
   pembeli. Backend tidak menyimpan kode aslinya di daftar aktif — hanya
   sidiknya — jadi baris permintaan inilah satu-satunya tempat kode itu
   masih bisa dibaca.
   ════════════════════════════════════════════════════════════════════════ */

export function PanelLisensi() {
  const { data, memuat, galat, muatUlang } = usePermintaanLisensi();
  const [sibuk, setSibuk] = useState('');
  const [pesan, setPesan] = useState('');
  const [tersalin, setTersalin] = useState('');

  const baru = data.filter((x) => x.status === 'baru');

  async function putuskan(id: string, tindakan: 'setujui' | 'tolak') {
    if (tindakan === 'tolak' && !confirm('Tolak permintaan ini?')) return;
    setSibuk(id); setPesan('');
    try {
      const j: any = await putuskanLisensi(id, tindakan);
      setPesan(tindakan === 'setujui'
        ? `Disetujui. Kode ${j.kode} sudah aktif — salin dan kirim ke pembeli.`
        : 'Permintaan ditolak.');
      muatUlang();
    } catch (e) {
      setPesan('Gagal: ' + (e instanceof Error ? e.message : 'tidak diketahui'));
    } finally { setSibuk(''); }
  }

  return (
    <Panel className="mt-4">
      <PanelHead
        judul="Permintaan Lisensi"
        sub="Pembeli yang menunggu kode aktivasi."
        kanan={
          <span className="flex items-center gap-2">
            {baru.length > 0 && (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-400">
                {baru.length} baru
              </span>
            )}
            <button onClick={muatUlang} aria-label="Segarkan"
              className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
              <RefreshCw className={cn('size-3.5', memuat && 'animate-spin')} />
            </button>
          </span>
        }
      />
      <div className="px-5 pb-5">
        {pesan && (
          <div className={cn('mb-3 rounded-lg border px-3 py-2 text-[12.5px]',
            /gagal/i.test(pesan) ? 'border-amber-500/30 bg-amber-500/5 text-amber-200/90'
              : 'border-zinc-800 bg-zinc-900/60 text-zinc-300')}>
            {pesan}
          </div>
        )}

        {memuat && <div className="py-6 text-center text-[12.5px] text-zinc-600">Memuat…</div>}
        {galat && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" strokeWidth={2} />
            <div className="text-[12.5px] text-amber-200/90">{galat}</div>
          </div>
        )}
        {!memuat && !galat && data.length === 0 && (
          <div className="py-6 text-center text-[12.5px] text-zinc-600">
            Belum ada permintaan. Pembeli mengirimnya dari halaman Marketplace.
          </div>
        )}

        <div className="space-y-2.5">
          {data.map((x) => (
            <div key={x.id} className={cn('rounded-lg border p-3',
              x.status === 'baru' ? 'border-amber-500/25 bg-amber-500/[0.03]' : 'border-zinc-800/60')}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] text-zinc-200">{x.email || x.nama || x.uid}</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] uppercase',
                      x.status === 'baru' ? 'bg-amber-500/10 text-amber-400'
                        : x.status === 'disetujui' ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-zinc-800 text-zinc-500')}>
                      {x.status}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-zinc-500">
                    {x.produk} · {tanggalPendek(x.waktu)}
                    {x.nama && x.email ? ` · ${x.nama}` : ''}
                  </div>
                  {x.catatan && <div className="mt-1 text-[12px] text-zinc-400">{x.catatan}</div>}
                  {x.bukti && (
                    <div className="mt-1 text-[11.5px] text-zinc-600">
                      Bukti: <span className="text-zinc-400">{x.bukti}</span>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {x.status === 'baru' ? (
                    <>
                      <button onClick={() => void putuskan(x.id, 'setujui')} disabled={!!sibuk}
                        className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50">
                        <Check className="size-3.5" /> Setujui
                      </button>
                      <button onClick={() => void putuskan(x.id, 'tolak')} disabled={!!sibuk}
                        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-red-500/30 hover:text-red-400 disabled:opacity-50">
                        <X className="size-3.5" /> Tolak
                      </button>
                    </>
                  ) : x.kode ? (
                    <button onClick={() => { void navigator.clipboard.writeText(x.kode!); setTersalin(x.id); }}
                      title="Salin kode untuk dikirim ke pembeli"
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[11.5px] transition-colors hover:border-zinc-700">
                      {tersalin === x.id
                        ? <><Check className="size-3.5 text-emerald-500" /> tersalin</>
                        : <><Copy className="size-3.5 text-zinc-500" /> <span className="angka text-zinc-300">{x.kode}</span></>}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[11.5px] text-zinc-600">
                      <KeyRound className="size-3.5" /> tanpa kode
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
