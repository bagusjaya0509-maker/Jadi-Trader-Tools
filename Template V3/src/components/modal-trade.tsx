import { useEffect, useState } from 'react';
import { X, Trash2, Loader2 } from 'lucide-react';
import { Panel } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { simpanTrade, hapusTrade, bacaTrade, type MasukanTrade } from '@/lib/tulis-jurnal';
import type { Trade, Sumber } from '@/data/contoh';
import { useTutupLuar } from '@/lib/tutup-luar';

/* ════════════════════════════════════════════════════════════════════════
   MODAL TAMBAH / SUNTING TRADE
   ════════════════════════════════════════════════════════════════════════
   Bentuk isiannya mengikuti V2 (`jurnal-trading.html`) supaya orang yang
   sudah terbiasa tidak perlu belajar ulang: tanggal, pair, arah, lot, entry,
   exit, P/L, alasan, dua emosi, catatan. Termasuk pilihan "Lainnya…" pada
   emosi — di V2 pilihan itu ada, dan menghapusnya berarti orang yang biasa
   menulis emosinya sendiri kehilangan tempatnya.
   ════════════════════════════════════════════════════════════════════════ */

const EMOSI_MASUK = ['Tenang', 'Percaya Diri', 'Ragu-ragu', 'FOMO', 'Serakah', 'Balas Dendam', 'Netral'];
const EMOSI_EVAL = ['Puas', 'Lega', 'Bangga', 'Menyesal', 'Kecewa', 'Frustrasi', 'Netral'];
const LAIN = '__lain';

/** ms -> "2026-08-11T14:30" untuk <input type="datetime-local">.
 *
 *  toISOString() TIDAK bisa dipakai: ia mengubah ke UTC, jadi jam 14:30 WIB
 *  muncul sebagai 07:30 di kotaknya. */
