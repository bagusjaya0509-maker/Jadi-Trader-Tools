import { CreditCard, Wallet, QrCode, MessageCircle, Wrench, ShieldCheck } from 'lucide-react';
import { Panel, PanelHead, KartuKpi } from '@/components/efferd-ui';
import { WA_LINK } from '@/lib/badan';

/* ════════════════════════════════════════════════════════════════════════
   BILLING — DIPARKIR (beta / maintenance), BUKAN DIHAPUS
   ════════════════════════════════════════════════════════════════════════
   Halaman ini pernah menampilkan kartu Visa, riwayat invoice, dan tombol
   "Batalkan langganan" yang semuanya CONTOH. Di halaman lain data contoh
   diberi label dan itu cukup; di halaman UANG, contoh yang tampak
   sungguhan berbahaya — orang bisa mengira kartunya benar-benar tersimpan
   atau uangnya benar-benar tertagih.

   Yang salah bukan keberadaan halamannya, tapi angka palsunya. Jadi
   halamannya TETAP ADA dan tetap bisa dibuka (tautan lama tidak mati,
   dan strukturnya siap dinyalakan), sementara setiap angka yang dulu
   berpura-pura diganti tanda "—" dengan pita maintenance di puncaknya.

   Saat Xendit tersambung nanti, aturan lama tetap berlaku: nomor kartu
   TIDAK pernah menyentuh sistem kita — kolom kartu harus datang dari
   iframe penyedia pembayaran; yang kita simpan hanya token + 4 digit
   terakhir. Menyimpan nomor kartu berarti tunduk pada PCI-DSS, dan itu
   bukan sesuatu yang ditambahkan belakangan.
   ════════════════════════════════════════════════════════════════════════ */

const NANTI = [
  { Ikon: QrCode,     nama: 'QRIS',          ket: 'Scan dari aplikasi bank atau e-wallet mana pun' },
  { Ikon: Wallet,     nama: 'E-wallet & VA', ket: 'GoPay, OVO, DANA, virtual account bank' },
  { Ikon: CreditCard, nama: 'Kartu',         ket: 'Perpanjangan otomatis tiap bulan' },
];

export default function Billing() {
  return (
    <div className="p-4 sm:p-6">
      {/* ── Pita maintenance ── */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-4 sm:flex-row sm:items-center">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
          <Wrench className="size-4 text-amber-400" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-medium text-zinc-100">Billing sedang disiapkan</span>
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-amber-400/90">
              beta
            </span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-400">
            Pembayaran otomatis belum aktif, jadi halaman ini belum bisa dipakai.
            Perpanjangan akses sementara diproses admin — biasanya selesai dalam hitungan menit.
          </p>
        </div>
        <a
          href={WA_LINK}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-emerald-500"
        >
          <MessageCircle className="size-3.5" strokeWidth={2} />
          Hubungi admin
        </a>
      </div>

      {/* KPI dengan tanda "—", bukan angka.
          Kerangkanya sengaja dipertahankan supaya bentuk halamannya sudah
          benar saat nanti diisi data sungguhan — dan supaya jelas ini
          halaman yang belum terisi, bukan halaman yang rusak. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Paket aktif"      nilai="—" catatan="Belum ada langganan berbayar" Ikon={ShieldCheck} />
        <KartuKpi label="Tagihan berikut"  nilai="—" catatan="Menunggu sistem pembayaran"   Ikon={CreditCard} />
        <KartuKpi label="Metode tersimpan" nilai="—" catatan="Belum bisa menambah metode"   Ikon={Wallet} />
        <KartuKpi label="Total dibayar"    nilai="—" catatan="Riwayat mulai tercatat nanti" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead
            judul="Metode Pembayaran"
            sub="Kartu dan e-money untuk perpanjangan otomatis."
          />
          <div className="px-5 pb-5">
            <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-8 text-center">
              <CreditCard className="mx-auto size-5 text-zinc-700" strokeWidth={1.6} />
              <div className="mt-2.5 text-[12.5px] text-zinc-400">Belum ada metode tersimpan</div>
              <div className="mx-auto mt-1 max-w-xs text-[11.5px] leading-relaxed text-zinc-600">
                Kolom kartu nanti datang langsung dari penyedia pembayaran, jadi nomor kartumu
                tidak pernah melewati server kami.
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHead judul="Yang sedang disiapkan" sub="Cara bayar yang akan tersedia." />
          <div className="space-y-3 px-5 pb-5">
            {NANTI.map((n) => (
              <div key={n.nama} className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
                  <n.Ikon className="size-3.5 text-zinc-400" strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <div className="text-[12.5px] text-zinc-200">{n.nama}</div>
                  <div className="text-[11.5px] leading-snug text-zinc-500">{n.ket}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="mt-4">
        <PanelHead judul="Riwayat Tagihan" sub="Semua pembayaran yang pernah tercatat." />
        <div className="px-5 pb-5">
          <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-8 text-center text-[12.5px] text-zinc-500">
            Belum ada tagihan. Riwayat mulai terisi setelah pembayaran otomatis aktif.
          </div>
        </div>
      </Panel>
    </div>
  );
}
