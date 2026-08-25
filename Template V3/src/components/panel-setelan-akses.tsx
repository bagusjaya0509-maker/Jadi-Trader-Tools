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

/* Kembaran `Angka` untuk uang. Bukan menambah prop ke Angka, karena
   bedanya bukan tampilan saja: uang boleh berdesimal (step 0.5), punya
   lambang $ di dalam kotaknya, dan tidak punya gagasan "sudah terpakai".
   Menyatukan keduanya berarti satu komponen dengan dua mode yang saling
   mematikan separuh propnya. */
function Uang({ label, nilai, catatan, atur }: {
  label: string;
  nilai: number;
  catatan?: string;
  atur: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11.5px] text-zinc-400">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-zinc-500">$</span>
        <input
          type="number"
          min={0}
          step={0.5}
          value={nilai}
          onChange={(e) => atur(Math.max(0, Number(e.target.value) || 0))}
          className="angka h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-6 pr-2.5 text-[13px] text-zinc-100 outline-none focus-visible:border-zinc-600"
        />
      </div>
      <span className="text-[10.5px] leading-relaxed text-zinc-600">{catatan}</span>
    </label>
  );
}

/* Kolom tautan checkout. Peringatannya ditulis di bawah kolomnya sendiri,
   bukan di dokumentasi: server MENOLAK DIAM-DIAM tautan yang bukan https,
   dan aturan yang cuma hidup di server adalah aturan yang orangnya temukan
   dengan cara gagal. */
