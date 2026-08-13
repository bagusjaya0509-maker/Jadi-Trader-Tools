import { useEffect, useRef, useState } from 'react';
import { Plus, X, GripVertical, Pencil, FolderPlus } from 'lucide-react';
import { cn, harga as fHarga } from '@/lib/utils';
import { ambilTickers, hargaTickMt5, daftarSimbolMt5, type Ticker } from '@/lib/pasar';
import { SIMBOL_DASAR } from '@/lib/simbol';

/* ════════════════════════════════════════════════════════════════════════
   WATCHLIST CHART — kolom kanan dengan PEMBATAS yang diseret
   ════════════════════════════════════════════════════════════════════════
   Daftar pantauan yang menyatu dengan chartnya, ala TradingView. Tidak ada
   tombol buka-tutup: yang ada satu GARIS PEMBATAS di tepi kanan grafik.
   Ditarik ke kiri, watchlist melebar dan grafik menyempit; ditarik sampai
   mentok kanan, watchlist tertutup dan grafik memakai seluruh lebar.

   Bedanya dengan panel yang menghampar di atas grafik: di sini grafiknya
   benar-benar MENYEMPIT, jadi lilin di tepi kanan tidak pernah tertutup
   daftar. Itu sebabnya ia jadi kolom sejajar, bukan lapisan di atasnya.

   Lebarnya bebas — satu keadaan (angka lebar) mengurus buka, tutup, dan
   ukuran sekaligus. Nol berarti tertutup; tidak ada saklar terpisah yang
   bisa berselisih dengan lebarnya.

   Isinya SEKSI-SEKSI yang dinamai orangnya sendiri — "Forex", "Kripto",
   "Emas", terserah — dan pair-nya dipindah-pindah dengan DISERET: ke
   urutan lain di seksi yang sama, atau ke seksi lain. Struktur daftar
   pantauan adalah pendapat pemiliknya tentang pasar; alatnya tinggal
   tidak menghalangi.

   Dua jenis baris hidup berdampingan:
     · koin Binance — harga & perubahan 24 jam dari /api/tickers
     · pair Trade-Fi (MT5:XAUUSD dst.) — harga tick dari EA v2, disegarkan
       tiap 5 detik selama panelnya terbuka
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI_LAMA = 'jt.watchChart';
const KUNCI_SEKSI = 'jt.watchSeksi';
const KUNCI_LEBAR = 'jt.watchLebar';
const BAWAAN = ['MT5:XAUUSD', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUTUSDT'];

interface SeksiWatch { id: string; nama: string; simbol: string[] }

function bacaSeksi(): SeksiWatch[] {
  try {
    const d = JSON.parse(localStorage.getItem(KUNCI_SEKSI) ?? 'null') as SeksiWatch[];
    if (Array.isArray(d) && d.length
      && d.every((x) => x && typeof x.id === 'string' && typeof x.nama === 'string' && Array.isArray(x.simbol))) {
      return d;
    }
  } catch { /* privat */ }
  /* Migrasi dari era satu-daftar: daftar lama jadi seksi pertama. */
  try {
    const lama = JSON.parse(localStorage.getItem(KUNCI_LAMA) ?? 'null');
    if (Array.isArray(lama) && lama.length) {
      return [{ id: 'utama', nama: 'Watchlist', simbol: lama.filter((x) => typeof x === 'string') }];
    }
  } catch { /* privat */ }
  return [{ id: 'utama', nama: 'Watchlist', simbol: BAWAAN }];
}

/** Lebar minimum yang masih berguna. Di bawah ini daftarnya tidak
 *  terbaca, jadi seretan yang berhenti di situ dianggap "tutup". */
const LEBAR_MIN = 170;
const LEBAR_MAKS = 460;
/** Lebar yang dipakai saat dibuka lewat klik dua kali pada pembatas. */
const LEBAR_BAWAAN = 236;

function bacaLebar(): number {
  try {
    const n = Number(localStorage.getItem(KUNCI_LEBAR));
    if (n === 0) return 0;                       /* sengaja ditutup */
    return n >= LEBAR_MIN && n <= LEBAR_MAKS ? n : 0;
  } catch { return 0; }
}

