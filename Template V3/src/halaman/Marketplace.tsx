import { useState } from 'react';
import { Check, Crown, Download, Copy, X, Star, MessageCircle, ExternalLink } from 'lucide-react';
import { PeragaProduk } from '@/components/peraga-produk';
import { TESTIMONI } from '@/data/porto';
import { Panel, PanelHead, KartuKpi } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { type Produk } from '@/data/contoh';
import { useProduk } from '@/lib/data';

export default function Marketplace() {
  const [aktif, setAktif] = useState<Produk | null>(null);
  const { data: PRODUK } = useProduk();

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Produk tayang"   nilai={String(PRODUK.length)} catatan={`${PRODUK.filter((p) => p.premium).length} premium · ${PRODUK.filter((p) => !p.premium).length} gratis`} />
        <KartuKpi label="Unduhan bulan ini" nilai="128" delta={22.5} />
        <KartuKpi label="Lisensi aktif"   nilai="3"   delta={9.1} />
        <KartuKpi label="Pendapatan"      nilai="$110.00" delta={12.4} />
      </div>

      <Panel className="mt-4">
        <PanelHead
          judul="Products"
          sub="Indikator TradingView dan Expert Advisor MetaTrader yang dipakai di terminal ini."
        />
        <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
          {PRODUK.map((p) => (
            <Panel key={p.id} className={cn('flex flex-col p-5', p.premium && 'border-amber-500/30')}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-semibold tracking-tight text-zinc-100">{p.nama}</h3>
                {p.premium && <Crown className="size-4 shrink-0 text-amber-400" />}
              </div>
              <div className="mt-1 text-[11.5px] text-zinc-600">{p.versi}</div>
              <p className="mt-3 flex-1 text-[12.5px] leading-relaxed text-zinc-400">{p.ringkas}</p>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="angka text-xl font-semibold tracking-tight">
                  {p.harga === 0
                    ? <span className="text-emerald-500">Free</span>
                    : <span className="text-zinc-100">${p.harga}</span>}
                </div>
                <button
                  onClick={() => setAktif(p)}
                  className="cursor-pointer rounded-md border border-zinc-800 px-3 py-1.5 text-[12px]
                             text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                >
                  Detail
                </button>
              </div>
            </Panel>
          ))}
        </div>
      </Panel>

      {/* ── Testimoni + rating ── */}
      <Panel className="mt-4">
        <PanelHead
          judul="Ulasan Pengguna"
          sub="Ditulis langsung oleh pemakai, bukan kutipan pilihan."
          kanan={
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className={cn('size-3.5', i <= 5 ? 'fill-amber-400 text-amber-400' : 'text-zinc-700')} />
                ))}
              </span>
              <span className="angka text-[12.5px] text-zinc-300">4.8</span>
              <span className="text-[11.5px] text-zinc-600">{TESTIMONI.length} ulasan</span>
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-4 px-5 pb-5 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {TESTIMONI.map((t) => (
              <div key={t.nama} className="rounded-lg border border-zinc-800/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-300">
                    {t.nama.charAt(0)}
                  </span>
                  <span className="text-[13px] text-zinc-200">{t.nama}</span>
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={cn('size-3', i <= t.bintang ? 'fill-amber-400 text-amber-400' : 'text-zinc-700')} />
                    ))}
                  </span>
                  <span className="ml-auto text-[11.5px] text-zinc-600">{t.tgl}</span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-400">{t.isi}</p>
                <div className="mt-2 text-[11px] text-zinc-600">tentang {t.produk}</div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-800/60 p-4">
              <div className="mb-2 text-[12.5px] font-medium text-zinc-200">Tulis ulasanmu</div>
              <div className="mb-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button key={i} aria-label={`Beri ${i} bintang`}
                    className="cursor-pointer text-zinc-700 transition-colors hover:text-amber-400">
                    <Star className="size-5" />
                  </button>
                ))}
              </div>
              <textarea rows={4} placeholder="Apa yang kamu suka, dan apa yang masih kurang?"
                className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600" />
              <button className="mt-2 w-full cursor-pointer rounded-md bg-zinc-100 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white">
                Kirim ulasan
              </button>
            </div>

            <a href="#" className="flex items-center gap-3 rounded-lg border border-indigo-500/25 bg-indigo-500/[0.06] p-4 transition-colors hover:border-indigo-500/40">
              <MessageCircle className="size-5 shrink-0 text-indigo-400" strokeWidth={1.8} />
              <div className="min-w-0">
                <div className="text-[13px] text-zinc-100">Diskusi di Discord</div>
                <div className="text-[11.5px] text-zinc-500">Tanya setup, lapor bug, bagi hasil backtest.</div>
              </div>
            </a>
          </div>
        </div>
      </Panel>

      {aktif && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => setAktif(null)}
        >
          <Panel className="my-4 w-full max-w-3xl bg-zinc-950" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 p-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">{aktif.nama}</h2>
                <div className="mt-1 text-[12px] text-zinc-500">{aktif.versi}</div>
              </div>
              <button onClick={() => setAktif(null)} aria-label="Tutup"
                className="cursor-pointer text-zinc-500 transition-colors hover:text-zinc-100">
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="angka mb-5 text-2xl font-semibold">
                {aktif.harga === 0 ? <span className="text-emerald-500">Free</span> : <span className="text-zinc-100">${aktif.harga}</span>}
              </div>
              <p className="mb-6 text-[13.5px] leading-[1.75] text-zinc-400">{aktif.ringkas}</p>

              {/* Tangkapan layar dari katalog Firestore. Dimuat malas dan
                  diberi tinggi tetap: tanpa itu, gambar yang datang belakangan
                  mendorong isi halaman ke bawah tepat saat orang sedang
                  membaca. Gagal muat disembunyikan, bukan dibiarkan jadi ikon
                  rusak — gambar produk yang patah lebih buruk daripada tidak
                  ada gambar. */}
              {aktif.gambar && aktif.gambar.length > 0 && (
                <div className="mb-6 -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                  {aktif.gambar.map((src, i) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer"
                       className="shrink-0 overflow-hidden rounded-lg border border-zinc-800 transition-colors hover:border-zinc-600">
                      <img src={src} alt={`Tangkapan layar ${i + 1} — ${aktif.nama}`}
                           loading="lazy" width={260} height={146}
                           className="block h-[146px] w-[260px] bg-zinc-900 object-cover"
                           onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                    </a>
                  ))}
                </div>
              )}

              {aktif.detail && (
                <div className="mb-6">
                  <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">Penjelasan</div>
                  <p className="text-[13px] leading-[1.8] text-zinc-400">{aktif.detail}</p>
                </div>
              )}

              {/* Animasi peraga cara kerja. Inilah yang hilang di versi
                  sebelumnya: tanpa ini halaman detail cuma daftar kalimat,
                  dan pengunjung tidak punya cara membayangkan hasilnya. */}
              <div className="mb-6">
                <div className="mb-3 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">Cara kerjanya</div>
                <PeragaProduk id={aktif.id} />
              </div>

              <div className="mb-6">
                <div className="mb-3 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">Features</div>
                <ul className="space-y-3">
                  {aktif.fitur.map((f) => {
                    /* Katalog nyata memakai `nama|penjelasan`; data contoh
                       hanya nama. Dipisah supaya nama fiturnya menonjol —
                       satu paragraf panjang di samping centang tidak terbaca
                       sebagai daftar fitur, melainkan sebagai dinding teks. */
                    const [nama, ...sisa] = f.split('|');
                    const jelas = sisa.join('|').trim();
                    return (
                      <li key={f} className="flex items-start gap-2.5 text-[13px]">
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" strokeWidth={2.2} />
                        <span className="min-w-0">
                          <span className="text-zinc-200">{nama.trim()}</span>
                          {jelas && <span className="mt-0.5 block text-[12.5px] leading-relaxed text-zinc-500">{jelas}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {aktif.harga === 0 ? (
                <div className="flex flex-wrap gap-3">
                  <button className="flex cursor-pointer items-center gap-2 rounded-full bg-zinc-100 px-6 py-3 text-[13px] font-semibold text-zinc-950 transition-colors hover:bg-white">
                    <Copy className="size-4" /> Salin Kode
                  </button>
                  {aktif.id === 'jadi-trader-sync' && (
                    <button className="flex cursor-pointer items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-6 py-3 text-[13px] font-semibold text-zinc-100 transition-colors hover:border-zinc-700">
                      <Download className="size-4" /> Unduh .ex5
                    </button>
                  )}
                </div>
              ) : (
                <Panel className="border-amber-500/25 bg-amber-500/[0.04] p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Crown className="size-4 text-amber-400" />
                    <span className="font-semibold text-zinc-100">Lisensi Personal</span>
                  </div>
                  <p className="mb-4 text-[12.5px] leading-relaxed text-zinc-400">
                    Isi data untuk menerbitkan nomor lisensi atas namamu.
                  </p>
                  {aktif.lynk && (
                    <a href={aktif.lynk} target="_blank" rel="noreferrer"
                       className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-5 py-2.5 text-[12.5px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/25">
                      Beli di toko <ExternalLink className="size-3.5" />
                    </a>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {['Nama lengkap', 'Email'].map((ph) => (
                      <input key={ph} placeholder={ph}
                        className="h-10 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[13px] text-zinc-100
                                   outline-none transition-colors placeholder:text-zinc-600 focus-visible:border-zinc-600" />
                    ))}
                  </div>
                  <button className="mt-4 cursor-pointer rounded-md bg-zinc-100 px-4 py-2 text-[12.5px] font-semibold text-zinc-950 transition-colors hover:bg-white">
                    Buat Kode Lisensi
                  </button>
                </Panel>
              )}

              <div className="mt-6 border-t border-zinc-800/80 pt-5 text-[12px] text-zinc-500">
                Prototipe — tombol di layar ini belum tersambung ke backend.
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
