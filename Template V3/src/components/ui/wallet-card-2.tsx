import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Wallet, TrendingUp, Eye, EyeOff, RefreshCw, ShieldCheck, Unplug,
  ExternalLink, Layers, ListOrdered, Loader2, SquarePen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   KARTU DOMPET — ringkasan akun Hyperliquid non-kustodial
   ════════════════════════════════════════════════════════════════════════
   Bentuknya mengikuti templat "wallet-card-2" yang dipilih pemilik 8 Sep
   2026: dua ubin akun berwarna di atas, satu blok saldo besar di tengah,
   sebaris tombol aksi, lalu baris ringkasan di bawah.

   ── KENAPA GELAP, PADAHAL TEMPLATNYA PUTIH ────────────────────────────
   Templat aslinya kartu putih dengan pastel merah muda dan ungu. Kartu ini
   duduk DI DALAM panel chart yang seluruhnya zinc-950, jadi permukaan putih
   di sana bukan pilihan gaya melainkan lubang cahaya — dan angka saldo yang
   dibaca sambil melihat lilin justru jadi yang paling menyilaukan.

   Yang dipertahankan adalah bahasa bentuknya: sudut 2xl/3xl, dua ubin akun
   dengan gradien dan warna yang BERBEDA supaya spot dan perps terbedakan
   tanpa membaca labelnya, angka saldo besar berdiri sendiri, tombol pil
   tinggi, dan baris daftar berikon kotak. Rona merah muda dan ungunya ikut,
   cuma dituangkan sebagai lapisan tipis di atas gelap.

   ── PRESENTASIONAL, TANPA PENGETAHUAN BURSA ───────────────────────────
   Berkas ini tidak tahu apa itu Hyperliquid dan tidak pernah memanggil
   apa pun. Semua angka dan semua perbuatan datang lewat props dari
   panel-dex.tsx. Batas itu disengaja: yang menyentuh uang sungguhan tetap
   di satu berkas, dan yang menggambar bisa diubah tanpa membacanya.
   ════════════════════════════════════════════════════════════════════════ */

