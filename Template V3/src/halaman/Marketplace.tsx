import { useState } from 'react';
import {
  Check, Crown, Download, Copy, X, Star, MessageCircle, ExternalLink, KeyRound, Loader2, Trash2,
} from 'lucide-react';
import { PeragaProduk } from '@/components/peraga-produk';
import { Panel, PanelHead, KartuKpi } from '@/components/efferd-ui';
import { cn, uang, tanggalPendek } from '@/lib/utils';
import { type Produk } from '@/data/contoh';
import { useProduk } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { useUlasan, kirimUlasan, hapusUlasan } from '@/lib/ulasan';
import {
  useLisensi, usePenjualan, ambilSumberGratis, ambilSumberBerlisensi, tautanBerkas,
} from '@/lib/admin';

/* Kode lisensi pembeli disimpan di perangkatnya sendiri. Mengetiknya ulang
   tiap kali ingin mengambil versi baru adalah gesekan yang tidak perlu — dan
   kode itu memang bukan rahasia bersama, ia milik pembeli itu sendiri. */
const KUNCI_LISENSI = 'jtLisensiSaya_v1';

/* Jenis sumber ditentukan dari nama berkas di katalog, persis seperti yang
   dilakukan marketplace V2: `.mq5` diambil sebagai mq5, sisanya txt. */
function jenisSumber(berkas?: string): 'txt' | 'mq5' {
  return /\.mq5$/i.test(berkas ?? '') ? 'mq5' : 'txt';
}

/* ── Pengambilan sumber produk ────────────────────────────────────────────
   Satu komponen untuk dua jalur karena keduanya berakhir sama: teks sumber
   di papan klip. Yang berbeda cuma gerbangnya — produk gratis lewat
   `/api/produk/gratis`, premium lewat `/api/produk` dengan kode lisensi.

   Sebelum ini tombolnya cuma hiasan: "Salin Kode" tidak menyalin apa pun,
   dan "Buat Kode Lisensi" menjanjikan sesuatu yang memang tidak bisa
   dilakukan dari sisi pembeli — hanya penjual yang boleh menerbitkan kode. */