export function WatchChart({ simbol, onPilih, onLebar }: {
  /** Dipanggil tiap lebar berubah — chart memakainya untuk mengukur
   *  ulang dirinya. */
  onLebar?: (n: number) => void;
  simbol: string;
  onPilih: (s: string) => void;
}) {
  const [seksi, setSeksi] = useState<SeksiWatch[]>(bacaSeksi);
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [tickMt5, setTickMt5] = useState<Record<string, { bid: number; waktu: number }>>({});
  const [pilihanMt5, setPilihanMt5] = useState<string[]>([]);
  const [ketik, setKetik] = useState('');
  const [lebar, setLebar] = useState(bacaLebar);
  const terbuka = lebar > 0;
  useEffect(() => { onLebar?.(lebar); }, [lebar, onLebar]);
  /* Seksi yang sedang DIGANTI NAMANYA / seksi baru yang sedang diketik. */
  const [ubahNama, setUbahNama] = useState<{ id: string; nilai: string } | null>(null);
  const [seksiBaru, setSeksiBaru] = useState<string | null>(null);
  /* Seretan pair: sumbernya di ref (tidak butuh render), SASARANNYA di
     state karena garis penanda jatuhnya harus ikut digambar. */
  const seretW = useRef<{ simbol: string; dari: string } | null>(null);
  const [sasar, setSasar] = useState<{ seksi: string; idx: number } | null>(null);

  const semuaSimbol = seksi.flatMap((k) => k.simbol);

  function simpanSeksi(d: SeksiWatch[]) {
    setSeksi(d);
    try { localStorage.setItem(KUNCI_SEKSI, JSON.stringify(d)); } catch { /* privat */ }
  }

  /* Harga ditarik HANYA selagi panelnya terbuka. Binance tiap 30 detik
     (umur cache servernya), tick MT5 tiap 5 detik — ia memang sumber yang
     berdetak per detik, dan watchlist ingin memperlihatkan detaknya.
     Daftar simbol MT5 ikut disegarkan: EA yang baru dipasang di chart
     lain menambah pilihan tanpa menunggu panel dibuka ulang. */
  useEffect(() => {
    if (!terbuka) return;
    let hidup = true;
    const tarikBinance = () => void ambilTickers().then((t) => { if (hidup) setTickers(t); }).catch(() => { /* diam */ });
    const tarikMt5 = () => void hargaTickMt5().then((t) => { if (hidup) setTickMt5(t); }).catch(() => { /* diam */ });
    const tarikDaftar = () => void daftarSimbolMt5().then((d) => { if (hidup) setPilihanMt5(d); });
    tarikBinance();
    tarikMt5();
    tarikDaftar();
    const jamB = setInterval(tarikBinance, 30_000);
    const jamM = setInterval(tarikMt5, 5_000);
    const jamD = setInterval(tarikDaftar, 30_000);
    return () => { hidup = false; clearInterval(jamB); clearInterval(jamM); clearInterval(jamD); };
  }, [terbuka]);

  function tambah() {
    const v = ketik.trim().toUpperCase();
    if (!/^(MT5:)?[A-Z0-9]{3,15}$/.test(v) || semuaSimbol.includes(v)) { setKetik(''); return; }
    simpanSeksi(seksi.map((k, i) => (i === 0 ? { ...k, simbol: [...k.simbol, v] } : k)));
    setKetik('');
  }

  function tambahSeksi() {
    const nama = (seksiBaru ?? '').trim();
    setSeksiBaru(null);
    if (!nama) return;
    simpanSeksi([...seksi, { id: 's' + Date.now().toString(36), nama, simbol: [] }]);
  }

  function simpanNama() {
    if (!ubahNama) return;
    const nama = ubahNama.nilai.trim();
    if (nama) simpanSeksi(seksi.map((k) => (k.id === ubahNama.id ? { ...k, nama } : k)));
    setUbahNama(null);
  }

  function hapusSeksi(id: string) {
    if (seksi.length < 2) return;
    /* Pair-nya TIDAK ikut terhapus — pindah ke seksi pertama yang tersisa.
       Menghapus wadah bukan izin membuang isinya. */
    const target = seksi.find((k) => k.id === id);
    const sisa = seksi.filter((k) => k.id !== id);
    if (target?.simbol.length) sisa[0] = { ...sisa[0], simbol: [...sisa[0].simbol, ...target.simbol] };
    simpanSeksi(sisa);
  }

  function jatuhkan() {
    const sw = seretW.current;
    seretW.current = null;
    const ke = sasar;
    setSasar(null);
    if (!sw || !ke) return;
    const d = seksi.map((k) => ({ ...k, simbol: [...k.simbol] }));
    const asal = d.find((k) => k.id === sw.dari);
    const tuju = d.find((k) => k.id === ke.seksi);
    if (!asal || !tuju) return;
    const dariIdx = asal.simbol.indexOf(sw.simbol);
    if (dariIdx < 0) return;
    asal.simbol.splice(dariIdx, 1);
    let idx = ke.idx;
    if (asal.id === tuju.id && dariIdx < idx) idx--;
    idx = Math.max(0, Math.min(tuju.simbol.length, idx));
    tuju.simbol.splice(idx, 0, sw.simbol);
    simpanSeksi(d);
  }

  /* Satu seretan mengurus TIGA hal: membuka, mengubah ukuran, menutup.
     Tidak ada saklar terpisah — saklar dan lebar yang disimpan terpisah
     bisa berselisih (tertutup tapi lebarnya 300, atau sebaliknya), dan
     yang menang jadi tergantung urutan pembacaan. Di sini lebar ADALAH
     keadaannya: nol berarti tertutup.

     Yang di bawah LEBAR_MIN dijepit ke nol, bukan ke 170: berhenti di
     lebar yang terlalu sempit menghasilkan kolom yang tidak terbaca dan
     tidak bisa ditutup dengan gerakan yang sama. */
  function mulaiTarikLebar(e: React.PointerEvent) {
    e.preventDefault();
    /* setPointerCapture MELEMPAR kalau pointernya tidak aktif — dan
       lemparannya terjadi SEBELUM penyimak gerak terpasang, jadi
       seretannya mati total tanpa jejak. Ia cuma penyempurna (menjaga
       seretan tetap terkunci saat kursor keluar jendela), bukan syarat;
       kegagalannya tidak boleh membatalkan yang pokok. */
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointer sudah lepas */ }
    const awalX = e.clientX, awalL = lebar;
    const jepit = (n: number) => {
      if (n < LEBAR_MIN * 0.6) return 0;
      return Math.min(LEBAR_MAKS, Math.max(LEBAR_MIN, n));
    };
    const hitung = (x: number) => jepit(awalL + (awalX - x));
    const gerak = (ev: PointerEvent) => setLebar(hitung(ev.clientX));
    const lepas = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerup', lepas);
      try { localStorage.setItem(KUNCI_LEBAR, String(Math.round(hitung(ev.clientX)))); } catch { /* privat */ }
    };
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerup', lepas);
  }

  /* Klik dua kali pada pembatas = buka/tutup di lebar terakhir. Seretan
     tetap cara utamanya; ini jalan pintas untuk yang tidak ingin
     mengukur apa-apa. */
  function alihkan() {
    const baru = lebar > 0 ? 0 : LEBAR_BAWAAN;
    setLebar(baru);
    try { localStorage.setItem(KUNCI_LEBAR, String(baru)); } catch { /* privat */ }
  }

  return (
    <div className="flex shrink-0" style={{ width: lebar + 6 }}>
      {/* GARIS PEMBATAS — menyatu dengan watchlist, bukan tombol terpisah.
          Selalu ada walau watchlist tertutup: itulah satu-satunya cara
          membukanya kembali, dan pegangan yang menghilang saat tertutup
          adalah pegangan yang tidak bisa dipakai. */}
      <div onPointerDown={mulaiTarikLebar}
           onDoubleClick={alihkan}
           title={terbuka ? 'Tarik untuk mengatur lebar — tarik ke kanan untuk menutup' : 'Tarik ke kiri untuk membuka watchlist'}
           className="group relative w-1.5 shrink-0 cursor-ew-resize bg-zinc-800/60 transition-colors hover:bg-zinc-600">
        {/* Pegangan bertitik: memberi tahu ia BISA DISERET tanpa perlu
            dicoba dulu. Sebuah garis polos terbaca sebagai hiasan. */}
        <span className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-[3px]">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block size-[2px] rounded-full bg-zinc-600 transition-colors group-hover:bg-zinc-300" />
          ))}
        </span>
      </div>

      {!terbuka ? null : (
      <div className="flex h-full min-w-0 grow flex-col border-l border-zinc-800 bg-zinc-950/[.96]">
        <div className="border-b border-zinc-800 px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12px] font-medium text-zinc-200">Watchlist</span>
            <button onClick={() => { setSeksiBaru(''); setUbahNama(null); }}
              title="Tambah seksi baru — kelompokkan pair sesukamu"
              className="flex cursor-pointer items-center gap-1 rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100">
              <FolderPlus className="size-3" /> Seksi
            </button>
          </div>
          <div className="flex items-center gap-1">
            <input list="watchSimbol" value={ketik}
                   onChange={(e) => setKetik(e.target.value.toUpperCase())}
                   onKeyDown={(e) => { if (e.key === 'Enter') tambah(); }}
                   placeholder="Tambah pair…"
                   className="angka h-7 min-w-0 grow rounded border border-zinc-800 bg-zinc-900 px-2 text-[11.5px] text-zinc-200 outline-none focus-visible:border-zinc-600" />
            <datalist id="watchSimbol">
              {pilihanMt5.filter((s) => !semuaSimbol.includes('MT5:' + s)).map((s) => (
                <option key={'MT5:' + s} value={'MT5:' + s}>Trade-Fi — MT5</option>
              ))}
              {SIMBOL_DASAR.filter((s) => !semuaSimbol.includes(s)).map((s) => <option key={s} value={s} />)}
            </datalist>
            <button onClick={tambah} title="Tambah ke seksi pertama"
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100">
              <Plus className="size-3.5" />
            </button>
          </div>
          {seksiBaru !== null && (
            <input autoFocus value={seksiBaru}
                   onChange={(e) => setSeksiBaru(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') tambahSeksi(); if (e.key === 'Escape') setSeksiBaru(null); }}
                   onBlur={tambahSeksi}
                   placeholder="Nama seksi… (Enter)"
                   className="mt-1.5 h-7 w-full rounded border border-zinc-700 bg-zinc-900 px-2 text-[11.5px] text-zinc-200 outline-none focus-visible:border-zinc-500" />
          )}
        </div>

        <div className="gulir-senyap min-h-0 grow overflow-y-auto py-1">
          {seksi.map((k) => (
            <div key={k.id}>
              {/* Kepala seksi — nama bisa diganti (pensil), seksi bisa
                  dihapus (pair-nya pindah, bukan hilang), dan bisa jadi
                  sasaran jatuh seretan (masuk ke urutan teratas). */}
              <div
                onDragOver={(e) => { e.preventDefault(); setSasar({ seksi: k.id, idx: 0 }); }}
                onDrop={(e) => { e.preventDefault(); jatuhkan(); }}
                className="group/seksi flex items-center gap-1.5 px-3 pb-0.5 pt-2">
                {ubahNama?.id === k.id ? (
                  <input autoFocus value={ubahNama.nilai}
                         onChange={(e) => setUbahNama({ id: k.id, nilai: e.target.value })}
                         onKeyDown={(e) => { if (e.key === 'Enter') simpanNama(); if (e.key === 'Escape') setUbahNama(null); }}
                         onBlur={simpanNama}
                         className="h-5 min-w-0 grow rounded border border-zinc-700 bg-zinc-900 px-1.5 text-[10.5px] text-zinc-200 outline-none" />
                ) : (
                  <>
                    <span className="truncate text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">{k.nama}</span>
                    <span className="text-[9.5px] text-zinc-700">{k.simbol.length}</span>
                    <button onClick={() => { setUbahNama({ id: k.id, nilai: k.nama }); setSeksiBaru(null); }}
                      title={`Ganti nama seksi ${k.nama}`}
                      className="hidden cursor-pointer rounded p-0.5 text-zinc-600 transition-colors hover:text-zinc-200 group-hover/seksi:block">
                      <Pencil className="size-2.5" />
                    </button>
                    {seksi.length > 1 && (
                      <button onClick={() => hapusSeksi(k.id)}
                        title={`Hapus seksi ${k.nama} — pair-nya pindah ke seksi pertama`}
                        className="ml-auto hidden cursor-pointer rounded p-0.5 text-zinc-600 transition-colors hover:text-red-400 group-hover/seksi:block">
                        <X className="size-3" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {k.simbol.map((s, i) => {
                const mt5 = s.startsWith('MT5:');
                const dasarS = mt5 ? s.slice(4) : s;
                const t = mt5 ? undefined : tickers[s];
                const tk = mt5 ? tickMt5[dasarS] : undefined;
                const naik = (t?.ubah24j ?? 0) >= 0;
                return (
                  <div key={s}
                       draggable
                       onDragStart={(e) => {
                         seretW.current = { simbol: s, dari: k.id };
                         e.dataTransfer.effectAllowed = 'move';
                       }}
                       onDragOver={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         const r = e.currentTarget.getBoundingClientRect();
                         setSasar({ seksi: k.id, idx: i + (e.clientY > r.top + r.height / 2 ? 1 : 0) });
                       }}
                       onDrop={(e) => { e.preventDefault(); e.stopPropagation(); jatuhkan(); }}
                       onDragEnd={() => { seretW.current = null; setSasar(null); }}
                       onClick={() => onPilih(s)}
                       className={cn('group flex cursor-pointer items-center gap-1.5 px-2 py-2 transition-colors hover:bg-zinc-900/70',
                         s === simbol && 'bg-zinc-900/50',
                         /* Garis penanda tempat jatuh: sisi atas baris ini. */
                         sasar?.seksi === k.id && sasar.idx === i && 'shadow-[inset_0_2px_0_0_rgba(16,185,129,.8)]')}>
                    <GripVertical className="size-3 shrink-0 cursor-grab text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="min-w-0 grow">
                      <div className={cn('flex items-center gap-1.5 truncate text-[12px]', s === simbol ? 'text-zinc-100' : 'text-zinc-300')}>
                        {mt5 ? dasarS : (<>{s.replace('USDT', '')}<span className="text-zinc-600">/USDT</span></>)}
                        {mt5 && (
                          <span className="rounded bg-amber-500/15 px-1 text-[8.5px] font-semibold tracking-wide text-amber-300">MT5</span>
                        )}
                      </div>
                      <div className="angka text-[11px] text-zinc-500">
                        {mt5 ? (tk ? fHarga(tk.bid) : '—') : (t ? fHarga(t.lastPrice) : '—')}
                      </div>
                    </div>
                    <span className={cn('angka shrink-0 text-[11px]', mt5 ? 'text-zinc-600' : naik ? 'text-emerald-500' : 'text-red-400')}>
                      {mt5
                        ? (tk && Date.now() - tk.waktu < 30_000 ? 'live' : '')
                        : (t ? `${naik ? '+' : ''}${t.ubah24j.toFixed(2)}%` : '')}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        simpanSeksi(seksi.map((x) => (x.id === k.id ? { ...x, simbol: x.simbol.filter((y) => y !== s) } : x)));
                      }}
                      title={`Hapus ${s}`}
                      className="hidden shrink-0 cursor-pointer rounded p-0.5 text-zinc-600 transition-colors hover:text-red-400 group-hover:block">
                      <X className="size-3" />
                    </button>
                  </div>
                );
              })}

              {/* Zona jatuh di ekor seksi — juga rumah seretan untuk seksi
                  kosong, supaya seksi baru langsung bisa diisi. */}
              <div
                onDragOver={(e) => { e.preventDefault(); setSasar({ seksi: k.id, idx: k.simbol.length }); }}
                onDrop={(e) => { e.preventDefault(); jatuhkan(); }}
                className={cn('mx-3 rounded transition-colors',
                  k.simbol.length === 0 ? 'border border-dashed border-zinc-800/80 py-2 text-center text-[10px] text-zinc-700' : 'h-1.5',
                  sasar?.seksi === k.id && sasar.idx === k.simbol.length && 'bg-emerald-500/25')}>
                {k.simbol.length === 0 ? 'seret pair ke sini' : null}
              </div>
            </div>
          ))}
          {semuaSimbol.length === 0 && (
            <p className="px-3 py-6 text-center text-[11.5px] text-zinc-600">Watchlist kosong — tambah pair di atas.</p>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
