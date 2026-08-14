import { useState } from 'react';
import { X, Upload, Loader2, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { Panel } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { rupiah, warnaKategori } from '@/data/porto';
import { bacaLembar, keAsetDanKewajiban, type BarisImpor } from '@/lib/impor-porto';
import type { IsiPorto } from '@/lib/porto';
import { useTutupLuar } from '@/lib/tutup-luar';

/* ════════════════════════════════════════════════════════════════════════
   IMPOR LEMBAR -> PRATINJAU -> SIMPAN
   ════════════════════════════════════════════════════════════════════════
   Tiga langkah, dan langkah tengahnya yang paling penting: apa pun yang
   dibaca dari lembar DITAMPILKAN DULU, lengkap dengan tebakan kategorinya,
   dan pengguna bisa mengubah semuanya sebelum satu baris pun tersimpan.

   Impor yang langsung menimpa adalah cara tercepat menghancurkan catatan
   yang sudah rapi — dan pemiliknya baru sadar setelah tidak ada jalan
   kembali.
   ════════════════════════════════════════════════════════════════════════ */

const KATEGORI_CEPAT = ['Kripto', 'Sekuritas', 'Emas', 'Bank', 'E-Wallet', 'Tunai'];

export function ModalImporPorto({ isi, simpan, tutup }: {
  isi: IsiPorto;
  simpan: (baru: IsiPorto) => Promise<void>;
  tutup: () => void;
}) {
  const [baris, setBaris] = useState<BarisImpor[] | null>(null);
  const [namaBerkas, setNamaBerkas] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const [ganti, setGanti] = useState(true);

  async function pilihBerkas(berkas: File | undefined) {
    if (!berkas) return;
    setSibuk(true); setGalat(''); setNamaBerkas(berkas.name);
    try {
      const hasil = await bacaLembar(berkas);
      if (!hasil.length) throw new Error('Tidak ada baris yang bisa dibaca dari lembar ini.');
      setBaris(hasil);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membaca berkas');
      setBaris(null);
    } finally { setSibuk(false); }
  }

  async function simpanHasil() {
    if (!baris) return;
    setSibuk(true); setGalat('');
    try {
      const { aset, kewajiban } = keAsetDanKewajiban(baris);
      await simpan({
        /* "Ganti" mengosongkan dulu; "tambahkan" menyambung ke yang ada.
           Bawaannya mengganti, karena lembar seperti ini biasanya foto utuh
           kondisi terkini — tapi pilihannya harus terlihat, bukan ditebak. */
        aset: ganti ? aset : [...isi.aset, ...aset],
        kewajiban: ganti ? kewajiban : [...isi.kewajiban, ...kewajiban],
        bulanan: isi.bulanan,
      });
      tutup();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally { setSibuk(false); }
  }

  const dipakai = baris?.filter((b) => b.pakai) ?? [];
  const totalAset = dipakai.filter((b) => !b.kewajiban).reduce((s, b) => s + b.nilai, 0);
  const totalBon = dipakai.filter((b) => b.kewajiban).reduce((s, b) => s + b.nilai, 0);

  const ubah = (i: number, tambal: Partial<BarisImpor>) =>
    setBaris((d) => d?.map((b, j) => (j === i ? { ...b, ...tambal } : b)) ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
         {...useTutupLuar(tutup)}>
      <Panel className="my-4 w-full max-w-3xl bg-zinc-950" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-100">Impor Lembar Portofolio</h2>
            <div className="mt-0.5 text-[12px] text-zinc-500">
              {baris ? `${namaBerkas} · ${baris.length} baris terbaca` : 'Excel (.xlsx) atau CSV'}
            </div>
          </div>
          <button onClick={tutup} aria-label="Tutup"
                  className="cursor-pointer text-zinc-500 transition-colors hover:text-zinc-100">
            <X className="size-5" />
          </button>
        </div>

        {!baris ? (
          <div className="px-6 py-6">
            <label className={cn('flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-4 py-10 text-center transition-colors',
              sibuk ? 'cursor-wait opacity-60' : 'cursor-pointer hover:border-zinc-600 hover:bg-zinc-900/40')}>
              {sibuk ? <Loader2 className="size-6 animate-spin text-zinc-500" /> : <Upload className="size-6 text-zinc-500" strokeWidth={1.6} />}
              <span className="text-[13px] text-zinc-300">{sibuk ? 'Membaca lembar…' : 'Pilih berkas .xlsx atau .csv'}</span>
              <span className="text-[11.5px] text-zinc-600">Dua kolom: nama pos di kiri, nilainya di kanan</span>
              <input type="file" accept=".xlsx,.csv,.txt" className="hidden" disabled={sibuk}
                     onChange={(e) => void pilihBerkas(e.target.files?.[0])} />
            </label>

            <div className="mt-4 rounded-lg border border-zinc-800/60 p-4 text-[12px] leading-relaxed text-zinc-500">
              <div className="mb-2 flex items-center gap-2 text-zinc-300">
                <FileSpreadsheet className="size-4" /> Yang dikenali otomatis
              </div>
              <ul className="space-y-1">
                <li>· Angka format Indonesia — <span className="angka text-zinc-400">25.650.000</span> terbaca 25,65 juta, bukan 25,65</li>
                <li>· Nilai dalam kurung <span className="angka text-zinc-400">(6.275.420)</span> dibaca sebagai negatif</li>
                <li>· Baris <span className="text-zinc-400">Jumlah Total</span>, <span className="text-zinc-400">Porto Bersih</span> dikenali sebagai ringkasan dan tidak dicentang</li>
                <li>· Blok <span className="text-zinc-400">Kredit / Bon / Arisan</span> masuk ke kewajiban</li>
                <li>· Kategori ditebak dari namanya — dan semuanya bisa kamu ubah di langkah berikutnya</li>
              </ul>
            </div>
            {galat && <div className="mt-3 text-[12.5px] text-amber-300/90">{galat}</div>}
          </div>
        ) : (
          <>
            <div className="max-h-[46vh] overflow-y-auto px-6 py-4">
              <table className="w-full text-[12.5px]">
                <thead className="sticky top-0 bg-zinc-950">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500">
                    <th className="w-8 pb-2" />
                    <th className="pb-2 font-medium">Pos</th>
                    <th className="pb-2 text-right font-medium">Nilai</th>
                    <th className="pb-2 pl-3 font-medium">Jenis</th>
                  </tr>
                </thead>
                <tbody>
                  {baris.map((b, i) => (
                    <tr key={i} className={cn('border-b border-zinc-800/50', !b.pakai && 'opacity-40')}>
                      <td className="py-1.5">
                        <input type="checkbox" checked={b.pakai} onChange={(e) => ubah(i, { pakai: e.target.checked })}
                               className="size-3.5 cursor-pointer accent-zinc-200" aria-label={`Pakai ${b.nama}`} />
                      </td>
                      <td className="py-1.5">
                        <input value={b.nama} onChange={(e) => ubah(i, { nama: e.target.value })}
                               className="w-full bg-transparent text-zinc-200 outline-none focus-visible:text-white" />
                      </td>
                      <td className={cn('angka py-1.5 text-right', b.kewajiban ? 'text-red-400' : 'text-zinc-300')}>
                        {rupiah(b.nilai)}
                      </td>
                      <td className="py-1.5 pl-3">
                        <div className="flex items-center gap-1.5">
                          {!b.kewajiban && (
                            <span className="size-2 shrink-0 rounded-sm" style={{ background: warnaKategori(String(b.kategori)) }} />
                          )}
                          {/* Bebas diketik, bukan hanya enam pilihan tetap.
                              `list` memberi saran tanpa mengunci isinya. */}
                          <input list="katImpor" value={b.kewajiban ? 'Kewajiban' : String(b.kategori)}
                                 disabled={b.kewajiban}
                                 onChange={(e) => ubah(i, { kategori: e.target.value })}
                                 className="w-[124px] rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 text-[11.5px] text-zinc-300 outline-none focus-visible:border-zinc-600 disabled:border-transparent disabled:bg-transparent disabled:text-red-400/70" />
                          <button onClick={() => ubah(i, { kewajiban: !b.kewajiban })}
                                  title={b.kewajiban ? 'Jadikan aset' : 'Jadikan kewajiban'}
                                  className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300">
                            {b.kewajiban ? '→ aset' : '→ bon'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="katImpor">{KATEGORI_CEPAT.map((k) => <option key={k} value={k} />)}</datalist>
            </div>

            <div className="border-t border-zinc-800/80 px-6 py-4">
              <div className="mb-3 flex flex-wrap items-center gap-4 text-[12.5px]">
                <span className="text-zinc-500">Aset <span className="angka text-emerald-500">{rupiah(totalAset)}</span></span>
                <span className="text-zinc-500">Kewajiban <span className="angka text-red-400">{rupiah(totalBon)}</span></span>
                <span className="text-zinc-500">Porto bersih <span className="angka text-zinc-100">{rupiah(totalAset - totalBon)}</span></span>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-zinc-400">
                <input type="checkbox" checked={ganti} onChange={(e) => setGanti(e.target.checked)}
                       className="size-3.5 cursor-pointer accent-zinc-200" />
                Ganti seluruh daftar yang ada
                {!ganti && <span className="text-zinc-600">— baris baru akan ditambahkan di bawah yang lama</span>}
              </label>
              {galat && <div className="mt-2 text-[12.5px] text-amber-300/90">{galat}</div>}
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button onClick={() => { setBaris(null); setGalat(''); }} disabled={sibuk}
                        className="cursor-pointer rounded-md border border-zinc-800 px-4 py-2 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-50">
                  Pilih berkas lain
                </button>
                <button onClick={() => void simpanHasil()} disabled={sibuk || dipakai.length === 0}
                        className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-4 py-2 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                  {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                  Simpan {dipakai.length} pos
                </button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
