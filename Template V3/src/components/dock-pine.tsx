import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Trash2, TriangleAlert, CheckCircle2, RotateCcw, X, Plus, Square,
         Loader2, Stethoscope, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';
import { auth } from '@/lib/firebase';
import { jalankanPine, CONTOH_PINE, SUPERTREND_PINE, type HasilPine, type InputPine } from '@/lib/pine';
import type { Lilin } from '@/lib/pasar';
import { susunPermintaanPine, terapkanTambalanPine, fiturHilang } from '@/lib/pine-tambalan';

/* ════════════════════════════════════════════════════════════════════════
   DOCK PINE — editor & setelan indikator di SISI KANAN chart
   ════════════════════════════════════════════════════════════════════════
   Dulu panel Pine duduk di bawah chart: menyunting skrip berarti kehilangan
   chart dari pandangan, padahal hasil suntingannya digambar DI chart.
   Sekarang ia laci yang meluncur dari kanan — persis Pine Editor
   TradingView — dan chartnya tetap terlihat selagi disunting.

   SKRIPNYA DAFTAR, bukan satu kotak. Setiap skrip yang dijalankan otomatis
   terdaftar dan diingat; yang terakhir aktif dijalankan lagi sendiri saat
   halaman dibuka — indikator bukan sesuatu yang dipasang ulang tiap pagi.
   Satu skrip aktif pada satu waktu: dua indikator gambar di panel yang sama
   saling menimpa tanpa ada cara membedakan garis siapa milik siapa.
   ════════════════════════════════════════════════════════════════════════ */

export interface SkripPine { id: string; nama: string; kode: string; aktif: boolean }

/* ── Lapor celah mesin ──────────────────────────────────────────────────
   Yang dikirim CUMA NAMA FITUR yang belum didukung — bukan skripnya.
   Tujuannya satu: pemilik tahu celah mana yang paling sering menghambat
   orang, jadi perbaikan mesin berikutnya mengenai yang paling banyak
   dipakai, bukan yang kebetulan paling keras dikeluhkan.

   Diingat per sesi supaya menjalankan skrip yang sama sepuluh kali tidak
   menghitung sepuluh — yang ingin diukur berapa ORANG tersandung, bukan
   berapa kali tombol ditekan. Gagal kirim diabaikan total: telemetri
   tidak boleh mengganggu orang yang sedang bekerja. */
function bacaVersiBuild(): string {
  try { return String(__JT_VERSI__ ?? ''); } catch { return ''; }
}

