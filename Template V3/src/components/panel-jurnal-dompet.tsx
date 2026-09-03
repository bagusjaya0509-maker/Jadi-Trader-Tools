import { useMemo, useState } from 'react';
import { RefreshCw, Trash2, Wallet, Loader2, Link2 } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { useProfilPengguna, lepasDompet, type DompetTertaut } from '@/lib/profil-pengguna';
import { sinkronRiwayatDompet, lupakanSinggahDompet, type HasilSinkronDompet } from '@/lib/tulis-jurnal';
import type { Trade } from '@/data/contoh';

/* ════════════════════════════════════════════════════════════════════════
   PANEL DOMPET TERTAUT — pintu masuk riwayat on-chain ke jurnal kripto
   ════════════════════════════════════════════════════════════════════════
   Yang OTOMATIS sudah berjalan tanpa panel ini: tiap 5 menit selama halaman
   Jurnal terbuka, trade yang tutup dalam jendela sinkron (7 hari saat
   jurnal kosong, sejam sebelum trade terakhir sesudahnya) masuk sendiri.
   Panel ini untuk dua hal yang tidak boleh otomatis:

   1. MENARIK RIWAYAT LAMA. Ribuan trade = ribuan tulisan Firestore, dan
      kuota harian yang habis tidak memberi peringatan sebelum habis. Maka
      alurnya dua langkah: HITUNG dulu (tanpa menulis apa pun), tampilkan
      berapa yang akan masuk, baru TULIS kalau orangnya setuju.

   2. MELEPAS DOMPET. Alamat yang tidak lagi dipakai tetap dibaca tiap
      putaran kalau tidak dilepas — dan riwayat orang lain yang kebetulan
      pernah tersambung di peramban yang sama akan terus mengalir ke jurnal.

   ── JENDELA YANG DITAMPILKAN ADALAH YANG TERAMBIL, BUKAN YANG DIMINTA ──
   Hyperliquid menyimpan belasan ribu fill terakhir per alamat. Untuk
   kebanyakan dompet itu berbulan-bulan; untuk dompet yang mencetak ribuan
   fill per jam itu beberapa jam. "30 hari" yang diminta bisa pulang sebagai
   "3 jam", dan menulis "30 hari" di layar saat isinya 3 jam adalah bohong
   yang tidak ketahuan sampai orangnya menghitung sendiri.
   ════════════════════════════════════════════════════════════════════════ */

const RENTANG = [
  { hari: 7, label: '7 hari' },
  { hari: 30, label: '30 hari' },
  { hari: 90, label: '90 hari' },
  { hari: 365, label: '1 tahun' },
];

const TOMBOL2 = 'flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50';
const TOMBOL1 = 'flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50';

