import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { bacaSetelanAkses, simpanSetelanAkses, type SetelanAkses } from '@/lib/akses';

/* ════════════════════════════════════════════════════════════════════════
   SETELAN AKSES — sakelar pendaftaran & kuota
   ════════════════════════════════════════════════════════════════════════
   Angkanya hidup di server; panel ini cuma memindahkannya. Sakelar yang
   disimpan di browser bisa dinyalakan siapa pun lewat DevTools, dan kuota
   yang bisa dikarang sendiri bukan kuota.

   Menutup pendaftaran TIDAK mencabut akses siapa pun yang sudah masuk — ia
   hanya menolak permintaan baru. Dua hal itu gampang tertukar, dan
   tertukarnya berarti mengunci orang yang sudah membayar. Karena itu
   kalimatnya ditulis di sebelah sakelarnya, bukan di dokumentasi.
   ════════════════════════════════════════════════════════════════════════ */

function Angka({ label, nilai, pakai, catatan, atur }: {
  label: string;
  nilai: number;
  pakai?: number;
  catatan?: string;
  atur: (n: number) => void;
}) {
  const kurang = pakai !== undefined && nilai < pakai;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11.5px] text-zinc-400">{label}</span>
      <input
        type="number"
        min={0}
        value={nilai}
        onChange={(e) => atur(Math.max(0, Number(e.target.value) || 0))}
        className={cn(
          'angka h-9 w-full rounded-md border bg-zinc-950 px-2.5 text-[13px] text-zinc-100 outline-none focus-visible:border-zinc-600',
          kurang ? 'border-amber-500/40' : 'border-zinc-800',
        )}
      />
      <span className={cn('text-[10.5px] leading-relaxed', kurang ? 'text-amber-400/90' : 'text-zinc-600')}>
        {kurang
          ? `sudah terpakai ${pakai} — kuota di bawah itu menutup pendaftaran, bukan mencabut yang aktif`
          : catatan ?? `terpakai ${pakai}`}
      </span>
    </label>
  );
}

export function PanelSetelanAkses() {
  const [st, setSt] = useState<SetelanAkses | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');

  useEffect(() => {
    let hidup = true;
    bacaSetelanAkses()
      .then((d) => { if (hidup) setSt(d); })
      .catch((e) => { if (hidup) setGalat(e.message); });
    return () => { hidup = false; };
  }, []);

  async function simpan(ubah: Partial<SetelanAkses>) {
    if (!st) return;
    setSibuk(true); setKabar('');
    try {
      const baru = await simpanSetelanAkses({
        bukaPermintaan: ubah.bukaPermintaan ?? st.bukaPermintaan,
        gratisTotal: ubah.gratisTotal ?? st.gratisTotal,
        bayarTotal: ubah.bayarTotal ?? st.bayarTotal,
        hari: ubah.hari ?? st.hari,
      });
      setSt(baru);
      setKabar('Tersimpan. Halaman akses langsung memakai angka ini.');
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Panel className="mt-4">
      <PanelHead
        judul="Setelan Akses"
        sub="Buka atau tutup pendaftaran, dan tentukan sendiri kuotanya."
      />
      <div className="px-5 pb-5">
        {galat ? (
          <div className="py-4 text-[12.5px] text-amber-400/90">{galat}</div>
        ) : !st ? (
          <div className="flex items-center gap-2 py-4 text-[12.5px] text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" /> Memuat…
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="min-w-0">
                <div className="text-[12.5px] text-zinc-200">
                  Pendaftaran {st.bukaPermintaan ? 'dibuka' : 'ditutup'}
                </div>
                <div className="text-[11px] leading-relaxed text-zinc-500">
                  Menutup hanya menolak permintaan baru — yang sudah punya akses tetap masuk.
                </div>
              </div>
              <button
                onClick={() => void simpan({ bukaPermintaan: !st.bukaPermintaan })}
                disabled={sibuk}
                aria-label={st.bukaPermintaan ? 'Tutup pendaftaran' : 'Buka pendaftaran'}
                className={cn(
                  'relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50',
                  st.bukaPermintaan ? 'bg-emerald-500' : 'bg-zinc-700',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 size-5 rounded-full bg-white transition-all',
                    st.bukaPermintaan ? 'left-[22px]' : 'left-0.5',
                  )}
                />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Angka
                label="Kuota gratis"
                nilai={st.gratisTotal}
                pakai={st.gratisTerpakai}
                atur={(n) => setSt({ ...st, gratisTotal: n })}
              />
              <Angka
                label="Kuota berbayar"
                nilai={st.bayarTotal}
                pakai={st.bayarTerpakai}
                atur={(n) => setSt({ ...st, bayarTotal: n })}
              />
              <Angka
                label="Masa akses (hari)"
                nilai={st.hari}
                catatan="berlaku untuk persetujuan berikutnya"
                atur={(n) => setSt({ ...st, hari: Math.max(1, n) })}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => void simpan({})}
                disabled={sibuk}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-4 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50"
              >
                {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Simpan
              </button>
              {kabar && <span className="text-[11.5px] leading-relaxed text-zinc-400">{kabar}</span>}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