function AmbilSumber({ produk }: { produk: Produk }) {
  const [kode, setKode] = useState(() => {
    try { return localStorage.getItem(KUNCI_LISENSI) ?? ''; } catch { return ''; }
  });
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');
  const [gagal, setGagal] = useState(false);
  const gratis = produk.harga === 0;

  async function ambil() {
    setSibuk(true); setKabar(''); setGagal(false);
    try {
      const rapi = kode.trim().toUpperCase();
      const isi = gratis
        ? await ambilSumberGratis(produk.id, jenisSumber(produk.berkas))
        : await ambilSumberBerlisensi(produk.id, rapi);
      await navigator.clipboard.writeText(isi);
      if (!gratis) { try { localStorage.setItem(KUNCI_LISENSI, rapi); } catch { /* mode privat */ } }
      setKabar(`Tersalin — ${isi.length.toLocaleString('id-ID')} karakter. Tempel di Pine Editor TradingView.`);
    } catch (e) {
      setGagal(true);
      const asli = e instanceof Error ? e.message : 'Gagal mengambil sumber';
      /* Pesan backend ditulis untuk pemilik, bukan pembeli. "Produk ini tidak
         ditandai gratis" benar secara teknis tapi tidak memberi tahu pembeli
         apa yang harus dia lakukan — dan jawabannya memang bukan apa-apa,
         melainkan menunggu penjualnya mengunggah sumbernya. */
      setKabar(
        /tidak ditandai gratis|belum tersedia/i.test(asli)
          ? 'Sumbernya belum diunggah ke server. Hubungi penjual — produk ini gratis, cuma berkasnya yang belum dipasang.'
          : asli
      );
    } finally { setSibuk(false); }
  }

  return (
    <div>
      {!gratis && (
        <div className="mb-3">
          <label className="mb-1.5 block text-[11px] text-zinc-500">Kode lisensi</label>
          <input
            value={kode} onChange={(e) => setKode(e.target.value)}
            placeholder="JT3-XXXX-XXXX-XXXX" spellCheck={false}
            className="angka h-10 w-full max-w-[280px] rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[13px]
                       uppercase tracking-wide text-zinc-100 outline-none transition-colors
                       placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-600
                       focus-visible:border-zinc-600" />
          <div className="mt-1.5 text-[11.5px] text-zinc-600">
            Kode diberikan penjual setelah pembayaran diterima.
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => void ambil()} disabled={sibuk || (!gratis && kode.trim().length < 8)}
          className="flex cursor-pointer items-center gap-2 rounded-full bg-zinc-100 px-6 py-3 text-[13px] font-semibold
                     text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
          {sibuk ? <Loader2 className="size-4 animate-spin" /> : gratis ? <Copy className="size-4" /> : <KeyRound className="size-4" />}
          {gratis ? 'Salin Kode' : 'Buka & Salin Kode'}
        </button>
        {/* Berkas biner (.ex5) tidak bisa disalin sebagai teks, jadi jalurnya
            unduhan langsung. Hanya muncul kalau katalog memang menyatakan
            produknya punya versi terkompilasi. */}
        {produk.unduhan && (
          <a href={tautanBerkas(produk.id, gratis ? '' : kode.trim().toUpperCase(), produk.unduhan)}
             className="flex cursor-pointer items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-6 py-3
                        text-[13px] font-semibold text-zinc-100 transition-colors hover:border-zinc-700">
            <Download className="size-4" /> Unduh .{produk.unduhan}
          </a>
        )}
      </div>
      {kabar && (
        <div className={cn('mt-3 text-[12.5px]', gagal ? 'text-amber-300/90' : 'text-emerald-500')}>{kabar}</div>
      )}
    </div>
  );
}

export default function Marketplace() {
  const [aktif, setAktif] = useState<Produk | null>(null);
  const { data: PRODUK } = useProduk();
  const { pengguna, pemilik } = useAuth();
  const lisensi = useLisensi();
  const penjualan = usePenjualan();
  const ulasan = useUlasan();

  const [bintang, setBintang] = useState(5);
  const [tulisan, setTulisan] = useState('');
  const [kirimSibuk, setKirimSibuk] = useState(false);
  const [kabarUlasan, setKabarUlasan] = useState('');

  const pendapatan = penjualan.data.reduce((s, x) => s + x.nilai, 0);
  const rerata = ulasan.data.length
    ? ulasan.data.reduce((s, u) => s + u.bintang, 0) / ulasan.data.length
    : 0;

  async function kirim() {
    setKirimSibuk(true); setKabarUlasan('');
    try {
      await kirimUlasan({ bintang, isi: tulisan, produk: aktif?.nama ?? 'Jadi Trader Tools' });
      setTulisan(''); setBintang(5);
      setKabarUlasan('Ulasanmu terkirim. Terima kasih.');
    } catch (e) {
      setKabarUlasan(e instanceof Error ? e.message : 'Gagal mengirim');
    } finally { setKirimSibuk(false); }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Produk tayang"   nilai={String(PRODUK.length)} catatan={`${PRODUK.filter((p) => p.premium).length} premium · ${PRODUK.filter((p) => !p.premium).length} gratis`} />
        <KartuKpi label="Ulasan" nilai={String(ulasan.data.length)}
                  catatan={ulasan.data.length ? `rata-rata ${rerata.toFixed(1)} dari 5` : 'belum ada ulasan'} />
        {/* Dua kartu terakhir butuh App Token — angkanya memang cuma milik
            pemilik. Menampilkan "—" untuk pengunjung jauh lebih jujur
            daripada angka tetap yang terbaca seperti fakta. */}
        <KartuKpi label="Lisensi aktif" nilai={pemilik ? String(lisensi.data.length) : '—'}
                  catatan={pemilik ? 'kode yang sedang berlaku' : 'khusus pemilik'} />
        <KartuKpi label="Pendapatan" nilai={pemilik ? uang(pendapatan) : '—'}
                  catatan={pemilik ? `${penjualan.data.length} penjualan tercatat` : 'khusus pemilik'} />
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
                  <Star key={i} className={cn('size-3.5', i <= Math.round(rerata) ? 'fill-amber-400 text-amber-400' : 'text-zinc-700')} />
                ))}
              </span>
              <span className="angka text-[12.5px] text-zinc-300">{ulasan.data.length ? rerata.toFixed(1) : '—'}</span>
              <span className="text-[11.5px] text-zinc-600">{ulasan.data.length} ulasan</span>
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-4 px-5 pb-5 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {ulasan.memuat && <div className="py-6 text-center text-[12.5px] text-zinc-600">Memuat ulasan…</div>}
            {!ulasan.memuat && ulasan.data.length === 0 && (
              <div className="rounded-lg border border-dashed border-zinc-800 py-8 text-center text-[12.5px] text-zinc-600">
                Belum ada ulasan. Jadilah yang pertama.
              </div>
            )}
            {ulasan.data.map((u) => (
              <div key={u.id} className="rounded-lg border border-zinc-800/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-300">
                    {u.nama.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-[13px] text-zinc-200">{u.nama}</span>
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={cn('size-3', i <= u.bintang ? 'fill-amber-400 text-amber-400' : 'text-zinc-700')} />
                    ))}
                  </span>
                  <span className="ml-auto text-[11.5px] text-zinc-600">{tanggalPendek(u.waktu)}</span>
                  {/* Menghapus hanya muncul untuk yang berhak. Aturan Firestore
                      yang menegakkannya; tombol ini cuma tidak menawarkan
                      sesuatu yang pasti ditolak. */}
                  {(pemilik || pengguna?.uid === u.uid) && (
                    <button onClick={() => { if (confirm('Hapus ulasan ini?')) void hapusUlasan(u.id); }}
                            aria-label="Hapus ulasan"
                            className="cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-red-400">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-zinc-400">{u.isi}</p>
                {u.produk && <div className="mt-2 text-[11px] text-zinc-600">tentang {u.produk}</div>}
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-800/60 p-4">
              <div className="mb-2 text-[12.5px] font-medium text-zinc-200">Tulis ulasanmu</div>
              <div className="mb-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button key={i} aria-label={`Beri ${i} bintang`} onClick={() => setBintang(i)}
                    className="cursor-pointer transition-colors">
                    <Star className={cn('size-5', i <= bintang ? 'fill-amber-400 text-amber-400' : 'text-zinc-700 hover:text-amber-400/60')} />
                  </button>
                ))}
                <span className="angka ml-1 text-[12px] text-zinc-500">{bintang}/5</span>
              </div>
              <textarea rows={4} value={tulisan} onChange={(e) => setTulisan(e.target.value)}
                maxLength={600} disabled={!pengguna}
                placeholder={pengguna ? 'Apa yang kamu suka, dan apa yang masih kurang?' : 'Masuk dulu untuk menulis ulasan.'}
                className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600 disabled:opacity-60" />
              <button onClick={() => void kirim()} disabled={!pengguna || kirimSibuk || !tulisan.trim()}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-zinc-100 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                {kirimSibuk && <Loader2 className="size-3.5 animate-spin" />} Kirim ulasan
              </button>
              {kabarUlasan && <div className="mt-2 text-[11.5px] text-zinc-400">{kabarUlasan}</div>}
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

              {/* Pengambilan sumber — gratis maupun berlisensi. */}
              <AmbilSumber produk={aktif} />

              {aktif.harga > 0 && aktif.lynk && (
                <Panel className="mt-5 border-amber-500/25 bg-amber-500/[0.04] p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Crown className="size-4 text-amber-400" />
                    <span className="font-semibold text-zinc-100">Belum punya kode?</span>
                  </div>
                  <p className="mb-4 text-[12.5px] leading-relaxed text-zinc-400">
                    Beli lisensinya di toko. Setelah pembayaran diterima, penjual mengirimkan
                    kode <span className="angka">JT3-XXXX-XXXX-XXXX</span> yang kamu masukkan di atas.
                  </p>
                  <a href={aktif.lynk} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-5 py-2.5 text-[12.5px]
                                font-semibold text-amber-300 transition-colors hover:bg-amber-500/25">
                    Beli di toko <ExternalLink className="size-3.5" />
                  </a>
                </Panel>
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
