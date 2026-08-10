import { useState } from 'react';
import { CreditCard, Plus, Trash2, Check, Wallet, ShieldCheck, Download } from 'lucide-react';
import { Panel, PanelHead, KartuKpi, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   BILLING — kartu tersimpan, e-money, perpanjangan otomatis
   ════════════════════════════════════════════════════════════════════════
   PENTING soal keamanan, dan ini bukan sekadar catatan teknis:

   Nomor kartu TIDAK pernah disimpan di sistem kita, sekarang maupun nanti.
   Yang disimpan hanya token dari penyedia pembayaran plus empat digit
   terakhir untuk dikenali manusia. Menyimpan nomor kartu berarti tunduk pada
   PCI-DSS — dan itu bukan sesuatu yang ditambahkan belakangan.

   Karena itu form "tambah kartu" di halaman ini sengaja TIDAK diberi input
   nomor kartu lengkap. Saat disambungkan nanti, kolom itu harus datang dari
   iframe milik penyedia pembayaran, bukan dari input kita sendiri.
   ════════════════════════════════════════════════════════════════════════ */

type Metode = { id: string; jenis: 'kartu' | 'emoney'; nama: string; detail: string; utama: boolean };

const AWAL: Metode[] = [
  { id: 'm1', jenis: 'kartu',  nama: 'Visa',   detail: '•••• 6411 · exp 08/28', utama: true },
  { id: 'm2', jenis: 'emoney', nama: 'GoPay',  detail: '0812••••3391',          utama: false },
  { id: 'm3', jenis: 'emoney', nama: 'OVO',    detail: '0812••••3391',          utama: false },
];

export default function Billing() {
  const [metode, setMetode] = useState(AWAL);
  const [autoRenew, setAutoRenew] = useState(true);
  const [tambah, setTambah] = useState(false);

  const jadikanUtama = (id: string) =>
    setMetode((m) => m.map((x) => ({ ...x, utama: x.id === id })));
  const hapus = (id: string) => setMetode((m) => m.filter((x) => x.id !== id));

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKpi label="Paket aktif"      nilai="Premium" catatan="$5 / bulan" Ikon={ShieldCheck} />
        <KartuKpi label="Tagihan berikut"  nilai="$5.00"   catatan="9 September 2026" Ikon={CreditCard} />
        <KartuKpi label="Metode tersimpan" nilai={String(metode.length)} catatan="1 kartu · 2 e-money" Ikon={Wallet} />
        <KartuKpi label="Total dibayar"    nilai="$60.00"  catatan="12 bulan terakhir" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Metode pembayaran */}
        <Panel className="lg:col-span-2">
          <PanelHead
            judul="Metode Pembayaran"
            sub="Kartu dan e-money yang tersimpan untuk perpanjangan."
            kanan={
              <button
                onClick={() => setTambah((v) => !v)}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
              >
                <Plus className="size-3.5" /> Tambah
              </button>
            }
          />
          <div className="space-y-2.5 px-5 pb-5">
            {metode.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3.5 transition-colors',
                  m.utama ? 'border-zinc-700 bg-zinc-900/60' : 'border-zinc-800/60 hover:border-zinc-700'
                )}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
                  {m.jenis === 'kartu'
                    ? <CreditCard className="size-4 text-zinc-400" strokeWidth={1.8} />
                    : <Wallet className="size-4 text-zinc-400" strokeWidth={1.8} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-zinc-100">{m.nama}</span>
                    {m.utama && (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-500">Utama</span>
                    )}
                  </div>
                  <div className="angka text-[12px] text-zinc-500">{m.detail}</div>
                </div>
                {!m.utama && (
                  <button
                    onClick={() => jadikanUtama(m.id)}
                    className="cursor-pointer rounded-md border border-zinc-800 px-2.5 py-1 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                  >
                    Jadikan utama
                  </button>
                )}
                <button
                  onClick={() => hapus(m.id)}
                  aria-label={`Hapus ${m.nama}`}
                  className="cursor-pointer text-zinc-600 transition-colors hover:text-red-400"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}

            {tambah && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="mb-3 text-[11.5px] font-medium uppercase tracking-wider text-zinc-500">
                  Tambah metode
                </div>
                <div className="mb-3 flex gap-2">
                  {['Kartu', 'E-Money'].map((t, i) => (
                    <button key={t}
                      className={cn(
                        'flex-1 cursor-pointer rounded-md border px-3 py-2 text-[12.5px] transition-colors',
                        i === 0 ? 'border-zinc-700 bg-zinc-800/60 text-zinc-100' : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      )}>
                      {t}
                    </button>
                  ))}
                </div>

                {/* Kolom nomor kartu SENGAJA tidak ada di sini — lihat catatan
                    di kepala berkas. Yang tampil cuma penampung untuk iframe
                    penyedia pembayaran. */}
                <div className="rounded-md border border-dashed border-zinc-700 px-4 py-8 text-center">
                  <ShieldCheck className="mx-auto mb-2 size-5 text-zinc-600" strokeWidth={1.8} />
                  <div className="text-[12.5px] text-zinc-400">Kolom kartu dimuat dari penyedia pembayaran</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-zinc-600">
                    Nomor kartu tidak pernah melewati server kita — hanya tokennya yang disimpan.
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button className="flex-1 cursor-pointer rounded-md bg-zinc-100 py-2 text-[12.5px] font-medium text-zinc-950 transition-colors hover:bg-white">
                    Simpan metode
                  </button>
                  <button onClick={() => setTambah(false)}
                    className="cursor-pointer rounded-md border border-zinc-800 px-4 text-[12.5px] text-zinc-400 transition-colors hover:border-zinc-700">
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* Paket + auto renewal */}
        <div className="space-y-4">
          <Panel>
            <PanelHead judul="Paket" sub="Premium — akses penuh." />
            <div className="px-5 pb-5">
              <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="angka text-3xl font-semibold text-zinc-100">$5</span>
                  <span className="text-[12.5px] text-zinc-500">/ bulan</span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {['Screener tanpa batas', 'Jurnal + sinkron MT5', 'Chart & backtest', 'Semua indikator gratis'].map((f) => (
                    <div key={f} className="flex items-center gap-2 text-[12.5px] text-zinc-400">
                      <Check className="size-3.5 shrink-0 text-emerald-500" strokeWidth={2.4} />
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              {/* Perpanjangan otomatis — bisa dimatikan sendiri. */}
              <div className="mt-3 rounded-lg border border-zinc-800/60 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] text-zinc-200">Perpanjang otomatis</div>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-500">
                      {autoRenew
                        ? 'Diperpanjang sendiri tiap 9 bulan berjalan. Bisa dimatikan kapan saja.'
                        : 'Mati. Akses berhenti di akhir periode berjalan — tidak ada tagihan lagi.'}
                    </p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={autoRenew}
                    aria-label="Perpanjang otomatis"
                    onClick={() => setAutoRenew((v) => !v)}
                    className={cn(
                      'relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors',
                      autoRenew ? 'bg-emerald-500' : 'bg-zinc-700'
                    )}
                  >
                    <span
                      className="absolute top-0.5 size-5 rounded-full bg-white transition-[left] duration-200"
                      style={{ left: autoRenew ? '22px' : '2px' }}
                    />
                  </button>
                </div>
              </div>

              <button className="mt-3 w-full cursor-pointer rounded-md border border-zinc-800 py-2 text-[12.5px] text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-400">
                Batalkan langganan
              </button>
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="mt-4">
        <PanelHead
          judul="Riwayat Tagihan"
          sub="Semua pembayaran yang pernah tercatat."
          kanan={
            <button className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
              <Download className="size-3.5" /> Unduh semua
            </button>
          }
        />
        <div className="px-5 pb-5">
          <TabelBungkus>
            <Tabel>
              <thead>
                <tr><Th>Invoice</Th><Th>Tanggal</Th><Th>Metode</Th><Th>Status</Th><Th className="text-right">Jumlah</Th><Th /></tr>
              </thead>
              <tbody>
                {[
                  ['INV-2041', '9 Agu 2026', 'Visa •••• 6411', 'Lunas',  '$5.00'],
                  ['INV-2032', '9 Jul 2026', 'Visa •••• 6411', 'Lunas',  '$5.00'],
                  ['INV-2024', '9 Jun 2026', 'GoPay',          'Lunas',  '$5.00'],
                  ['INV-2016', '9 Mei 2026', 'Visa •••• 6411', 'Lunas',  '$5.00'],
                  ['INV-2007', '2 Mei 2026', 'Visa •••• 6411', 'Refund', '$50.00'],
                ].map(([inv, tgl, m, st, jml]) => (
                  <Tr key={inv}>
                    <Td className="angka text-zinc-300">{inv}</Td>
                    <Td className="text-zinc-500">{tgl}</Td>
                    <Td className="text-zinc-400">{m}</Td>
                    <Td>
                      <span className={cn(
                        'rounded px-1.5 py-0.5 text-[11px]',
                        st === 'Lunas' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-700/30 text-zinc-400'
                      )}>{st}</span>
                    </Td>
                    <Td className="angka text-right text-zinc-100">{jml}</Td>
                    <Td className="text-right">
                      <button className="cursor-pointer text-[11.5px] text-zinc-500 transition-colors hover:text-zinc-200">
                        Unduh
                      </button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tabel>
          </TabelBungkus>
          <p className="mt-3 text-[11.5px] text-zinc-600">
            Prototipe — belum tersambung penyedia pembayaran.
          </p>
        </div>
      </Panel>
    </div>
  );
}
