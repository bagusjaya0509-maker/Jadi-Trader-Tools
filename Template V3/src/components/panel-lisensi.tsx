import { useState } from 'react';
import { Check, X, RefreshCw, Copy, KeyRound, ShieldAlert, Trash2, Globe, Package, ArrowUpCircle } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { DaftarLipat, NomorBaris } from '@/components/daftar-lipat';
import { useKuota } from '@/lib/akses';

/* Nama produk yang terbaca manusia. Backend menyimpan slug (`jadi-trader-v3`)
   karena itu kunci yang stabil; layar tidak boleh ikut menampilkannya mentah —
   yang membaca panel ini perlu tahu ORANGNYA minta apa, bukan kunci apa yang
   dipakai basis data. */
const NAMA_PRODUK: Record<string, string> = {
  'jadi-trader-v3': 'Akses Jadi Trader Tools',
  'ea-jaditradersync': 'EA JadiTraderSync',
  'indikator-v3': 'Indikator Jadi Trader V3',
};
export function namaProduk(slug: string) { return NAMA_PRODUK[slug] || 'Tanpa produk'; }

/* ── DUA JENIS LISENSI YANG SELAMA INI TERCAMPUR ─────────────────────────
   `jadi-trader-v3` membuka SITUS — ia yang menentukan seseorang bisa masuk
   atau tidak. Slug lain adalah barang di Marketplace: EA dan indikator,
   yang diunduh dan dipasang di MetaTrader atau TradingView, dan sama sekali
   tidak menyentuh gerbang situs.

   Keduanya tampil dalam satu daftar dengan bentuk yang sama, dan itu
   membuat panel ini sulit dibaca: mencabut satu baris bisa berarti
   "orang ini tidak bisa login lagi" atau "orang ini kehilangan EA-nya",
   dan sebelum ini tidak ada apa pun di layar yang membedakannya. */
export function jenisLisensi(slug: string): 'situs' | 'produk' {
  return slug === 'jadi-trader-v3' ? 'situs' : 'produk';
}

export function LencanaJenis({ slug }: { slug: string }) {
  const situs = jenisLisensi(slug) === 'situs';
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
      situs ? 'bg-sky-500/12 text-sky-300' : 'bg-violet-500/12 text-violet-300')}>
      {situs ? <Globe className="size-2.5" /> : <Package className="size-2.5" />}
      {situs ? 'Akses situs' : 'Produk'}
    </span>
  );
}
import { cn, tanggalPendek } from '@/lib/utils';
import { usePermintaanLisensi, putuskanLisensi, hapusPermintaanLisensi,
         ubahPaketPermintaan, type PaketManual } from '@/lib/admin';

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

/** Paket yang bisa dipasang tangan, urut dari yang paling murah.
    Angka harinya HARUS sama dengan PAKET_UPGRADE di server.js — yang
    ditampilkan di sini cuma keterangan, yang mengikat yang di sana. */
const PAKET_MANUAL: { nilai: PaketManual; label: string; sub: string }[] = [
  { nilai: 'gratis',   label: 'Gratis',            sub: 'Event Terbatas — 30 hari' },
  { nilai: 'testing',  label: 'Berbayar 1 bulan',  sub: 'Testing / New Launch — 30 hari' },
  { nilai: 'premium3', label: 'Berbayar 3 bulan',  sub: 'Premium 3 Bulan — 90 hari' },
  { nilai: 'tahunan',  label: 'Tahunan',           sub: 'Tahunan — 365 hari' },
];