function Tautan({ label, nilai, catatan, atur }: {
  label: string;
  nilai: string;
  catatan?: string;
  atur: (v: string) => void;
}) {
  const salah = nilai.trim() !== '' && !/^https:\/\//.test(nilai.trim());
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11.5px] text-zinc-400">{label}</span>
      <input
        type="url"
        inputMode="url"
        placeholder="https://checkout.xendit.co/…  (kosong = Available soon)"
        value={nilai}
        onChange={(e) => atur(e.target.value)}
        className={cn(
          'h-9 w-full rounded-md border bg-zinc-950 px-2.5 text-[13px] text-zinc-100 outline-none focus-visible:border-zinc-600',
          salah ? 'border-amber-500/50' : 'border-zinc-800',
        )}
      />
      <span className={cn('text-[10.5px] leading-relaxed', salah ? 'text-amber-400/90' : 'text-zinc-600')}>
        {salah
          ? 'harus diawali https:// — selain itu ditolak server dan nilai lamanya dipertahankan'
          : catatan ?? (nilai.trim() ? 'paket ini bisa dibeli' : 'kosong — kartunya tampil "Available soon"')}
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
        hargaTesting: ubah.hargaTesting ?? st.hargaTesting,
        hargaTestingCoret: ubah.hargaTestingCoret ?? st.hargaTestingCoret,
        hargaPremium3: ubah.hargaPremium3 ?? st.hargaPremium3,
        hargaTahunan: ubah.hargaTahunan ?? st.hargaTahunan,
        nilaiMarketplace: ubah.nilaiMarketplace ?? st.nilaiMarketplace,
        kursUsd: ubah.kursUsd ?? st.kursUsd,
        eventGratis: ubah.eventGratis ?? st.eventGratis,
        tampilanAkses: ubah.tampilanAkses ?? st.tampilanAkses,
        linkTesting: ubah.linkTesting ?? st.linkTesting,
        linkPremium3: ubah.linkPremium3 ?? st.linkPremium3,
        linkTahunan: ubah.linkTahunan ?? st.linkTahunan,
      });
      setSt(baru);
      setKabar('Tersimpan. Halaman akses dan bagian harga di halaman depan langsung memakai angka ini.');
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Panel className="mt-4">
      <PanelHead
        judul="Setelan Akses & Harga"
        sub="Buka atau tutup pendaftaran, atur kuotanya, dan tentukan harga tiap paket."
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

            {/* ── TAMPILAN HALAMAN AKSES ────────────────────────────────
                Sakelar tampilan, bukan setelan harga — tapi tinggal di
                panel yang sama karena halamannya sama. Memberinya panel
                sendiri berarti satu judul lagi untuk dilewati demi satu
                pilihan.

                Berlaku untuk SEMUA pengunjung, termasuk yang belum punya
                akun: nilainya ikut di jawaban publik /api/akses/kuota. */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="text-[12.5px] text-zinc-200">Tampilan halaman akses</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                Panel kiri halaman <span className="text-zinc-400">/akses</span>. Berlaku untuk semua
                pengunjung, langsung setelah disimpan. Yang tidak dipakai tetap tersimpan — bisa
                ditukar bolak-balik kapan saja.
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {([
                  { nilai: 'foto' as const, judul: 'Foto', sub: 'Gambar merek hero-bg.webp' },
                  { nilai: 'lonceng' as const, judul: 'Lonceng', sub: 'Lonceng bercahaya, animasi CSS' },
                ]).map((o) => {
                  const aktif = (st.tampilanAkses ?? 'foto') === o.nilai;
                  return (
                    <button
                      key={o.nilai}
                      type="button"
                      onClick={() => void simpan({ tampilanAkses: o.nilai })}
                      disabled={sibuk || aktif}
                      aria-pressed={aktif}
                      className={cn(
                        'flex items-start gap-2.5 rounded-md border p-2.5 text-left transition-colors disabled:cursor-default',
                        aktif
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'cursor-pointer border-zinc-800 bg-zinc-950 hover:border-zinc-700',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 size-3.5 shrink-0 rounded-full border',
                          aktif ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-700',
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block text-[12.5px] text-zinc-200">{o.judul}</span>
                        <span className="block text-[11px] text-zinc-500">{o.sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── HARGA PAKET ───────────────────────────────────────────
                Satu formulir dengan kuota, bukan panel tersendiri, karena
                dua-duanya menjawab pertanyaan yang sama dari sisi berbeda:
                berapa harganya, dan berapa banyak yang bisa masuk. Dipisah
                jadi dua panel, keduanya harus disimpan terpisah dan
                gampang tertinggal satu. */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12.5px] text-zinc-200">
                    Kartu event gratis {st.eventGratis ? 'tampil' : 'disembunyikan'}
                  </div>
                  <div className="text-[11px] leading-relaxed text-zinc-500">
                    Kartunya juga hilang SENDIRI saat kuota gratis habis atau pendaftaran ditutup —
                    sakelar ini untuk mematikannya lebih awal.
                  </div>
                </div>
                <button
                  onClick={() => void simpan({ eventGratis: !st.eventGratis })}
                  disabled={sibuk}
                  aria-label={st.eventGratis ? 'Sembunyikan kartu event' : 'Tampilkan kartu event'}
                  className={cn(
                    'relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50',
                    st.eventGratis ? 'bg-emerald-500' : 'bg-zinc-700',
                  )}
                >
                  <span className={cn('absolute top-0.5 size-5 rounded-full bg-white transition-all',
                    st.eventGratis ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Uang label="Testing — New Launch" nilai={st.hargaTesting}
                      catatan="harga jual paket peluncuran"
                      atur={(n) => setSt({ ...st, hargaTesting: n })} />
                <Uang label="Harga coret" nilai={st.hargaTestingCoret}
                      catatan={st.hargaTestingCoret > st.hargaTesting
                        ? 'dicoret di atas harga jual'
                        : 'isi 0 kalau tidak mau ada coretan'}
                      atur={(n) => setSt({ ...st, hargaTestingCoret: n })} />
                <Uang label="Premium 3 bulan" nilai={st.hargaPremium3}
                      catatan="sekali bayar untuk 90 hari"
                      atur={(n) => setSt({ ...st, hargaPremium3: n })} />
                <Uang label="Tahunan" nilai={st.hargaTahunan}
                      catatan="sekali bayar untuk 12 bulan"
                      atur={(n) => setSt({ ...st, hargaTahunan: n })} />
                <Angka label="Kurs 1 USD (rupiah)" nilai={st.kursUsd}
                       catatan="dipakai keterangan kecil di bawah harga — samakan dengan harga produk Xendit-mu, bukan dengan kurs pasar"
                       atur={(n) => setSt({ ...st, kursUsd: Math.max(1, n) })} />
                <Uang label="Nilai produk Marketplace" nilai={st.nilaiMarketplace}
                      catatan={`jumlah harga daftar indikator + EA yang ikut di paket tahunan — dipakai menghitung klaim hematnya`}
                      atur={(n) => setSt({ ...st, nilaiMarketplace: n })} />
              </div>
            </div>

            {/* ── TAUTAN CHECKOUT ───────────────────────────────────────
                Kosong = paketnya tampil "Available soon" dengan tombol mati
                di halaman depan. Diisi = kartunya hidup sendiri, tanpa ganti
                kode dan tanpa deploy.

                Itu sebabnya kolom ini ada: paket yang harganya sudah
                dipajang tapi belum bisa dibeli adalah tombol yang mengantar
                orang ke tempat yang tidak menjualnya. Lebih baik ia
                menyatakan belum siap. */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="mb-3 text-[12.5px] text-zinc-200">Tautan checkout tiap paket</div>
              <div className="grid gap-3">
                <Tautan label="Testing — New Launch" nilai={st.linkTesting}
                        catatan="kosongkan untuk memakai halaman Akses yang sekarang"
                        atur={(v) => setSt({ ...st, linkTesting: v })} />
                <Tautan label="Premium 3 Bulan" nilai={st.linkPremium3}
                        atur={(v) => setSt({ ...st, linkPremium3: v })} />
                <Tautan label="Tahunan" nilai={st.linkTahunan}
                        atur={(v) => setSt({ ...st, linkTahunan: v })} />
              </div>
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