function tanggal(ms: number): string {
  return new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function jam(ms: number): string {
  return new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
function pendek(a: string): string {
  return a.length > 14 ? a.slice(0, 8) + '…' + a.slice(-6) : a;
}

export function PanelJurnalDompet({ trade }: { trade: Trade[] }) {
  const { profil, setProfil, memuat } = useProfilPengguna(true);
  const [hari, setHari] = useState(30);
  const [sibuk, setSibuk] = useState('');
  const [kemajuan, setKemajuan] = useState('');
  const [hitungan, setHitungan] = useState<Record<string, HasilSinkronDompet>>({});
  const [pesan, setPesan] = useState<{ teks: string; galat: boolean } | null>(null);

  /* Potret id yang sudah termuat. Catatan jujurnya: jurnal memuat 2000
     trade terbaru per sumber, jadi yang lebih tua dari itu tidak ada di
     sini — ia akan dihitung "baru" dan ditulis ulang ke id yang sama
     (idempoten, cuma ongkos kuota). Ditulis di layar sebagai "termuat",
     bukan "ada". */
  const sudahAda = useMemo(() => new Set(trade.map((t) => t.id)), [trade]);
  const daftar = profil.dompet;

  const jalankan = async (kunci: string, kerja: () => Promise<void>) => {
    setSibuk(kunci); setPesan(null); setKemajuan('');
    try { await kerja(); }
    catch (e) { setPesan({ teks: e instanceof Error ? e.message : 'Gagal', galat: true }); }
    finally { setSibuk(''); setKemajuan(''); }
  };

  const hitung = (d: DompetTertaut) => jalankan(d.alamat + ':hitung', async () => {
    const h = await sinkronRiwayatDompet(sudahAda, Date.now() - hari * 86_400_000,
      { daftar: [d], hanyaHitung: true, lapor: setKemajuan });
    if (h.galat) throw new Error(h.galat);
    setHitungan((x) => ({ ...x, [d.alamat]: h }));
  });

  const tulis = (d: DompetTertaut) => jalankan(d.alamat + ':tulis', async () => {
    const h = await sinkronRiwayatDompet(sudahAda, Date.now() - hari * 86_400_000,
      { daftar: [d], lapor: setKemajuan });
    if (h.galat) throw new Error(h.galat);
    setHitungan((x) => { const y = { ...x }; delete y[d.alamat]; return y; });
    setPesan({
      galat: false,
      teks: h.masuk
        ? `${h.masuk} trade masuk dari ${pendek(d.alamat)}.` + (h.terpotong ? ' Riwayat dipotong di batas simpan Hyperliquid.' : '')
        : 'Tidak ada trade baru dari dompet ini.',
    });
  });

  const lepas = (d: DompetTertaut) => {
    if (!confirm(`Lepas dompet ${pendek(d.alamat)} dari akun ini?\n\nTrade yang sudah masuk jurnal tetap ada; yang berhenti cuma tarikan berikutnya.`)) return;
    void jalankan(d.alamat + ':lepas', async () => {
      const baru = await lepasDompet(d.alamat);
      lupakanSinggahDompet();
      setProfil({ ...profil, dompet: baru });
      setPesan({ teks: `Dompet ${pendek(d.alamat)} dilepas.`, galat: false });
    });
  };

  return (
    <Panel className="mt-4">
      <PanelHead
        judul="Dompet tertaut"
        sub="Riwayat Hyperliquid dari dompet yang pernah kamu sambungkan, masuk ke jurnal kripto"
        kanan={
          <label className="flex items-center gap-2 text-[11.5px] text-zinc-500">
            Rentang
            <select value={hari} onChange={(e) => setHari(Number(e.target.value))}
              className="h-[30px] cursor-pointer rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-[11.5px] text-zinc-300 outline-none">
              {RENTANG.map((r) => <option key={r.hari} value={r.hari}>{r.label}</option>)}
            </select>
          </label>
        }
      />
      <div className="px-5 pb-5">
        <p className="mb-3 text-[11.5px] leading-relaxed text-zinc-500">
          Trade yang tutup dalam seminggu terakhir masuk sendiri tiap 5 menit selama halaman ini
          terbuka. Tombol di bawah untuk menarik yang lebih lama — dihitung dulu, ditulis kalau
          kamu setuju.
        </p>

        {pesan && (
          <div className={cn('mb-3 rounded-lg border px-3 py-2 text-[12px]',
            pesan.galat ? 'border-amber-500/20 bg-amber-500/5 text-amber-200/90'
              : 'border-zinc-800 bg-zinc-900/60 text-emerald-400/90')}>
            {pesan.teks}
          </div>
        )}

        {memuat && !daftar.length ? (
          <p className="flex items-center gap-2 py-4 text-[12.5px] text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" /> Memuat daftar dompet…
          </p>
        ) : !daftar.length ? (
          <p className="py-4 text-center text-[12.5px] text-zinc-600">
            Belum ada dompet tertaut. Sambungkan lewat tombol <b className="text-zinc-500">Dompet</b> di
            Chart &amp; Entry atau <b className="text-zinc-500">Beli</b> di Coin Hunter — alamatnya
            tersimpan sendiri.
          </p>
        ) : (
          <ul>
            {daftar.map((d) => {
              const h = hitungan[d.alamat];
              const evm = d.pola === 'evm';
              const kunci = sibuk.startsWith(d.alamat + ':') ? sibuk.slice(d.alamat.length + 1) : '';
              return (
                <li key={d.alamat} className="border-b border-zinc-800/50 py-2.5 last:border-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <Wallet className={cn('size-3.5 shrink-0', evm ? 'text-emerald-500' : 'text-zinc-600')} />
                    <span className="angka min-w-0 truncate text-[12.5px] text-zinc-300" title={d.alamat}>
                      {d.label || pendek(d.alamat)}
                    </span>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                      {evm ? 'EVM' : 'Solana'}
                    </span>
                    <span className="angka text-[11px] text-zinc-600">terlihat {tanggal(d.terlihat)}</span>

                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                      {evm ? (
                        <button onClick={() => void hitung(d)} disabled={!!sibuk} className={TOMBOL2}
                          title={`Hitung trade yang tutup dalam ${hari} hari terakhir — belum menulis apa pun`}>
                          <RefreshCw className={cn('size-3.5', kunci === 'hitung' && 'animate-spin')} />
                          {kunci === 'hitung' ? 'Menghitung…' : 'Hitung'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-zinc-600">bukan Hyperliquid</span>
                      )}
                      <button onClick={() => lepas(d)} disabled={!!sibuk} title="Lepas dompet ini dari akun"
                        className="cursor-pointer rounded p-1 text-zinc-700 transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:opacity-40">
                        {kunci === 'lepas' ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  {kunci && kemajuan && (
                    <p className="mt-1.5 pl-6 text-[11px] text-zinc-500">{kemajuan}</p>
                  )}

                  {/* ── Hasil hitung: angka dulu, tombol tulis sesudahnya ── */}
                  {h && !kunci && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-6 text-[11.5px] text-zinc-400">
                      <span>
                        <b className="angka text-zinc-200">{h.trade}</b> trade
                        {h.dari != null && h.sampai != null && (
                          <span className="text-zinc-600">
                            {' '}({tanggal(h.dari)} {jam(h.dari)} – {tanggal(h.sampai)} {jam(h.sampai)})
                          </span>
                        )}
                        {' · '}<span className="angka">{h.dilewati}</span> sudah termuat
                        {' · '}<b className="angka text-emerald-400">{h.masuk}</b> baru
                        {' · '}<span className="angka text-zinc-600">{h.fill} fill</span>
                      </span>
                      {h.terpotong && (
                        <span className="text-amber-400/80">riwayat dipotong di batas simpan Hyperliquid</span>
                      )}
                      {h.masuk > 0 ? (
                        <button onClick={() => void tulis(d)} disabled={!!sibuk} className={cn(TOMBOL1, 'ml-auto')}>
                          <Link2 className="size-3.5" /> Tulis {h.masuk} trade ke jurnal
                        </button>
                      ) : (
                        <span className="ml-auto text-zinc-600">tidak ada yang baru</span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}