function keLokal(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Kolom({ label, anak, lebar }: { label: string; anak: React.ReactNode; lebar?: boolean }) {
  return (
    <div className={lebar ? 'sm:col-span-2' : undefined}>
      <label className="mb-1.5 block text-[11px] text-zinc-500">{label}</label>
      {anak}
    </div>
  );
}

const KELAS_ISIAN =
  'h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 text-[12.5px] text-zinc-100 ' +
  'outline-none transition-colors placeholder:text-zinc-600 hover:border-zinc-700 focus-visible:border-zinc-600';

/** Emosi dengan pilihan bebas — persis perilaku "Lainnya…" di V2. */
function PilihEmosi({ nilai, atur, pilihan }: { nilai: string; atur: (v: string) => void; pilihan: string[] }) {
  const bebas = nilai !== '' && !pilihan.includes(nilai);
  const [modeBebas, setModeBebas] = useState(bebas);

  return (
    <>
      <select
        value={modeBebas ? LAIN : nilai}
        onChange={(e) => {
          if (e.target.value === LAIN) { setModeBebas(true); atur(''); }
          else { setModeBebas(false); atur(e.target.value); }
        }}
        className={cn(KELAS_ISIAN, 'cursor-pointer')}
      >
        {pilihan.map((x) => <option key={x} value={x}>{x}</option>)}
        <option value={LAIN}>Lainnya…</option>
      </select>
      {modeBebas && (
        <input autoFocus value={nilai} onChange={(e) => atur(e.target.value)}
               placeholder="Tulis emosi lain" className={cn(KELAS_ISIAN, 'mt-1.5')} />
      )}
    </>
  );
}

export function ModalTrade({ sumber, trade, tutup }: {
  sumber: Sumber;
  /** null = tambah baru. */
  trade: Trade | null;
  tutup: () => void;
}) {
  const [f, setF] = useState<MasukanTrade>(() => ({
    id: trade?.id,
    sumber,
    pair: trade?.pair ?? '',
    arah: trade?.arah ?? 'BUY',
    lot: trade?.lot ?? 0,
    masukHarga: 0,
    keluarHarga: 0,
    pnl: trade?.pnl ?? 0,
    waktu: trade?.waktu ?? Date.now(),
    /* 'Tenang' cuma untuk trade BARU, yang memang sedang dicatat orangnya.
       Untuk trade yang sudah ada tapi belum punya emosi (semua hasil
       sinkron), bawaannya 'Netral' — membuka pensil demi memperbaiki pair
       lalu ikut menuliskan "Tenang" berarti mesin menaruh klaim perasaan di
       jurnal orang, persis yang baru saja dihentikan di jalur sinkron. */
    emosiMasuk: trade?.emosi ?? (trade ? 'Netral' : 'Tenang'),
    emosiEvaluasi: 'Netral',
    alasan: trade?.alasan ?? '',
    catatan: '',
    /* Dibawa dari barisnya. Tanpa ini, menyunting hasil replay menjadikannya
       transaksi sungguhan yang ikut dihitung ke Net P/L. */
    latihan: trade?.latihan,
  }));
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  /* ── DOKUMEN ASLINYA DIBACA, BUKAN DITEBAK DARI BARIS TABEL ─────────────
     Objek `Trade` yang dipegang tabel sengaja ringkas — ia tidak membawa
     harga masuk, harga keluar, catatan, maupun emosi evaluasi. Sebelum ini
     ketiadaan itu diisi konstanta: masukHarga 0, keluarHarga 0, catatan ''.

     Akibatnya bukan cuma tampilan. Orang membuka pensil untuk mengganti
     emosi saja, melihat "Harga entry 0" (angka yang salah, dibaca sebagai
     kenyataan), menekan Simpan — dan `setDoc` merge menulis nol itu ke
     dokumen yang harga aslinya tersimpan. Untuk trade hasil sinkron dompet,
     yang hilang justru satu-satunya kelebihan jalur itu: harga masuk
     rata-rata tertimbang, yang tidak bisa dipulihkan selain menarik ulang
     seluruh riwayat.

     Satu pembacaan, satu dokumen, hanya saat pensil ditekan. Kalau gagal,
     isian harga dibiarkan kosong dan disebutkan — LEBIH BAIK KOSONG
     DARIPADA NOL: kosong tidak menuntut apa-apa, nol adalah klaim. */
  const [memuat, setMemuat] = useState(!!trade);
  /* Dipisah dari `galat` biasa: yang ini MENGUNCI tombol Simpan, sedangkan
     galat validasi cuma memberi tahu. Menyimpan tanpa tahu nilai yang
     sekarang tersimpan berarti menimpa dengan tebakan. */
  const [gagalMuat, setGagalMuat] = useState(false);
  useEffect(() => {
    if (!trade) return;
    let hidup = true;
    void bacaTrade(trade.id)
      .then((d) => {
        if (!hidup || !d) return;
        setF((x) => ({
          ...x,
          masukHarga: d.masukHarga,
          keluarHarga: d.keluarHarga,
          /* Emosi & catatan tangan menang; kalau belum ada, catatan mesin
             ditampilkan supaya keterangan oid/fee/dompet tidak lenyap saat
             orangnya menyunting hal lain. */
          emosiMasuk: d.emosiMasuk || x.emosiMasuk,
          emosiEvaluasi: d.emosiEvaluasi || x.emosiEvaluasi,
          catatan: d.catatan,
          latihan: d.latihan,
        }));
      })
      .catch(() => { if (hidup) setGagalMuat(true); })
      .finally(() => { if (hidup) setMemuat(false); });
    return () => { hidup = false; };
  }, [trade]);

  /* Esc menutup. Modal yang hanya bisa ditutup dengan mouse selalu terasa
     seperti jebakan bagi yang mengetik cepat. */
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') tutup(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [tutup]);

  async function simpan() {
    if (!f.pair.trim()) { setGalat('Pair wajib diisi.'); return; }
    if (!isFinite(f.pnl)) { setGalat('P/L harus berupa angka.'); return; }
    /* Menyimpan sebelum isiannya selesai dimuat berarti menulis nilai
       sementara ke atas nilai yang sebenarnya — persis cacat yang jendela
       pemuatan ini ada untuk menutup. Gagal muat MENGUNCI, bukan sekadar
       memperingatkan: kalau kita tidak tahu isi dokumennya, satu-satunya
       tindakan yang pasti tidak merusak adalah tidak menulis. */
    if (memuat) { setGalat('Tunggu isiannya selesai dimuat.'); return; }
    if (gagalMuat) { setGalat('Isian gagal dimuat — muat ulang halaman sebelum menyimpan.'); return; }
    setSibuk(true); setGalat('');
    try { await simpanTrade(f); tutup(); }
    catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menyimpan'); }
    finally { setSibuk(false); }
  }

  async function buang() {
    if (!trade) return;
    if (!confirm(`Hapus trade ${trade.pair}?\n\nCatatan ini hilang dari jurnal untuk selamanya.`)) return;
    setSibuk(true); setGalat('');
    try { await hapusTrade(trade.id); tutup(); }
    catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menghapus'); }
    finally { setSibuk(false); }
  }

  const satuan = sumber === 'forex' ? 'Lot' : 'Qty';
  const belumJelas = memuat || gagalMuat;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
         {...useTutupLuar(tutup)}>
      <Panel className="my-4 w-full max-w-2xl bg-zinc-950" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
              {trade ? 'Sunting Trade' : 'Tambah Trade'}
            </h2>
            <div className="mt-0.5 text-[12px] text-zinc-500">
              Jurnal {sumber === 'forex' ? 'Trade-Fi' : 'Kripto'}
            </div>
          </div>
          <button onClick={tutup} aria-label="Tutup"
                  className="cursor-pointer text-zinc-500 transition-colors hover:text-zinc-100">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
          <Kolom label="Tanggal & jam" anak={
            <input type="datetime-local" value={keLokal(f.waktu)}
                   onChange={(e) => setF({ ...f, waktu: new Date(e.target.value).getTime() || f.waktu })}
                   className={KELAS_ISIAN} />
          } />
          <Kolom label="Pair" anak={
            <input value={f.pair} onChange={(e) => setF({ ...f, pair: e.target.value })}
                   placeholder={sumber === 'forex' ? 'XAUUSD' : 'BTCUSDT'}
                   className={cn(KELAS_ISIAN, 'angka uppercase placeholder:normal-case')} />
          } />
          <Kolom label="Arah" anak={
            <select value={f.arah} onChange={(e) => setF({ ...f, arah: e.target.value as 'BUY' | 'SELL' })}
                    className={cn(KELAS_ISIAN, 'cursor-pointer')}>
              <option value="BUY">BUY</option><option value="SELL">SELL</option>
            </select>
          } />
          <Kolom label={`${satuan} size`} anak={
            <input value={String(f.lot)} inputMode="decimal"
                   onChange={(e) => setF({ ...f, lot: Number(e.target.value.replace(',', '.')) || 0 })}
                   className={cn(KELAS_ISIAN, 'angka')} />
          } />
          {/* ── KOSONG SELAMA BELUM TAHU, BUKAN NOL ────────────────────
              Nol adalah KLAIM: ia terbaca sebagai "harga masuknya memang
              nol" dan diperlakukan begitu oleh yang membacanya. Selama
              dokumen aslinya belum terbaca — atau ternyata gagal terbaca —
              kotaknya dikosongkan dan dikunci. Kosong tidak mengklaim apa
              pun, dan kotak terkunci menjelaskan sendiri kenapa. */}
          <Kolom label="Harga entry" anak={
            <input value={belumJelas ? '' : String(f.masukHarga)} inputMode="decimal"
                   disabled={belumJelas} placeholder={memuat ? 'memuat…' : gagalMuat ? '—' : ''}
                   onChange={(e) => setF({ ...f, masukHarga: Number(e.target.value.replace(',', '.')) || 0 })}
                   className={cn(KELAS_ISIAN, 'angka disabled:opacity-50')} />
          } />
          <Kolom label="Harga exit" anak={
            <input value={belumJelas ? '' : String(f.keluarHarga)} inputMode="decimal"
                   disabled={belumJelas} placeholder={memuat ? 'memuat…' : gagalMuat ? '—' : ''}
                   onChange={(e) => setF({ ...f, keluarHarga: Number(e.target.value.replace(',', '.')) || 0 })}
                   className={cn(KELAS_ISIAN, 'angka disabled:opacity-50')} />
          } />
          <Kolom label="Profit / Loss (USD)" anak={
            <input value={String(f.pnl)} inputMode="decimal"
                   onChange={(e) => setF({ ...f, pnl: Number(e.target.value.replace(',', '.')) || 0 })}
                   className={cn(KELAS_ISIAN, 'angka',
                     f.pnl > 0 ? 'text-emerald-400' : f.pnl < 0 ? 'text-red-400' : '')} />
          } />
          <Kolom label="Emosi saat entry" anak={
            <PilihEmosi nilai={f.emosiMasuk} atur={(v) => setF({ ...f, emosiMasuk: v })} pilihan={EMOSI_MASUK} />
          } />
          <Kolom label="Emosi evaluasi (setelah close)" anak={
            <PilihEmosi nilai={f.emosiEvaluasi} atur={(v) => setF({ ...f, emosiEvaluasi: v })} pilihan={EMOSI_EVAL} />
          } />
          <Kolom lebar label="Alasan entry / setup" anak={
            <textarea rows={2} value={f.alasan} onChange={(e) => setF({ ...f, alasan: e.target.value })}
                      placeholder="Cth: Break of structure H1 + retest order block"
                      className={cn(KELAS_ISIAN, 'h-auto resize-y py-2')} />
          } />
          <Kolom lebar label="Catatan / pelajaran" anak={
            <textarea rows={2} value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })}
                      placeholder="Apa yang bisa diperbaiki dari trade ini?"
                      className={cn(KELAS_ISIAN, 'h-auto resize-y py-2')} />
          } />
        </div>

        {gagalMuat && (
          <div className="mx-6 mb-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[12px] leading-relaxed text-amber-200/90">
            Isian trade ini gagal dimuat, jadi menyimpan dimatikan — kalau diteruskan,
            harga dan catatan yang sudah tersimpan bisa tertimpa nilai kosong. Muat ulang
            halaman lalu coba lagi.
          </div>
        )}
        {galat && <div className="px-6 pb-2 text-[12.5px] text-amber-300/90">{galat}</div>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 px-6 py-4">
          {trade ? (
            <button onClick={() => void buang()} disabled={sibuk}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-red-500/25 px-3 py-2 text-[12px] text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50">
              <Trash2 className="size-3.5" /> Hapus Trade
            </button>
          ) : <span />}
          <div className="ml-auto flex gap-2">
            <button onClick={tutup} disabled={sibuk}
                    className="cursor-pointer rounded-md border border-zinc-800 px-4 py-2 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-50">
              Batal
            </button>
            <button onClick={() => void simpan()} disabled={sibuk || belumJelas}
                    className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-4 py-2 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
              {(sibuk || memuat) && <Loader2 className="size-3.5 animate-spin" />} Simpan
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
