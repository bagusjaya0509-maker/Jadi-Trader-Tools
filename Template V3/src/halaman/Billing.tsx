import { CreditCard, Wallet, QrCode, MessageCircle, Wrench } from 'lucide-react';
import { WA_LINK } from '@/lib/badan';

/* ════════════════════════════════════════════════════════════════════════
   BILLING — SEGERA HADIR (belum ada sistem pembayaran yang tersambung)
   ════════════════════════════════════════════════════════════════════════
   Versi sebelumnya menampilkan kartu Visa, riwayat invoice, dan tombol
   "Batalkan langganan" yang semuanya CONTOH. Di halaman lain, data contoh
   diberi label jelas; di halaman TAGIHAN, contoh yang tampak sungguhan
   berbahaya — orang bisa mengira kartunya benar-benar tersimpan atau
   uangnya benar-benar tertagih. Halaman uang tidak boleh berpura-pura.

   Maka sampai Xendit benar-benar tersambung, halaman ini berkata jujur:
   fitur sedang disiapkan, dan perpanjangan sementara lewat admin.

   Saat Xendit siap nanti, ingat aturan lama yang tetap berlaku: nomor kartu
   TIDAK pernah menyentuh sistem kita — kolom kartu harus datang dari iframe
   penyedia pembayaran, yang kita simpan hanya token + 4 digit terakhir.
   ════════════════════════════════════════════════════════════════════════ */

const NANTI = [
  { Ikon: QrCode,     nama: 'QRIS',            ket: 'Scan dari aplikasi bank / e-wallet mana pun' },
  { Ikon: Wallet,     nama: 'E-wallet & VA',   ket: 'GoPay, OVO, DANA, virtual account bank' },
  { Ikon: CreditCard, nama: 'Kartu',           ket: 'Perpanjangan otomatis tiap bulan' },
];

export default function Billing() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
          <Wrench className="size-6 text-amber-400" strokeWidth={1.6} />
        </div>

        <h1 className="mt-5 text-[19px] font-semibold text-zinc-100">
          Billing segera hadir
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-zinc-500">
          Sistem pembayaran otomatis sedang disiapkan. Sementara ini,
          perpanjangan akses diproses langsung oleh admin — biasanya
          selesai dalam hitungan menit.
        </p>

        <a
          href={WA_LINK}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-emerald-500"
        >
          <MessageCircle className="size-4" strokeWidth={2} />
          Hubungi admin via WhatsApp
        </a>

        <div className="mt-8 rounded-xl border border-zinc-800/70 bg-zinc-900/30 p-4 text-left">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Yang sedang disiapkan
          </div>
          <div className="mt-3 space-y-3">
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
        </div>
      </div>
    </div>
  );
}
