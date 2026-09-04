import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Trash2, Wallet, Loader2, Link2, ChevronDown } from 'lucide-react';
import { Panel } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { useProfilPengguna, lepasDompet, type DompetTertaut } from '@/lib/profil-pengguna';
import { sinkronRiwayatDompet, lupakanSinggahDompet, saldoDompetHl, type HasilSinkronDompet } from '@/lib/tulis-jurnal';
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

export function PanelJurnalDompet({ trade, onRingkas }: {
  trade: Trade[];
  /** Melaporkan berapa dompet EVM yang tertaut dan berapa total saldonya,
   *  supaya saldo itu bisa berjejer dengan saldo bursa di kartu Saldo —
   *  di situlah orang membacanya, bukan di panel ini. `saldo: null` =
   *  belum/tidak terbaca, yang berbeda dari nol. */
  onRingkas?: (v: { jumlah: number; saldo: number | null }) => void;
}) {
  const { profil, setProfil, memuat } = useProfilPengguna(true);
  const [hari, setHari] = useState(30);
  const [sibuk, setSibuk] = useState('');
  const [kemajuan, setKemajuan] = useState('');
  const [hitungan, setHitungan] = useState<Record<string, HasilSinkronDompet>>({});
  const [pesan, setPesan] = useState<{ teks: string; galat: boolean } | null>(null);
  const [buka, setBuka] = useState(false);

  /* Potret id yang sudah termuat. Catatan jujurnya: jurnal memuat 2000
     trade terbaru per sumber, jadi yang lebih tua dari itu tidak ada di
     sini — ia akan dihitung "baru" dan ditulis ulang ke id yang sama
     (idempoten, cuma ongkos kuota). Ditulis di layar sebagai "termuat",
     bukan "ada". */
  const sudahAda = useMemo(() => new Set(trade.map((t) => t.id)), [trade]);
  /* HANYA EVM. Hyperliquid tidak mengenal alamat Solana, jadi baris Solana
     di sini cuma bisa berkata "bukan Hyperliquid" — satu baris yang tidak
     pernah bisa dipakai untuk apa pun. Ia tetap tertaut di profil; yang
     disembunyikan cuma barisnya di panel jurnal. */
  const daftar = useMemo(() => profil.dompet.filter((d) => d.pola === 'evm'), [profil.dompet]);

  /* ── SALDO TIAP DOMPET ─────────────────────────────────────────────────
     Ditarik langsung dari Hyperliquid, tanpa tanda tangan: keadaan akun
     on-chain itu publik. Disegarkan saat daftarnya berubah saja — saldo
     yang dikejar tiap detik cuma menambah permintaan untuk angka yang
     jarang berubah, dan halaman ini bukan papan pantau harga. */
  const [saldo, setSaldo] = useState<Record<string, number | null>>({});
  const kunciDaftar = daftar.map((d) => d.alamat).join(',');
  useEffect(() => {
    if (!kunciDaftar) return;
    let hidup = true;
    void Promise.all(kunciDaftar.split(',').map(async (a) => [a, await saldoDompetHl(a)] as const))
      .then((pasangan) => { if (hidup) setSaldo(Object.fromEntries(pasangan)); });
    return () => { hidup = false; };
  }, [kunciDaftar]);

  /* Dilaporkan ke atas SESUDAH tergambar, bukan saat dihitung: memanggil
     penyetel keadaan induk di tengah render anak adalah cara paling cepat
     membuat React menggambar ulang tanpa henti. */
  const terbaca = daftar.map((d) => saldo[d.alamat]).filter((x): x is number => typeof x === 'number');
  const totalSaldo = terbaca.length ? terbaca.reduce((t, x) => t + x, 0) : null;
  useEffect(() => {
    onRingkas?.({ jumlah: daftar.length, saldo: totalSaldo });
  }, [daftar.length, totalSaldo, onRingkas]);

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

  /* ── HILANG SAMA SEKALI SAAT TIDAK ADA YANG TERSAMBUNG ────────────────
     Diminta pemilik 4 Sep 2026. Sebelumnya panelnya tetap berdiri dengan
     ajakan menyambungkan dompet — dan ajakan yang selalu ada di halaman
     yang dibuka tiap hari berhenti jadi ajakan, ia jadi latar. Jalan
     masuknya tetap ada di tempat yang memang tentang dompet (tombol Dompet
     di Chart & Entry, tombol Beli di Coin Hunter).

     `memuat` ikut menahan supaya panelnya tidak berkedip muncul-hilang pada
     pemuatan pertama: sebelum /api/profil menjawab, daftarnya memang kosong
     tapi belum tentu benar-benar kosong. */
  if (memuat || !daftar.length) return null;

  /* ── SATU BARIS, BUKAN SATU PANEL ──────────────────────────────────────
     Dilaporkan pemilik 4 Sep 2026: "panel paling bawah ini dompet tertaut
     kok masih ada, kan sudah menyatu dengan kripto." Benar — sejak saldonya
     berjejer di kartu Saldo, panel setinggi ini mengulang kabar yang sudah
     terbaca di atas, dan pengulangan yang memakan seperempat layar terbaca
     sebagai dua fitur yang kebetulan mirip.

     Yang TIDAK bisa ikut hilang: menarik riwayat lama (dua langkah, hitung
     dulu baru tulis) dan melepas dompet. Keduanya jarang dipakai — sekali
     saat menyambungkan, lalu nyaris tidak pernah lagi — dan yang jarang
     dipakai pantas duduk di balik satu ketukan, bukan memakan tempat setiap
     hari.

     Jadi bawaannya TERTUTUP: satu baris yang menyebut berapa dompet dan
     berapa isinya, plus panah. Isi panelnya tidak berubah sedikit pun. */
  const totalTeks = totalSaldo === null ? null
    : '$' + totalSaldo.toLocaleString('id-ID', { maximumFractionDigits: 2 });

  return (
    <Panel className="mt-4">
      <button onClick={() => setBuka((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 px-5 py-3 text-left">
        <Wallet className="size-3.5 shrink-0 text-emerald-500" />
        <span className="text-[12.5px] font-medium text-zinc-200">Dompet tertaut</span>
        <span className="text-[11.5px] text-zinc-500">
          · {daftar.length} dompet{totalTeks ? <> · <span className="angka">{totalTeks}</span></> : null}
        </span>
        <span className="ml-auto hidden text-[11px] text-zinc-600 sm:inline">
          {buka ? 'tutup' : 'tarik riwayat lama / lepas dompet'}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-zinc-600 transition-transform', buka && 'rotate-180')} />
      </button>

      {buka && (
      <div className="border-t border-zinc-800 px-5 pb-5 pt-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <p className="max-w-lg text-[11.5px] leading-relaxed text-zinc-500">
            Trade yang tutup dalam seminggu terakhir masuk sendiri tiap 5 menit selama halaman ini
            terbuka. Tombol di bawah untuk menarik yang lebih lama — dihitung dulu, ditulis kalau
            kamu setuju.
          </p>
          <label className="flex shrink-0 items-center gap-2 text-[11.5px] text-zinc-500">
            Rentang
            <select value={hari} onChange={(e) => setHari(Number(e.target.value))}
              className="h-[30px] cursor-pointer rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-[11.5px] text-zinc-300 outline-none">
              {RENTANG.map((r) => <option key={r.hari} value={r.hari}>{r.label}</option>)}
            </select>
          </label>
        </div>

        {pesan && (
          <div className={cn('mb-3 rounded-lg border px-3 py-2 text-[12px]',
            pesan.galat ? 'border-amber-500/20 bg-amber-500/5 text-amber-200/90'
              : 'border-zinc-800 bg-zinc-900/60 text-emerald-400/90')}>
            {pesan.teks}
          </div>
        )}

        {(
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
                    {/* Saldonya di baris yang sama dengan alamatnya. Angka
                        yang menjawab "dompet ini isinya berapa" tidak pantas
                        berada dua ketukan jauhnya dari nama dompetnya. */}
                    <span className="angka text-[11px] text-zinc-400">
                      {saldo[d.alamat] == null ? '—' : '$' + saldo[d.alamat]!.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
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
      )}
    </Panel>
  );
}