const uang = (n: number) =>
  '$' + n.toLocaleString('id-ID', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

const pendek = (a: string) => a.slice(0, 6) + '…' + a.slice(-4);

export interface KartuDompetProps {
  alamat: string;
  rantai: number;
  /** null selama saldonya belum terbaca — beda dengan nol. */
  diSpot: number | null;
  diPerps: number | null;
  bisaDipakai: number | null;
  nilaiAkun: number | null;
  jumlahPosisi: number;
  pnlPosisi: number;
  jumlahOrder: number;
  /** Agent wallet siap dipakai trading. */
  agenSiap: boolean;
  agenAlamat?: string;
  sisaHari?: number;
  /** Nama aksi yang sedang berjalan, dari panel — untuk memutar spinner. */
  sibuk?: string;
  /** Saldo disembunyikan (mata dicoret). Dikendalikan pemanggil supaya
   *  pilihannya bertahan saat panel digambar ulang. */
  sembunyi: boolean;
  onSembunyi: (v: boolean) => void;
  /** Satu kolom padat — panel di sisi chart, selebar ±180-340 px. */
  sempit?: boolean;
  onSegarkan: () => void;
  onAktifkan: () => void;
  onPutuskan: () => void;
  /** Formulir kirim order, digambar DI DALAM kartu di bawah baris ringkasan
   *  dan dipisah satu garis — tapi HANYA saat ikon entri dinyalakan.
   *
   *  Sempat dibuat menempel permanen, dan pemilik menolaknya 8 Sep 2026:
   *  kartu ini dibaca jauh lebih sering daripada dipakai mengirim order,
   *  dan formulir sepuluh baris yang selalu terbuka mendorong seluruh
   *  ringkasan akun ke luar layar di panel setinggi 460 px. */
  children?: React.ReactNode;
  /** Menyalakan/mematikan formulir entri. Tanpa ini ikonnya tidak digambar
   *  sama sekali — tombol yang tidak menghidupkan apa pun tidak dipasang. */
  onEntri?: () => void;
  entriAktif?: boolean;
}

export function KartuDompet({
  alamat, rantai, diSpot, diPerps, bisaDipakai, nilaiAkun,
  jumlahPosisi, pnlPosisi, jumlahOrder,
  agenSiap, agenAlamat, sisaHari, sibuk, sembunyi, onSembunyi, sempit,
  onSegarkan, onAktifkan, onPutuskan, children, onEntri, entriAktif,
}: KartuDompetProps) {
  /* Disamarkan, BUKAN dikosongkan. Titik-titik selebar angkanya membuat
     tata letak tidak melompat saat mata dinyalakan lagi — dan orang tahu
     ada nilainya di sana, cuma sedang tidak ditampilkan. */
  const nilai = (n: number | null) => (sembunyi ? '••••••' : n === null ? '—' : uang(n));

  return (
    <Card className={cn(
      'rounded-3xl border-zinc-800 bg-zinc-900/40 shadow-xl',
      sempit ? 'p-3' : 'p-5',
    )}>
      <div className="space-y-4">

        {/* ── Dua ubin akun ────────────────────────────────────────────
            Sejajar di panel lebar, ditumpuk di panel sempit: dua kolom di
            lebar 180 px memberi 80 px per angka, dan "$1.202,86" tidak
            muat di situ tanpa pecah dua baris. */}
        <div className={cn('grid gap-2.5', sempit ? 'grid-cols-1' : 'grid-cols-2')}>
          <Ubin
            Ikon={Wallet}
            label="USDC di spot"
            nilai={nilai(diSpot)}
            kelas="from-rose-500/20 to-pink-500/[0.08] border-rose-400/20"
          />
          <Ubin
            Ikon={TrendingUp}
            label="USDC di perps"
            nilai={nilai(diPerps)}
            kelas="from-violet-500/20 to-indigo-500/[0.08] border-violet-400/20"
          />
        </div>

        {/* ── Blok saldo ──────────────────────────────────────────────── */}
        <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-4">
          <div className="flex items-center gap-2">
            <span
              className="angka min-w-0 truncate rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-200"
              title={`${alamat}\n\nAkun dompet ini — terpisah dari Chart & Entry, yang memakai akun milik backend. Posisi di kedua halaman tidak saling terlihat.`}
            >
              {pendek(alamat)}
            </span>
            {!sempit && (
              <span className="shrink-0 text-[11px] text-zinc-600">chain {rantai || '—'}</span>
            )}
            <button
              onClick={() => onSembunyi(!sembunyi)}
              title={sembunyi ? 'Tampilkan saldo' : 'Sembunyikan saldo — berguna saat berbagi layar'}
              aria-label={sembunyi ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
              className="shrink-0 cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
            >
              {sembunyi ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            <button
              onClick={onSegarkan}
              disabled={sibuk === 'segar'}
              title="Tarik ulang saldo dan posisi dari Hyperliquid"
              aria-label="Segarkan"
              className="ml-auto shrink-0 cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200 disabled:opacity-40"
            >
              <RefreshCw className={cn('size-3.5', sibuk === 'segar' && 'animate-spin')} />
            </button>
          </div>

          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-zinc-500">Bisa dipakai</div>
            <div className={cn(
              'angka mt-1 font-bold leading-none tracking-tight text-zinc-50',
              sempit ? 'text-[24px]' : 'text-[32px]',
            )}>
              {nilai(bisaDipakai)}
            </div>
            {/* Nilai akun berdiri terpisah dari "bisa dipakai" karena
                keduanya memang berbeda: yang satu daya beli margin, yang
                satu seluruh isi akun termasuk yang sedang jadi jaminan
                posisi. Menyatukannya menjanjikan ukuran posisi yang tidak
                akan diterima bursa. */}
            <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-amber-400/80">
              <Layers className="size-3.5 shrink-0" />
              <span className="angka">{nilai(nilaiAkun)}</span>
              <span className="text-zinc-600">nilai akun</span>
            </div>
          </div>
        </div>

        {/* ── Tombol aksi ──────────────────────────────────────────────
            Templatnya punya Deposit dan Withdraw. Keduanya TIDAK dibuat di
            sini: setoran dan penarikan Hyperliquid tidak lewat halaman ini,
            dan tombol yang tampak bisa ditekan tapi tidak memindahkan uang
            adalah kebohongan paling mahal yang bisa dipasang di panel
            dompet. Yang tersisa cuma yang benar-benar bekerja, ditambah
            satu tautan jujur ke tempat setorannya. */}
        <div className="flex gap-2">
          {!agenSiap ? (
            <Button
              onClick={onAktifkan}
              disabled={!!sibuk}
              className="h-11 flex-1 gap-2 rounded-2xl bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
            >
              {sibuk === 'agen'
                ? <Loader2 className="size-4 animate-spin" />
                : <ShieldCheck className="size-4" />}
              Aktifkan trading
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={onPutuskan}
              className="h-11 flex-1 gap-2 rounded-2xl"
            >
              <Unplug className="size-4" />
              Putuskan
            </Button>
          )}
          {/* ── IKON ENTRI ─────────────────────────────────────────────
              Di samping Putuskan, sesuai permintaan pemilik. Berpendar saat
              menyala karena ia mengubah ISI kartu di bawahnya — keadaan yang
              menambah sesuatu ke layar harus terlihat tanpa dicari, sama
              seperti tombol Replay dan Dompet di bilah chart. */}
          {onEntri && (
            <Button
              variant="secondary"
              onClick={onEntri}
              aria-expanded={!!entriAktif}
              title={entriAktif ? 'Tutup formulir kirim order' : 'Buka formulir kirim order'}
              aria-label={entriAktif ? 'Tutup formulir kirim order' : 'Buka formulir kirim order'}
              className={cn('h-11 rounded-2xl px-4',
                entriAktif && 'bg-zinc-100 text-zinc-950 hover:bg-white')}
            >
              <SquarePen className="size-4" />
            </Button>
          )}
          <Button
            asChild
            variant="secondary"
            className="h-11 gap-2 rounded-2xl px-4"
          >
            <a href="https://app.hyperliquid.xyz" target="_blank" rel="noreferrer"
               title="Setoran dan penarikan dilakukan di Hyperliquid, bukan di halaman ini">
              <ExternalLink className="size-4" />
              {!sempit && 'Setor'}
            </a>
          </Button>
        </div>

        {agenSiap && (
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Trading aktif · agent <span className="angka text-zinc-400">{agenAlamat ? pendek(agenAlamat) : '—'}</span>
            {typeof sisaHari === 'number' && <> · sisa {sisaHari} hari</>}
          </p>
        )}

        {/* ── Baris ringkasan ──────────────────────────────────────────
            Bukan tombol. Bagian yang dirujuknya ada persis di bawah kartu
            ini, jadi memberinya sifat bisa-diklik cuma menambah hal yang
            harus dicoba tanpa memindahkan siapa pun ke mana pun. */}
        <div className="space-y-1.5">
          <BarisRingkas
            Ikon={TrendingUp}
            kelasIkon="bg-violet-500/15 text-violet-300 border-violet-400/20"
            judul="Posisi perp terbuka"
            ket={jumlahPosisi
              ? `${jumlahPosisi} posisi berjalan`
              /* Menyebut apa yang TIDAK dihitung, bukan cuma "kosong".
                 Token yang dipegang di spot memang tidak muncul di sini —
                 itu kepemilikan, bukan posisi berleverage — dan tanpa
                 kalimat ini "belum ada posisi" terbaca seperti panel yang
                 gagal membaca akun. */
              : 'Belum ada — token spot tidak dihitung'}
            kanan={jumlahPosisi ? (
              <span className={cn('angka text-[12px] font-semibold',
                pnlPosisi >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {sembunyi ? '••••' : (pnlPosisi >= 0 ? '+' : '') + uang(pnlPosisi)}
              </span>
            ) : null}
          />
          <BarisRingkas
            Ikon={ListOrdered}
            kelasIkon="bg-rose-500/15 text-rose-300 border-rose-400/20"
            judul="Order menggantung"
            ket={jumlahOrder
              ? `${jumlahOrder} order menunggu harga`
              : 'Tidak ada order yang menunggu'}
          />
        </div>

        {/* Dipisah garis, bukan jarak: yang di bawah ini perbuatan yang
            berbeda jenis — di atas MEMBACA keadaan akun, di bawah MENGIRIM
            order. Garis membuat batas itu terlihat tanpa memecah kartunya
            jadi dua kotak berbingkai. */}
        {children && (
          <div className="border-t border-zinc-800 pt-4">{children}</div>
        )}
      </div>
    </Card>
  );
}

/* ── Potongan ────────────────────────────────────────────────────────── */

function Ubin({ Ikon, label, nilai, kelas }: {
  Ikon: typeof Wallet;
  label: string;
  nilai: string;
  kelas: string;
}) {
  return (
    <div className={cn('rounded-2xl border bg-gradient-to-r p-3', kelas)}>
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
          <Ikon className="size-3.5 text-zinc-100" strokeWidth={1.8} />
        </div>
        <span className="min-w-0 truncate text-[11px] text-zinc-300">{label}</span>
      </div>
      <div className="angka mt-2 text-[16px] font-semibold text-zinc-50">{nilai}</div>
    </div>
  );
}

function BarisRingkas({ Ikon, kelasIkon, judul, ket, kanan }: {
  Ikon: typeof Wallet;
  kelasIkon: string;
  judul: string;
  ket: string;
  kanan?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-800/80 p-2.5">
      <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl border', kelasIkon)}>
        <Ikon className="size-4" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[12.5px] font-semibold text-zinc-200">{judul}</h3>
        <p className="truncate text-[11px] text-zinc-500">{ket}</p>
      </div>
      {kanan}
    </div>
  );
}

export default KartuDompet;