const celahTerkirim = new Set<string>();
function laporCelah(galat: string[], dilewati: string[]) {
  if (!galat.length && !dilewati.length) return;
  const fitur = fiturHilang(galat, dilewati).filter((f) => !celahTerkirim.has(f));
  if (!fitur.length) return;
  fitur.forEach((f) => celahTerkirim.add(f));
  const dasar = (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
  void fetch(`${dasar}/api/pine/galat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    /* Versi build ikut dikirim supaya celah lama bisa dibedakan dari
       yang masih hidup di build terbaru. */
    body: JSON.stringify({ fitur, versi: bacaVersiBuild() }),
  }).catch(() => { /* sunyi: ini catatan, bukan pekerjaan penggunanya */ });
}

const KUNCI_DAFTAR = 'jt.pineDaftar';
const KUNCI_LAMA = 'jt.pineKode';
const KUNCI_INPUT = 'jt.pineInput';

type NilaiSetelan = number | boolean | string;

function namaDariKode(kode: string): string {
  const m = /(?:indicator|study|strategy)\s*\(\s*["']([^"']+)["']/.exec(kode);
  return m ? m[1] : 'Skrip tanpa nama';
}

/* ── Skrip bawaan ────────────────────────────────────────────────────────
   Ditawarkan SEKALI, lalu tidak pernah dipaksakan lagi. Menambahkannya
   hanya ke daftar awal berarti ia tidak akan pernah sampai ke orang yang
   sudah punya daftar tersimpan — yaitu semua orang yang sudah memakai
   editor ini. Menambahkannya tiap kali daftar dibaca lebih buruk lagi:
   skrip yang dihapus orangnya akan hidup kembali setiap muat ulang, dan
   tombol Hapus yang tidak menghapus adalah tombol yang berbohong.

   Jalan tengahnya satu penanda kecil: id bawaan yang PERNAH ditawarkan
   dicatat, dan yang sudah tercatat tidak ditawarkan lagi apa pun nasibnya. */
const KUNCI_BAWAAN_DITAWARKAN = 'jt.pineBawaanDitawarkan';

/* Sidik isi skrip — FNV-1a, cukup untuk membedakan versi. Dipakai
   memutuskan apakah salinan yang sudah tersimpan di browser seseorang masih
   ASLI atau sudah ia sunting sendiri. */
function sidikSkrip(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

const SKRIP_BAWAAN: { id: string; nama: string; kode: string; sidikLama: string[] }[] = [
  {
    id: 'bawaan-supertrend', nama: 'Supertrend', kode: SUPERTREND_PINE,
    /* Sidik versi-versi TERDAHULU. Salinan tersimpan yang sidiknya ada di
       daftar ini berarti belum pernah disunting, jadi aman diperbarui.
       Yang tidak cocok DIBIARKAN: skrip yang sudah diutak-atik orangnya
       adalah miliknya, dan menimpanya diam-diam menghapus pekerjaannya.
         tuybxh — versi pertama, Buy/Sell menyala */
    sidikLama: ['tuybxh'],
  },
];

/** Memperbarui skrip bawaan yang tersimpan tapi belum disunting.
 *
 *  Tanpa ini, perbaikan apa pun pada skrip bawaan tidak akan pernah sampai
 *  ke orang yang sudah memasangnya — dan merekalah yang paling mungkin
 *  memakainya. */
function segarkanBawaan(d: SkripPine[]): SkripPine[] {
  let berubah = false;
  const hasil = d.map((s) => {
    const b = SKRIP_BAWAAN.find((x) => x.id === s.id);
    if (!b || s.kode === b.kode) return s;
    if (!b.sidikLama.includes(sidikSkrip(s.kode))) return s;   // sudah disunting
    berubah = true;
    return { ...s, kode: b.kode };
  });
  if (berubah) simpanDaftar(hasil);
  return hasil;
}

/* MURNI — tidak menulis apa pun.
   Sempat menandai "sudah ditawarkan" di sini juga, dan itu salah: fungsi ini
   dipanggil dari inisialisator useState, yang SENGAJA dijalankan dua kali
   oleh React StrictMode justru untuk menyingkap efek samping seperti itu.
   Panggilan pertama menandai, panggilan kedua membaca tandanya sendiri lalu
   menyimpulkan tidak ada yang perlu ditawarkan — dan skrip bawaannya tidak
   pernah muncul, tanpa satu pun galat. Penandaannya sekarang di efek. */
function tawarkanBawaan(d: SkripPine[]): SkripPine[] {
  let sudah: string[] = [];
  try { sudah = JSON.parse(localStorage.getItem(KUNCI_BAWAAN_DITAWARKAN) ?? '[]'); } catch { /* privat */ }
  if (!Array.isArray(sudah)) sudah = [];
  const punyaId = new Set(d.map((s) => s.id));
  const baru = SKRIP_BAWAAN.filter((b) => !sudah.includes(b.id) && !punyaId.has(b.id));
  return baru.length ? [...d, ...baru.map((b) => ({ ...b, aktif: false }))] : d;
}

/** Menandai seluruh skrip bawaan sudah pernah ditawarkan. Dipanggil sekali
 *  dari efek: menulis nilai yang sama dua kali tidak berakibat apa-apa, jadi
 *  StrictMode boleh menjalankannya berulang. */
function tandaiBawaanDitawarkan() {
  let sudah: string[] = [];
  try { sudah = JSON.parse(localStorage.getItem(KUNCI_BAWAAN_DITAWARKAN) ?? '[]'); } catch { /* privat */ }
  if (!Array.isArray(sudah)) sudah = [];
  const gabung = [...new Set([...sudah, ...SKRIP_BAWAAN.map((b) => b.id)])];
  try { localStorage.setItem(KUNCI_BAWAAN_DITAWARKAN, JSON.stringify(gabung)); } catch { /* privat */ }
}

function bacaDaftar(): SkripPine[] {
  try {
    const d = JSON.parse(localStorage.getItem(KUNCI_DAFTAR) ?? '[]') as SkripPine[];
    if (Array.isArray(d) && d.length) return tawarkanBawaan(segarkanBawaan(d));
  } catch { /* rusak → mulai ulang */ }
  /* Migrasi dari era satu-kotak: skrip lama jadi entri pertama daftar. */
  try {
    const lama = localStorage.getItem(KUNCI_LAMA);
    if (lama && lama.trim()) {
      return [{ id: 's1', nama: namaDariKode(lama), kode: lama, aktif: false }];
    }
  } catch { /* privat */ }
  return tawarkanBawaan([{ id: 's1', nama: namaDariKode(CONTOH_PINE), kode: CONTOH_PINE, aktif: false }]);
}

function simpanDaftar(d: SkripPine[]) {
  try { localStorage.setItem(KUNCI_DAFTAR, JSON.stringify(d)); } catch { /* privat */ }
}

function KontrolInput({ inp, nilai, atur }: {
  inp: InputPine;
  nilai: NilaiSetelan | undefined;
  atur: (v: NilaiSetelan) => void;
}) {
  const v = nilai !== undefined ? nilai : inp.bawaan;

  if (inp.jenis === 'bool') {
    return (
      <label className="flex cursor-pointer items-center gap-2 py-0.5 text-[12px] text-zinc-300">
        <input type="checkbox" checked={!!v} onChange={(e) => atur(e.target.checked)}
               className="size-3.5 shrink-0 cursor-pointer accent-emerald-500" />
        <span className="truncate" title={inp.judul}>{inp.judul}</span>
      </label>
    );
  }
  if (inp.jenis === 'color') {
    const s = typeof v === 'string' ? v : '#a1a1aa';
    const dasar = /^#[0-9a-fA-F]{6}/.test(s) ? s.slice(0, 7) : '#a1a1aa';
    const alfa = s.length === 9 ? s.slice(7)
      : typeof inp.bawaan === 'string' && inp.bawaan.length === 9 ? inp.bawaan.slice(7) : '';
    return (
      <label className="flex cursor-pointer items-center gap-2 py-0.5 text-[12px] text-zinc-300">
        <input type="color" value={dasar} onChange={(e) => atur(e.target.value + alfa)}
               className="h-5 w-8 shrink-0 cursor-pointer rounded border border-zinc-700 bg-transparent p-0" />
        <span className="truncate" title={inp.judul}>{inp.judul}</span>
      </label>
    );
  }
  if (inp.jenis === 'string' && inp.pilihan?.length) {
    return (
      <label className="flex items-center justify-between gap-2 py-0.5 text-[12px] text-zinc-300">
        <span className="truncate" title={inp.judul}>{inp.judul}</span>
        <select value={String(v ?? '')} onChange={(e) => atur(e.target.value)}
                className="h-6 shrink-0 cursor-pointer rounded border border-zinc-700 bg-zinc-900 px-1 text-[11px] text-zinc-200 outline-none">
          {inp.pilihan.map((p) => <option key={p}>{p}</option>)}
        </select>
      </label>
    );
  }
  if (inp.jenis === 'int' || inp.jenis === 'float') {
    return (
      <label className="flex items-center justify-between gap-2 py-0.5 text-[12px] text-zinc-300">
        <span className="truncate" title={inp.judul}>{inp.judul}</span>
        <input type="number" value={typeof v === 'number' ? v : Number(v) || 0}
               step={inp.jenis === 'int' ? 1 : 'any'}
               onChange={(e) => {
                 const x = Number(e.target.value);
                 if (isFinite(x)) atur(inp.jenis === 'int' ? Math.round(x) : x);
               }}
               className="angka h-6 w-[76px] shrink-0 rounded border border-zinc-700 bg-zinc-900 px-1.5 text-right text-[11px] text-zinc-200 outline-none focus-visible:border-zinc-500" />
      </label>
    );
  }
  if (inp.jenis === 'string') {
    return (
      <label className="flex items-center justify-between gap-2 py-0.5 text-[12px] text-zinc-300">
        <span className="truncate" title={inp.judul}>{inp.judul}</span>
        <input value={String(v ?? '')} onChange={(e) => atur(e.target.value)}
               className="h-6 w-[110px] shrink-0 rounded border border-zinc-700 bg-zinc-900 px-1.5 text-[11px] text-zinc-200 outline-none focus-visible:border-zinc-500" />
      </label>
    );
  }
  return null;
}

export interface InfoPine { nama: string; adaInput: boolean }
export interface KendaliPine {
  daftar: { id: string; nama: string; aktif: boolean }[];
  jalankan: (id: string) => void;
  nonaktif: () => void;
}

export function DockPine({ buka, tab, aturTab, onTutup, lilin, simbol, tf, hingga, aturHasil, onInfo, onKendali }: {
  buka: boolean;
  tab: 'editor' | 'input';
  aturTab: (t: 'editor' | 'input') => void;
  onTutup: () => void;
  lilin: Lilin;
  /** Ikut kunci hitung-ulang — dua simbol dengan TF sama bisa berbagi
   *  jumlah bar & stempel terakhir, dan tanpa simbol di kuncinya skrip
   *  tidak pernah dihitung ulang saat chart berganti koin. */
  simbol: string;
  tf: string;
  hingga?: number;
  aturHasil: (h: HasilPine | null) => void;
  /** Nama & ketersediaan input skrip aktif — bahan legend pojok chart. */
  onInfo: (i: InfoPine | null) => void;
  /** Daftar skrip + aksi jalankan/nonaktif — bahan menu Indikator. */
  onKendali: (k: KendaliPine) => void;
}) {
  const [daftar, setDaftar] = useState<SkripPine[]>(bacaDaftar);
  /* Sesudah daftarnya terbentuk, bukan sebelum: yang ditandai adalah
     "sudah pernah muncul di layar", dan itu baru benar setelah ia memang
     masuk ke daftar yang dipakai. */
  useEffect(() => { tandaiBawaanDitawarkan(); }, []);
  const [idPilih, setIdPilih] = useState(() => {
    const d = bacaDaftar();
    return (d.find((s) => s.aktif) ?? d[0]).id;
  });
  const [hasil, setHasil] = useState<HasilPine | null>(null);
  /* Usulan Dokter Pine — ditahan di sini sampai orangnya menekan Terapkan. */
  const [usul, setUsul] = useState<{ kode: string; penjelasan: string; perubahan: string[] } | null>(null);
  const [dokterSibuk, setDokterSibuk] = useState(false);
  const [dokterKabar, setDokterKabar] = useState('');
  /* Mode MANUAL: permintaannya disalin, dibawa ke Claude desktop, lalu
     jawabannya ditempel balik ke sini. Ada karena API Anthropic berbayar
     terpisah dari langganan Claude — dan menunggu tagihan bukan alasan
     yang masuk akal untuk membiarkan tombolnya mati. */
  const [tempelBuka, setTempelBuka] = useState(false);
  const [tempelIsi, setTempelIsi] = useState('');
  const [tersalin, setTersalin] = useState(false);
  const [setelan, setSetelan] = useState<Record<string, NilaiSetelan>>(() => {
    try { return JSON.parse(localStorage.getItem(KUNCI_INPUT) ?? '{}') as Record<string, NilaiSetelan>; }
    catch { return {}; }
  });

  const pilih = daftar.find((s) => s.id === idPilih) ?? daftar[0];
  const aktif = daftar.find((s) => s.aktif) ?? null;

  function ubahDaftar(f: (d: SkripPine[]) => SkripPine[]) {
    setDaftar((d) => { const b = f(d); simpanDaftar(b); return b; });
  }

  /* Memanggil agen Dokter Pine. Lewat backend kita, bukan langsung ke n8n:
     alamat & credential agen tidak boleh sampai ke browser. Jawabannya
     USULAN — tidak ada yang ditimpa sampai tombol Terapkan ditekan. */
  async function mintaPerbaikan() {
    if (!hasil) return;
    const u = auth.currentUser;
    if (!u) { setDokterKabar('Masuk dulu untuk memakai agen.'); return; }
    setDokterSibuk(true); setDokterKabar('Agen membaca skrip dan daftar galatnya…'); setUsul(null);
    try {
      const dasar = (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
      const token = await u.getIdToken();
      const r = await fetch(`${dasar}/api/agen/pine`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode: pilih.kode, galat: hasil.galat, dilewati: hasil.dilewati }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `Server menjawab ${r.status}`);
      setUsul({ kode: j.kode, penjelasan: j.penjelasan || '', perubahan: j.perubahan || [] });
      setDokterKabar('Usulan siap — periksa dulu, baru Terapkan.');
    } catch (e) {
      setDokterKabar(e instanceof Error ? e.message : 'Gagal memanggil agen');
    } finally { setDokterSibuk(false); }
  }

  /* ── Jalur MANUAL ──────────────────────────────────────────────────
     Permintaan yang disalin SAMA PERSIS dengan yang dikirim ke n8n, dan
     jawabannya diproses fungsi yang sama pula. Itu yang penting: kedua
     jalur tunduk pada pagar yang sama, jadi memakai Claude desktop tidak
     berarti menempel kode mentah tanpa pemeriksaan. */
  async function salinPermintaan() {
    if (!hasil) return;
    const teks = susunPermintaanPine(pilih.kode, hasil.galat, hasil.dilewati);
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(true);
      setTempelBuka(true);
      setDokterKabar('Tertempel di papan klip. Buka Claude, tempel, lalu salin balik jawabannya ke bawah.');
      window.setTimeout(() => setTersalin(false), 2500);
    } catch {
      setDokterKabar('Peramban menolak menyalin. Buka kotak di bawah, teksnya bisa disalin manual dari sana.');
      setTempelBuka(true);
    }
  }

  function terapkanJawaban() {
    const h = terapkanTambalanPine(pilih.kode, tempelIsi);
    if ('error' in h) { setDokterKabar(h.error); return; }
    setUsul(h);
    setTempelBuka(false);
    setTempelIsi('');
    setDokterKabar('Usulan siap — periksa dulu, baru Terapkan.');
  }

  function potong(l: Lilin, batas?: number): Lilin {
    if (batas === undefined || batas >= l.closes.length - 1) return l;
    const n = batas + 1;
    return {
      opens: l.opens.slice(0, n), highs: l.highs.slice(0, n),
      lows: l.lows.slice(0, n), closes: l.closes.slice(0, n),
      times: l.times.slice(0, n),
    };
  }

  function adaKeluaran(h: HasilPine) {
    return h.plot.length || h.segmen?.length || h.penanda?.length || h.kotak?.length || h.isian?.length;
  }

  /* Nilai terkini untuk efek/panggilan tanpa menambah dependensi. */
  const acuan = useRef({ lilin, tf, hingga, setelan, daftar });
  acuan.current = { lilin, tf, hingga, setelan, daftar };

  const eksekusi = useCallback((kode: string, nama: string) => {
    const { lilin: l, tf: t, hingga: hg, setelan: st } = acuan.current;
    if (!l.closes.length) return;
    const h = jalankanPine(kode, potong(l, hg), t, st);
    setHasil(h);
    aturHasil(adaKeluaran(h) ? h : null);
    onInfo({ nama, adaInput: !!h.input?.some((x) => x.jenis !== 'lain') });
    laporCelah(h.galat, h.dilewati);
  }, [aturHasil, onInfo]);

  const jalankan = useCallback((id: string) => {
    const d = acuan.current.daftar;
    const s = d.find((x) => x.id === id);
    if (!s) return;
    ubahDaftar((dd) => dd.map((x) => ({ ...x, aktif: x.id === id })));
    setIdPilih(id);
    eksekusi(s.kode, s.nama);
  }, [eksekusi]);

  const nonaktif = useCallback(() => {
    ubahDaftar((d) => d.map((x) => ({ ...x, aktif: false })));
    setHasil(null);
    aturHasil(null);
    onInfo(null);
  }, [aturHasil, onInfo]);

  /* Menu Indikator di luar sana butuh daftar + kendali. Dikirim ulang tiap
     daftarnya berubah. */
  useEffect(() => {
    onKendali({
      daftar: daftar.map(({ id, nama, aktif: a }) => ({ id, nama, aktif: a })),
      jalankan, nonaktif,
    });
  }, [daftar, jalankan, nonaktif, onKendali]);

  /* ── Skrip aktif dijalankan SENDIRI saat data pertama siap ──────────
     Itulah arti "tersimpan default": indikator yang kemarin terpasang
     sudah terpasang lagi hari ini, tanpa disuruh. */
  const sudahOtomatis = useRef(false);
  useEffect(() => {
    if (sudahOtomatis.current || !lilin.closes.length) return;
    sudahOtomatis.current = true;
    const a = acuan.current.daftar.find((s) => s.aktif);
    if (a) eksekusi(a.kode, a.nama);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lilin.closes.length]);

  /* ── Ikut replay, bar baru, dan setelan — dihitung ulang hanya saat
     kuncinya berubah, bukan tiap detak harga 3 detik. */
  const kunciJalan = useRef<{ kunci: string; setelan: unknown }>({ kunci: '', setelan: null });
  useEffect(() => {
    if (!aktif || !lilin.closes.length) return;
    const kunci = `${simbol}|${tf}|${lilin.times.length}|${lilin.times[lilin.times.length - 1] ?? 0}|${hingga ?? -1}|${aktif.id}`;
    if (kunci === kunciJalan.current.kunci && setelan === kunciJalan.current.setelan) return;
    const jeda = setTimeout(() => {
      kunciJalan.current = { kunci, setelan };
      eksekusi(aktif.kode, aktif.nama);
    }, 250);
    return () => clearTimeout(jeda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hingga, lilin, setelan, aktif?.id]);

  function taruhSetelan(kunci: string, v: NilaiSetelan) {
    setSetelan((s) => {
      const b = { ...s, [kunci]: v };
      try { localStorage.setItem(KUNCI_INPUT, JSON.stringify(b)); } catch { /* privat */ }
      return b;
    });
  }

  function kembaliBawaan(kunciDaftar: string[]) {
    setSetelan((s) => {
      const b = { ...s };
      kunciDaftar.forEach((k) => delete b[k]);
      try { localStorage.setItem(KUNCI_INPUT, JSON.stringify(b)); } catch { /* privat */ }
      return b;
    });
  }

  function ubahKode(v: string) {
    ubahDaftar((d) => d.map((s) => (s.id === idPilih ? { ...s, kode: v, nama: namaDariKode(v) } : s)));
  }

  function skripBaru() {
    const id = 's' + Date.now();
    ubahDaftar((d) => [...d, { id, nama: 'Skrip baru', kode: '//@version=6\nindicator("Skrip baru", overlay=true)\n\nplot(ta.ema(close, 21), title="EMA 21", color=color.yellow)\n', aktif: false }]);
    setIdPilih(id);
  }

  function hapusSkrip() {
    if (daftar.length <= 1) return;
    if (!confirm(`Hapus skrip "${pilih?.nama}"?`)) return;
    const hapusAktif = pilih?.aktif;
    ubahDaftar((d) => d.filter((s) => s.id !== idPilih));
    const sisa = acuan.current.daftar.filter((s) => s.id !== idPilih);
    setIdPilih(sisa[0]?.id ?? '');
    if (hapusAktif) { setHasil(null); aturHasil(null); onInfo(null); }
  }

  const kelompok: [string, InputPine[]][] = [];
  (hasil?.input ?? []).forEach((inp) => {
    if (inp.jenis === 'lain') return;
    const ada = kelompok.find(([g]) => g === inp.grup);
    if (ada) ada[1].push(inp);
    else kelompok.push([inp.grup, [inp]]);
  });

  return (
    <div className={cn(
      'absolute inset-y-0 right-0 z-30 flex w-[380px] max-w-[92%] flex-col border-l border-zinc-800 bg-zinc-950/[.97] backdrop-blur transition-transform duration-300',
      buka ? 'translate-x-0' : 'pointer-events-none translate-x-full')}>
      {/* ── Kepala: tab + tutup ── */}
      <div className="flex items-center gap-1 border-b border-zinc-800 px-3 py-2">
        <span className="mr-1 text-[12.5px] font-medium text-zinc-200">Pine Script</span>
        {(['editor', 'input'] as const).map((t) => (
          <button key={t} onClick={() => aturTab(t)}
            className={cn('cursor-pointer rounded px-2 py-1 text-[11.5px] capitalize transition-colors',
              tab === t ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200')}>
            {t === 'editor' ? 'Editor' : 'Input'}
          </button>
        ))}
        <button onClick={onTutup} title="Tutup panel"
          className="ml-auto cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
          <X className="size-4" />
        </button>
      </div>

      {tab === 'editor' ? (
        <div className="flex min-h-0 grow flex-col gap-2 p-3">
          <div className="flex items-center gap-1.5">
            <select value={idPilih} onChange={(e) => setIdPilih(e.target.value)}
              className="h-7 min-w-0 grow cursor-pointer rounded border border-zinc-800 bg-zinc-900 px-1.5 text-[12px] text-zinc-200 outline-none">
              {daftar.map((s) => (
                <option key={s.id} value={s.id}>{s.aktif ? '● ' : ''}{s.nama}</option>
              ))}
            </select>
            <button onClick={skripBaru} title="Skrip baru"
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100">
              <Plus className="size-3.5" />
            </button>
            <button onClick={hapusSkrip} disabled={daftar.length <= 1} title="Hapus skrip ini"
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-zinc-800 text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40">
              <Trash2 className="size-3.5" />
            </button>
          </div>

          <textarea value={pilih?.kode ?? ''} onChange={(e) => ubahKode(e.target.value)} spellCheck={false}
            className="min-h-0 grow resize-none rounded-md border border-zinc-800 bg-zinc-900/60 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-200 outline-none focus-visible:border-zinc-600" />

          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => jalankan(idPilih)} disabled={!lilin.closes.length}
              className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50">
              <Play className="size-3.5" /> Jalankan di chart
            </button>
            {aktif && (
              <button onClick={nonaktif}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200">
                <Square className="size-3" /> Lepas dari chart
              </button>
            )}
          </div>

          {hasil && (
            <div className="gulir-senyap min-h-0 shrink-0 basis-auto space-y-1.5 overflow-y-auto" style={{ maxHeight: '30%' }}>
              {adaKeluaran(hasil) ? (
                <div className="flex items-start gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-2 text-[11.5px] text-zinc-300">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                  <span>
                    {[
                      hasil.plot.length ? `${hasil.plot.length} garis` : '',
                      hasil.segmen?.length ? `${hasil.segmen.length} trendline` : '',
                      hasil.penanda?.length ? `${hasil.penanda.length} label` : '',
                      hasil.kotak?.length ? `${hasil.kotak.length} zona` : '',
                      hasil.isian?.length ? `${hasil.isian.length} isian` : '',
                    ].filter(Boolean).join(' · ')} digambar
                  </span>
                </div>
              ) : null}
              {hasil.galat.length > 0 && (
                <div className="rounded-md border border-amber-500/25 bg-amber-500/[0.04] p-2">
                  <div className="mb-1 flex items-center gap-1.5 text-[11.5px] text-amber-300">
                    <TriangleAlert className="size-3.5" /> {hasil.galat.length} baris ditolak
                  </div>
                  <ul className="space-y-0.5 font-mono text-[10.5px] text-amber-200/80">
                    {hasil.galat.slice(0, 8).map((g) => <li key={g}>{g}</li>)}
                  </ul>
                </div>
              )}
              {hasil.dilewati.length > 0 && (
                <details className="rounded-md border border-zinc-800/60 p-2">
                  <summary className="cursor-pointer text-[11px] text-zinc-500">
                    {hasil.dilewati.length} baris dilewati
                  </summary>
                  <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-zinc-600">
                    {hasil.dilewati.map((g) => <li key={g}>{g}</li>)}
                  </ul>
                </details>
              )}

              {/* ── Dokter Pine ────────────────────────────────────────
                  Agen dipanggil MANUAL dan hasilnya berhenti di usulan.
                  Kode yang ditimpa diam-diam oleh mesin adalah cara
                  tercepat kehilangan skrip yang sudah benar — jadi
                  perbaikannya ditampilkan dulu, dan tombol Terapkan
                  terpisah. */}
              {(hasil.galat.length > 0 || hasil.dilewati.length > 0) && (
                <div className="rounded-md border border-zinc-800/60 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Dua jalur ke tujuan yang sama. Yang kiri butuh agen
                        n8n + API berbayar; yang kanan cuma butuh Claude
                        yang sudah terbuka di desktop. Keduanya berakhir di
                        usulan yang sama, lewat pemeriksaan yang sama. */}
                    <button
                      onClick={() => void salinPermintaan()}
                      title="Salin permintaan lengkap — tempel ke Claude desktop, lalu bawa jawabannya ke sini"
                      className="flex cursor-pointer items-center gap-1.5 rounded bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-950 transition-colors hover:bg-white">
                      {tersalin
                        ? <><Check className="size-3" /> Tersalin</>
                        : <><Copy className="size-3" /> Salin untuk Claude</>}
                    </button>
                    <button
                      onClick={() => setTempelBuka((v) => !v)}
                      className="cursor-pointer rounded border border-zinc-800 px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:border-zinc-600">
                      Tempel jawaban
                    </button>
                    <button
                      onClick={() => void mintaPerbaikan()}
                      disabled={dokterSibuk}
                      title="Lewat agen Dokter Pine di n8n — masih beta, butuh credential API"
                      className="flex cursor-pointer items-center gap-1.5 rounded border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-60">
                      {dokterSibuk
                        ? <><Loader2 className="size-3 animate-spin" /> Agen membaca…</>
                        : <>
                            <Stethoscope className="size-3" /> Lewat agen
                            <span className="rounded bg-amber-500/15 px-1 text-[9.5px] text-amber-400/90">beta</span>
                          </>}
                    </button>
                    {usul && (
                      <button
                        onClick={() => {
                          ubahDaftar((d) => d.map((s) => (s.id === pilih.id ? { ...s, kode: usul.kode } : s)));
                          setUsul(null);
                          setDokterKabar('Perbaikan diterapkan — tekan Jalankan untuk mengujinya.');
                        }}
                        className="cursor-pointer rounded border border-emerald-500/40 px-2 py-1 text-[11px] text-emerald-400 transition-colors hover:bg-emerald-500/10">
                        Terapkan
                      </button>
                    )}
                    {usul && (
                      <button onClick={() => { setUsul(null); setDokterKabar(''); }}
                        className="cursor-pointer rounded border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600">
                        Buang
                      </button>
                    )}
                  </div>
                  {/* Catatan kecil, bukan spanduk: yang perlu diketahui
                      cuma bahwa jalur agennya masih dikerjakan — jalur
                      salin-tempel ke Claude desktop sudah bisa dipakai
                      penuh. Menyamakan keduanya di satu peringatan besar
                      akan membuat orang menghindari keduanya. */}
                  <div className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
                    Jalur <span className="text-zinc-500">Lewat agen</span> masih beta dan sedang diperbaiki.
                    Yang paling andal sekarang: Salin untuk Claude → tempel jawabannya.
                  </div>
                  {dokterKabar && (
                    <div className="mt-1.5 text-[10.5px] leading-relaxed text-zinc-500">{dokterKabar}</div>
                  )}

                  {tempelBuka && (
                    <div className="mt-2 space-y-1.5">
                      <textarea
                        value={tempelIsi}
                        onChange={(e) => setTempelIsi(e.target.value)}
                        placeholder={'Tempel jawaban Claude di sini — seluruhnya, termasuk kurung kurawal.\n{"perbaikan":[{"baris":82,"jadi":"..."}],"penjelasan":"..."}'}
                        spellCheck={false}
                        className="gulir-senyap h-24 w-full resize-y rounded border border-zinc-800 bg-zinc-950 p-2 font-mono text-[10.5px] leading-relaxed text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-zinc-600" />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={terapkanJawaban}
                          disabled={tempelIsi.trim().length < 5}
                          className="cursor-pointer rounded border border-emerald-500/40 px-2 py-1 text-[11px] text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40">
                          Proses jawaban
                        </button>
                        <button
                          onClick={() => { setTempelBuka(false); setTempelIsi(''); }}
                          className="cursor-pointer rounded border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600">
                          Tutup
                        </button>
                      </div>
                    </div>
                  )}
                  {usul && (
                    <div className="mt-2 space-y-1.5">
                      <div className="text-[11px] leading-relaxed text-zinc-400">{usul.penjelasan}</div>
                      {usul.perubahan.length > 0 && (
                        <ul className="space-y-0.5 font-mono text-[10px] text-zinc-500">
                          {usul.perubahan.map((p, i) => <li key={i}>· {p}</li>)}
                        </ul>
                      )}
                      <details className="rounded border border-zinc-800/60 p-1.5">
                        <summary className="cursor-pointer text-[10.5px] text-zinc-500">Lihat kode usulan</summary>
                        <pre className="gulir-senyap mt-1 max-h-[200px] overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-zinc-400">
{usul.kode}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="gulir-senyap min-h-0 grow overflow-y-auto p-3">
          {kelompok.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-zinc-600">
              {aktif ? 'Skrip ini tidak punya input yang bisa diatur.' : 'Jalankan sebuah skrip dulu — inputnya muncul di sini.'}
            </p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-zinc-500">Perubahan langsung digambar ulang.</span>
                <button onClick={() => kembaliBawaan((hasil?.input ?? []).map((x) => x.kunci))}
                  className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200">
                  <RotateCcw className="size-3" /> Bawaan
                </button>
              </div>
              {kelompok.map(([grup, dft]) => (
                <div key={grup || '(umum)'} className="mb-3 last:mb-0">
                  {grup && (
                    <div className="mb-1 border-b border-zinc-800/60 pb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                      {grup}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {dft.map((inp) => (
                      <KontrolInput key={inp.kunci} inp={inp} nilai={setelan[inp.kunci]}
                                    atur={(v) => taruhSetelan(inp.kunci, v)} />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