export function PanelLisensi() {
  const { data, memuat, galat, muatUlang } = usePermintaanLisensi();
  const { kuota } = useKuota();
  const [sibuk, setSibuk] = useState('');
  const [pesan, setPesan] = useState('');
  const [tersalin, setTersalin] = useState('');
  /* id baris yang menunya sedang terbuka. Satu saja: dua menu terbuka
     sekaligus membuat orang mengira pilihan di keduanya saling berkaitan. */
  const [menuPaket, setMenuPaket] = useState('');

  const baru = data.filter((x) => x.status === 'baru');

  /* URUTAN TERBARU → TERLAMA, sama arah dengan panel Lisensi Aktif di
     sebelahnya. Backend mengirim keduanya dengan arah berbeda — permintaan
     mundur, lisensi aktif maju — jadi dua panel bersebelahan itu berjalan
     berlawanan dan nomor barisnya tidak pernah bisa dipadankan. Diurutkan
     di sini, bukan di server: dua rute itu dipakai layar lain juga, dan
     urutan adalah keputusan tampilan.

     Terbaru di atas: ini panel kerja. Yang baru masuk hari ini yang perlu
     ditindak, dan ia harus terlihat tanpa menggulir maupun membuka lipatan. */
  const urut = [...data].sort((a, b) => b.waktu - a.waktu);

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

  /* Naik/turun paket. Hanya untuk yang SUDAH disetujui — server menolak
     yang lain, dan tombolnya pun tidak ditawarkan di sana. */
  async function ubahPaket(id: string, paket: PaketManual, email: string) {
    const nama = PAKET_MANUAL.find((p) => p.nilai === paket)?.label ?? paket;
    if (!confirm(
      `Ubah paket ${email || 'akun ini'} menjadi ${nama}?\n\n` +
      'Masa berlakunya dihitung ulang MULAI SEKARANG, bukan disambung ke sisa yang lama. ' +
      'Kuota gratis dan berbayar ikut bergeser sendiri.'
    )) return;
    setSibuk(id); setPesan(''); setMenuPaket('');
    try {
      const j: any = await ubahPaketPermintaan(id, paket);
      const k = j?.kuota;
      setPesan(
        `Paket ${email || id} sekarang ${nama}.`
        + (k ? ` Kuota kini gratis ${k.gratisTerpakai}/${k.gratisTotal} · bayar ${k.bayarTerpakai}/${k.bayarTotal}.` : '')
        + (j?.firestoreOk === false ? ' Catatan: status di Firestore belum tertulis — aksesnya belum ikut berubah.' : '')
      );
      muatUlang();
    } catch (e) {
      setPesan('Gagal: ' + (e instanceof Error ? e.message : 'tidak diketahui'));
    } finally { setSibuk(''); }
  }

  /* Menghapus CATATANNYA, bukan mencabut aksesnya. Konfirmasinya menyebut
     perbedaan itu di muka — dua tindakan yang bunyinya mirip tapi
     akibatnya jauh berbeda, dan yang satu tidak bisa dibatalkan. */
  async function hapus(id: string, email: string) {
    if (!confirm(
      `Hapus catatan permintaan dari ${email || 'akun ini'}?\n\n` +
      'Yang dihapus HANYA catatannya, supaya email itu bisa dipakai meminta akses lagi. ' +
      'Lisensi yang sudah aktif TIDAK ikut dicabut — untuk itu pakai tombol Cabut di panel Lisensi Aktif.\n\n' +
      'Tidak bisa dibatalkan.',
    )) return;
    setSibuk(id); setPesan('');
    try {
      const j = await hapusPermintaanLisensi(id);
      setPesan(j.lisensiMasihAktif
        ? `Catatan ${j.email || ''} dihapus. Lisensinya MASIH aktif — cabut dari panel Lisensi Aktif kalau memang mau ditutup.`
        : `Catatan ${j.email || ''} dihapus. Email itu bisa dipakai meminta akses lagi.`);
      muatUlang();
    } catch (e) {
      setPesan('Gagal: ' + (e instanceof Error ? e.message : 'tidak diketahui'));
    } finally { setSibuk(''); }
  }

  return (
    <Panel>
      <PanelHead
        judul="Permintaan Akses & Lisensi"
        sub="Satu-satunya tempat permintaan disetujui — akses situs maupun kode produk."
        kanan={
          <span className="flex items-center gap-2">
            {/* Sisa kuota ikut di sini supaya keputusan menyetujui diambil
                sambil melihat berapa tempat yang tersisa, bukan setelah
                membukanya di layar lain. */}
            <span className="angka hidden text-[11px] text-zinc-500 sm:inline">
              gratis {kuota.gratisTerpakai}/{kuota.gratisTotal} · bayar {kuota.bayarTerpakai}/{kuota.bayarTotal}
            </span>
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

        <DaftarLipat
          data={urut}
          kosong={null}
          render={(x, no) => (
            <div key={x.id} className={cn('rounded-lg border p-3',
              x.status === 'baru' ? 'border-amber-500/25 bg-amber-500/[0.03]' : 'border-zinc-800/60')}>
              {/* TANPA flex-wrap, dan sisi kiri `flex-1 min-w-0`.
                  Sebelumnya alasan panjang milik pemohon melebarkan kolom
                  kiri sampai tombol kodenya terdorong ke baris bawah — kode
                  JT3 itu yang paling sering dicari mata di panel ini, dan
                  posisinya jadi berpindah-pindah tergantung panjang alasan
                  orang. Sekarang kiri yang mengalah, kanan tetap di tempat. */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <NomorBaris no={no} />
                    <span className="text-[13px] text-zinc-200">{x.email || x.nama || x.uid}</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] uppercase',
                      x.status === 'baru' ? 'bg-amber-500/10 text-amber-400'
                        : x.status === 'disetujui' ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-zinc-800 text-zinc-500')}>
                      {x.status}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] text-zinc-500">
                    <LencanaJenis slug={x.produk} />
                    <span className="text-zinc-400">{namaProduk(x.produk)}</span>
                    {x.jenis && (
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px]',
                        x.jenis === 'bayar'
                          ? 'bg-[#ffcd75]/10 text-[#ffcd75]'
                          : 'bg-emerald-500/10 text-emerald-500')}>
                        {x.jenis === 'bayar' ? 'berbayar' : 'gratis'}
                      </span>
                    )}
                    <span>· {tanggalPendek(x.waktu)}</span>
                    {x.nama && x.email ? <span>· {x.nama}</span> : null}
                    {x.berakhir ? (
                      <span className="angka">· berlaku s/d {tanggalPendek(x.berakhir)}</span>
                    ) : null}
                  </div>
                  {/* Alasan dipotong dua baris. Ia keterangan, bukan isi
                      utama barisnya; alasan sepanjang paragraf membuat satu
                      kartu setinggi tiga kartu lain dan daftarnya berhenti
                      bisa dipindai. Teks penuhnya tetap ada di tooltip. */}
                  {x.catatan && (
                    <div title={x.catatan} className="mt-1 line-clamp-2 text-[12px] text-zinc-400">
                      {x.catatan}
                    </div>
                  )}
                  {/* Permintaan dari halaman /aktivasi ditandai "lynk".
                      Ditampilkan sebagai LENCANA, bukan teks bukti biasa:
                      inilah baris yang harus dicocokkan dengan daftar Orders
                      di lynk.id, dan mencarinya di antara catatan bebas
                      berarti membacanya satu per satu. */}
                  {x.bukti === 'lynk' && (
                    <span className="inline-flex items-center gap-1 rounded bg-[#ffcd75]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#ffcd75]">
                      Lynk · sudah bayar
                    </span>
                  )}
                  {x.bukti && x.bukti !== 'lynk' && (
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
                  ) : null}

                  {/* Paket dipasang tangan. Hanya muncul di baris yang sudah
                      disetujui: menaikkan paket orang yang aksesnya belum
                      diputus akan membuat dua keadaan yang bertentangan di
                      satu baris. */}
                  {x.status === 'disetujui' && (
                    <div className="relative">
                      <button
                        onClick={() => setMenuPaket((v) => (v === x.id ? '' : x.id))}
                        disabled={!!sibuk}
                        title="Ubah paket — gratis, 1 bulan, 3 bulan, atau tahunan"
                        aria-label="Ubah paket"
                        className={cn('flex cursor-pointer items-center rounded-md border px-2 py-1.5 transition-colors disabled:opacity-50',
                          menuPaket === x.id
                            ? 'border-zinc-600 text-zinc-100'
                            : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300')}>
                        <ArrowUpCircle className="size-3.5" />
                      </button>
                      {menuPaket === x.id && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setMenuPaket('')} />
                          <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-2xl">
                            <div className="px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                              Ubah paket
                            </div>
                            {PAKET_MANUAL.map((p) => {
                              const kini = (x.jenis === 'bayar' ? (x.paket || 'testing') : 'gratis') === p.nilai;
                              return (
                                <button key={p.nilai} disabled={kini}
                                  onClick={() => void ubahPaket(x.id, p.nilai, x.email || '')}
                                  className={cn('flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                                    kini ? 'cursor-default bg-zinc-900/60' : 'hover:bg-zinc-900')}>
                                  <span className="min-w-0 grow">
                                    <span className="block text-[12px] text-zinc-200">{p.label}</span>
                                    <span className="block text-[10.5px] text-zinc-600">{p.sub}</span>
                                  </span>
                                  {kini && <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Kode / "tanpa kode" HANYA untuk baris yang sudah diputus.
                      Dulu ini cabang terakhir satu rantai ternary bersama
                      Setujui/Tolak, jadi baris 'baru' tidak pernah
                      mencapainya. Begitu rantainya dipecah untuk menyisipkan
                      tombol paket, cabang ini jadi berdiri sendiri — dan
                      baris 'baru' menampilkan Setujui, Tolak, DAN "tanpa
                      kode" sekaligus. Pemisahnya dikembalikan tegas. */}
                  {x.status !== 'baru' && (x.kode ? (
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
                  ))}

                  {/* Hapus catatan — tersedia untuk SEMUA status, termasuk
                      yang masih 'baru'. Sengaja: permintaan uji sering tidak
                      pernah diputus sama sekali, dan kalau tombolnya cuma
                      muncul sesudah disetujui/ditolak, satu-satunya cara
                      membersihkannya adalah memutuskan sesuatu yang tidak
                      ingin diputuskan.

                      Ikon polos tanpa teks, dan warnanya baru menyala saat
                      disentuh: tindakan yang tidak bisa dibatalkan tidak
                      boleh sama menonjolnya dengan Setujui, yang ada di
                      baris yang sama. */}
                  <button
                    onClick={() => void hapus(x.id, x.email || '')}
                    disabled={!!sibuk}
                    title="Hapus catatan permintaan (tidak mencabut lisensi)"
                    aria-label="Hapus catatan permintaan"
                    className="cursor-pointer rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        />
      </div>
    </Panel>
  );
}
