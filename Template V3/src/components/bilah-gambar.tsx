import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Magnet, PencilLine, Lock, LockOpen, Eye, EyeOff, Trash2, ChevronsLeft, ChevronsRight, Settings2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { POLOS } from '@/lib/multi-chart';
import type { AlatPegang } from '@/lib/plugin-alat';

/* ════════════════════════════════════════════════════════════════════════
   BILAH GAMBAR — kolom alat di tepi kiri chart
   ════════════════════════════════════════════════════════════════════════
   Diminta pemilik 29 Sep 2026: alat gambar Chart & Entry disamakan dengan
   bilah kiri Hyperliquid. Bilah itu sebenarnya TradingView Advanced Charts
   — library berlisensi yang kodenya tertutup, jadi tidak bisa diambil.
   Pemilik memilih membangun padanannya di chart kita sendiri, supaya mesin
   Pine, garis order, replay, multi-chart, dan jiplak tetap utuh.

   Yang ditiru dari sana adalah CARA KERJANYA, bukan kodenya:

   · Kolom yang menempel di tepi kiri, bukan palet mengambang. Palet lama
     bisa diseret dan melipat sendiri tiap 20 detik — dua perilaku yang
     masuk akal untuk palet, tapi membuat alatnya tidak pernah ada di
     tempat yang sama dua kali.
   · Alat dikelompokkan. Tiap kelompok MENGINGAT alat terakhir yang dipakai
     dan menampilkannya sebagai ikon kelompok, jadi alat yang sering dipakai
     tetap sekali klik, sementara sisanya satu klik di menu samping.
   · Di bawah garis pemisah: magnet, tetap menggambar, kunci, sembunyikan,
     hapus — pengatur SEMUA gambar, bukan alat gambar.

   Kolomnya mendorong chart, tidak menimpanya. Lilin paling kiri tidak
   pernah tertutup ikon.
   ════════════════════════════════════════════════════════════════════════ */

export type Kursor = 'silang' | 'titik' | 'panah';
export type ModeMagnet = 'mati' | 'lemah' | 'kuat';

/* ── IKON ─────────────────────────────────────────────────────────────────
   Digambar sendiri, garis tipis 28×28 seperti ikon TradingView. Ikon lucide
   dipakai untuk pengatur di bawah (magnet, kunci, mata, tong sampah) — di
   sana bentuknya memang umum. Untuk ALAT, bentuk ikonnya harus menyerupai
   gambar yang akan jadi: sinar harus terlihat menjulur, garis horizontal
   harus terlihat selebar kotak, dan tidak ada ikon lucide yang begitu. */
/** Satu baris sakelar di menu Setelan gambar (bilah padat). */
function BarisSakelar({ aktif, onKlik, ikon, nama, ket }: {
  aktif: boolean; onKlik: () => void; ikon: ReactNode; nama: string; ket: string;
}) {
  return (
    <button onClick={onKlik} aria-pressed={aktif}
      className={cn('flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-zinc-800/80',
        aktif ? 'text-emerald-300' : 'text-zinc-200')}>
      {ikon}
      <span className="flex flex-1 flex-col">
        <span className="text-[12.5px]">{nama}</span>
        <span className="text-[10.5px] text-zinc-500">{ket}</span>
      </span>
      <Check className={cn('size-3.5 shrink-0', aktif ? 'opacity-100' : 'opacity-0')} />
    </button>
  );
}

function Ik({ children, kecil }: { children: ReactNode; kecil?: boolean }) {
  return (
    <svg viewBox="0 0 28 28" width={kecil ? 18 : 22} height={kecil ? 18 : 22} fill="none"
         stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
const titikUjung = (x: number, y: number) => <circle cx={x} cy={y} r={2} fill="currentColor" stroke="none" />;

const IKON: Record<string, ReactNode> = {
  silang: <path d="M14 5v18M5 14h18" />,
  titik: <><circle cx={14} cy={14} r={2.8} fill="currentColor" stroke="none" /><path d="M14 4v6M14 18v6M4 14h6M18 14h6" opacity={0.4} /></>,
  panahKursor: <path d="M9 5.5v15.5l4-3.9 3 6.4 2.4-1.1-3-6.3 5.6-.2z" />,
  garis: <><path d="M7 21 21 7" />{titikUjung(7, 21)}{titikUjung(21, 7)}</>,
  sinar: <><path d="M7.5 20.5 24 4" />{titikUjung(7.5, 20.5)}{titikUjung(14, 14)}</>,
  garisPanjang: <><path d="M3 25 25 3" />{titikUjung(10, 18)}{titikUjung(18, 10)}</>,
  garisH: <><path d="M3 14h22" />{titikUjung(14, 14)}</>,
  rayH: <><path d="M7 14h18" />{titikUjung(7, 14)}</>,
  garisV: <><path d="M14 3v22" />{titikUjung(14, 14)}</>,
  channel: <><path d="M4 16 18 6M10 22 24 12" /><path d="M7 19 21 9" strokeDasharray="2 2.5" opacity={0.55} /></>,
  fib: <><path d="M5 5.5h18M5 10.5h18M5 14h18M5 17.5h18M5 22.5h18" opacity={0.85} /><path d="M6 22 22 6" strokeDasharray="1.5 2" opacity={0.55} /></>,
  kuas: <path d="M4.5 19.5c2.2-2.8 4.3-5.6 6.8-4.2 2.4 1.4 2.3 4.4 4.9 3.1 2.8-1.4 3.2-6.4 7.3-10" />,
  kotak: <><rect x={5.5} y={8} width={17} height={12} rx={1} />{titikUjung(5.5, 8)}{titikUjung(22.5, 20)}</>,
  panah: <><path d="M6.5 21.5 20 8" /><path d="M13 7.5h7.5V15" /></>,
  posisiBeli: <><rect x={6} y={5} width={16} height={9} fill="rgb(16 185 129 / .28)" stroke="rgb(52 211 153)" /><rect x={6} y={14} width={16} height={9} fill="rgb(248 113 113 / .22)" stroke="rgb(248 113 113)" /></>,
  posisiJual: <><rect x={6} y={5} width={16} height={9} fill="rgb(248 113 113 / .22)" stroke="rgb(248 113 113)" /><rect x={6} y={14} width={16} height={9} fill="rgb(16 185 129 / .28)" stroke="rgb(52 211 153)" /></>,
  ukurHarga: <><path d="M8 4.5h12M8 23.5h12M14 5.5v17" /><path d="M11 8.5l3-3 3 3M11 19.5l3 3 3-3" /></>,
  ukurWaktu: <><path d="M4.5 8v12M23.5 8v12M5.5 14h17" /><path d="M8.5 11l-3 3 3 3M19.5 11l3 3-3 3" /></>,
  ukur: <><rect x={5} y={6.5} width={18} height={15} rx={1} opacity={0.45} /><path d="M14 9v10M8 14h12" /><path d="M11.5 11.5 14 9l2.5 2.5M17.5 11.5 20 14l-2.5 2.5" /></>,
  fibExt: <><path d="M5 5h18M5 9.5h18M5 14h18" opacity={0.85} /><path d="M5 24l5-7 4 4 8-8.5" />{titikUjung(5, 24)}{titikUjung(10, 17)}{titikUjung(14, 21)}</>,
  teks: <path d="M7 7h14M14 7v15M11 22h6" />,
  labelHarga: <><path d="M5.5 14 10.5 8H23v12H10.5z" /><circle cx={11} cy={14} r={1.4} fill="currentColor" stroke="none" /></>,
  zoom: <><circle cx={12} cy={12} r={6.5} /><path d="M17 17l6 6M12 9v6M9 12h6" /></>,
  zoomKeluar: <><circle cx={12} cy={12} r={6.5} /><path d="M17 17l6 6M9 12h6" /></>,
};

/* ── KELOMPOK ALAT ────────────────────────────────────────────────────── */
type Butir =
  | { macam: 'kursor'; nilai: Kursor; nama: string; ikon: string }
  | { macam: 'alat'; nilai: AlatPegang; nama: string; ikon: string; pintas?: string };

interface Grup {
  id: string; judul: string; butir: Butir[]; pisahSebelum?: boolean;
  /** Di layar lebar, isinya dijabarkan jadi tombol sendiri-sendiri (tanpa
   *  menu samping). Di ponsel tetap satu grup. */
  jabarDesktop?: boolean;
}

const GRUP: Grup[] = [
  { id: 'kursor', judul: 'Kursor', butir: [
    { macam: 'kursor', nilai: 'silang', nama: 'Silang', ikon: 'silang' },
    { macam: 'kursor', nilai: 'titik', nama: 'Titik', ikon: 'titik' },
    { macam: 'kursor', nilai: 'panah', nama: 'Panah', ikon: 'panahKursor' },
  ] },
  { id: 'garis', judul: 'Garis', butir: [
    { macam: 'alat', nilai: 'garis', nama: 'Garis tren', ikon: 'garis', pintas: 'Alt+T' },
    { macam: 'alat', nilai: 'sinar', nama: 'Sinar (ray)', ikon: 'sinar' },
    { macam: 'alat', nilai: 'garisPanjang', nama: 'Garis panjang', ikon: 'garisPanjang' },
    { macam: 'alat', nilai: 'garisH', nama: 'Garis horizontal', ikon: 'garisH', pintas: 'Alt+H' },
    { macam: 'alat', nilai: 'rayH', nama: 'Ray horizontal (garis harga)', ikon: 'rayH', pintas: 'Alt+J' },
    { macam: 'alat', nilai: 'garisV', nama: 'Garis vertikal', ikon: 'garisV', pintas: 'Alt+V' },
    { macam: 'alat', nilai: 'channel', nama: 'Channel sejajar', ikon: 'channel' },
  ] },
  { id: 'fib', judul: 'Fibonacci', butir: [
    { macam: 'alat', nilai: 'fib', nama: 'Fib retracement', ikon: 'fib', pintas: 'Alt+F' },
    { macam: 'alat', nilai: 'fibExt', nama: 'Fib extension (3 titik)', ikon: 'fibExt' },
  ] },
  { id: 'bentuk', judul: 'Bentuk', butir: [
    { macam: 'alat', nilai: 'kuas', nama: 'Kuas', ikon: 'kuas' },
    { macam: 'alat', nilai: 'kotak', nama: 'Kotak / zona SNR', ikon: 'kotak', pintas: 'Alt+Shift+R' },
    { macam: 'alat', nilai: 'panah', nama: 'Panah', ikon: 'panah' },
  ] },
  { id: 'teks', judul: 'Teks', butir: [
    { macam: 'alat', nilai: 'teks', nama: 'Teks', ikon: 'teks' },
    { macam: 'alat', nilai: 'labelHarga', nama: 'Label harga', ikon: 'labelHarga' },
  ] },
  /* Dijabarkan di desktop atas permintaan pemilik 29 Sep 2026: kolomnya
     menyisakan ruang kosong di bawah, dan lima alat ini yang paling sering
     dipakai bergantian saat menyusun setup — satu klik lebih cepat daripada
     membuka menu. Di ponsel tetap satu grup: tinggi layarnya tidak cukup. */
  { id: 'posisi', judul: 'Posisi & ukur', jabarDesktop: true, butir: [
    { macam: 'alat', nilai: 'posisiBeli', nama: 'Posisi long', ikon: 'posisiBeli' },
    { macam: 'alat', nilai: 'posisiJual', nama: 'Posisi short', ikon: 'posisiJual' },
    { macam: 'alat', nilai: 'ukurHarga', nama: 'Rentang harga', ikon: 'ukurHarga' },
    { macam: 'alat', nilai: 'ukurWaktu', nama: 'Rentang waktu', ikon: 'ukurWaktu' },
    { macam: 'alat', nilai: 'ukur', nama: 'Rentang harga & waktu', ikon: 'ukur' },
  ] },
  /* Zoom bukan alat gambar — dipisah garis, seperti di TradingView. */
  { id: 'zoom', judul: 'Zoom', pisahSebelum: true, butir: [
    { macam: 'alat', nilai: 'zoom', nama: 'Perbesar area — tarik rentang waktunya', ikon: 'zoom' },
    { macam: 'alat', nilai: 'zoomKeluar', nama: 'Kembalikan zoom', ikon: 'zoomKeluar' },
  ] },
];

/* Pintasan papan ketik — sama dengan TradingView, supaya tangan yang sudah
   hafal di sana tidak perlu belajar ulang. */
const PINTAS: { alt: string; shift?: boolean; alat: AlatPegang }[] = [
  { alt: 't', alat: 'garis' }, { alt: 'h', alat: 'garisH' }, { alt: 'j', alat: 'rayH' },
  { alt: 'v', alat: 'garisV' }, { alt: 'f', alat: 'fib' }, { alt: 'r', shift: true, alat: 'kotak' },
];

/* ── SETELAN, DISIMPAN PER PERANGKAT ─────────────────────────────────────
   `buka` disimpan TERPISAH untuk panel multi-chart: panel seperempat layar
   punya ruang yang jauh lebih sempit, dan membuka bilah di chart utama
   tidak boleh diam-diam membukanya di keempat panel sekaligus. */
const KUNCI = 'jt.bilahGambar';
const KUNCI_BUKA = POLOS ? 'jt.bilahGambar.bukaPanel' : 'jt.bilahGambar.buka';

interface Setelan {
  kursor: Kursor; magnet: ModeMagnet; magnetTerakhir: 'lemah' | 'kuat';
  tetap: boolean; kunci: boolean; sembunyi: boolean;
  /** Alat terakhir per kelompok. */
  pilihan: Record<string, string>;
}
const BAWAAN: Setelan = {
  kursor: 'silang', magnet: 'mati', magnetTerakhir: 'lemah',
  tetap: false, kunci: false, sembunyi: false, pilihan: {},
};

function bacaSetelan(): Setelan {
  try {
    const d = JSON.parse(localStorage.getItem(KUNCI) ?? 'null');
    if (d && typeof d === 'object') return { ...BAWAAN, ...d, pilihan: { ...(d.pilihan ?? {}) } };
  } catch { /* rusak / privat */ }
  return BAWAAN;
}
function bacaBuka(): boolean {
  try {
    const v = localStorage.getItem(KUNCI_BUKA);
    if (v !== null) return v === '1';
  } catch { /* privat */ }
  /* Belum pernah memilih: terbuka di layar lebar, terlipat di panel
     multi-chart dan di ponsel — di sana 40 px kolom adalah potongan besar
     dari lebar chart. */
  return !POLOS && typeof window !== 'undefined' && window.innerWidth >= 768;
}

/* ── LIPAT HANYA DI LAYAR SEMPIT ─────────────────────────────────────────
   Diminta pemilik 29 Sep 2026: tombol lipat di bilah tidak perlu. Di layar
   lebar kolomnya selalu tampil. Di bawah 768 px (ponsel, dan panel multi-
   chart yang sempit — iframe punya lebar jendelanya sendiri) tombolnya
   tetap ada, karena di sana 40 px adalah potongan besar dari lebar chart. */
const BATAS_SEMPIT = 768;
function cekSempit(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < BATAS_SEMPIT;
}

export function useSetelanBilah() {
  const [s, setS] = useState<Setelan>(bacaSetelan);
  const [buka, setBukaState] = useState<boolean>(bacaBuka);
  const [sempit, setSempit] = useState<boolean>(cekSempit);
  useEffect(() => {
    const ukur = () => setSempit(cekSempit());
    window.addEventListener('resize', ukur);
    return () => window.removeEventListener('resize', ukur);
  }, []);
  const ubah = useCallback((b: Partial<Setelan>) => {
    setS((l) => {
      const n = { ...l, ...b };
      try { localStorage.setItem(KUNCI, JSON.stringify(n)); } catch { /* privat */ }
      return n;
    });
  }, []);
  const setBuka = useCallback((v: boolean) => {
    setBukaState(v);
    try { localStorage.setItem(KUNCI_BUKA, v ? '1' : '0'); } catch { /* privat */ }
  }, []);
  /** Kolomnya benar-benar tampil. Tombol sembunyikan dikembalikan ke semua
   *  lebar layar 29 Sep 2026 — yang ingin dibuang pemilik ternyata batang
   *  gulir tipis di dasar kolom, bukan tombol ini. `sempit` tetap dipakai
   *  untuk bawaan terlipat di ponsel (lihat bacaBuka). */
  const tampil = buka;
  return { ...s, buka, sempit, tampil, ubah, setBuka };
}
export type SetelanBilah = ReturnType<typeof useSetelanBilah>;

/* ── KOMPONEN ─────────────────────────────────────────────────────────── */
export function BilahGambar({ setelan, alat, onAlat, jumlahGambar, adaPilihan, onHapus, kiriTerlipat = 0 }: {
  setelan: SetelanBilah;
  alat: AlatPegang | null;
  onAlat: (a: AlatPegang | null) => void;
  jumlahGambar: number;
  adaPilihan: boolean;
  onHapus: () => void;
  /** Lebar panel kiri di dalam chart (Dompet, jiplak, banding). Tombol
   *  "tampilkan" yang terlipat duduk sesudahnya, di tepi kanvas — bukan di
   *  atas daftar panel itu. */
  kiriTerlipat?: number;
}) {
  const { kursor, magnet, magnetTerakhir, tetap, kunci, sembunyi, pilihan, ubah, sempit, tampil, setBuka } = setelan;
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /* ── RUANG TEGAK ─────────────────────────────────────────────────────
     Kolomnya duduk di dalam wadah setinggi chart dan TIDAK boleh ikut
     menentukan tinggi itu — kalau boleh, lima tombol tambahan dari grup
     yang dijabarkan memanjangkan seluruh baris chart dan tombol terbawah
     jatuh di luar kartu (terjadi 29 Sep 2026: kolom 612 px di chart
     460 px). Jadi isinya `absolute inset-0`, dan tinggi wadahnya diukur:
     grup dijabarkan hanya kalau muat. ResizeObserver ditemani resize
     jendela — di panel pratinjau ia pernah tidak menyala sama sekali. */
  const luarRef = useRef<HTMLDivElement>(null);
  const [ruang, setRuang] = useState(0);
  useEffect(() => {
    const el = luarRef.current;
    if (!el) return;
    const ukur = () => setRuang(el.clientHeight);
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    window.addEventListener('resize', ukur);
    return () => { ro.disconnect(); window.removeEventListener('resize', ukur); };
  }, [tampil]);
  /* 17 tombol × 34 px + dua garis pisah + bantalan ≈ 612 px. */
  const jabar = !sempit && ruang >= 616;
  /* ── PADAT: KOLOM PENDEK ─────────────────────────────────────────────
     Dilaporkan pemilik 30 Sep 2026 dengan tangkapan layar iPhone: bilah
     di ponsel "berantakan di bawah". Dua sebab sekaligus. Kolom lengkap
     butuh ±476 px sedangkan chart ponsel cuma ±340 px, jadi kolomnya
     menggulir dan ikon teratas terpotong. Dan tombol lepas di bawah
     (pensil, gembok, mata, tempat sampah) adalah anak flex tanpa
     shrink-0 — mereka MENCIUT ke tinggi ikonnya (±18 px) sementara magnet
     yang berbungkus tetap 32 px, jadi jaraknya tidak rata.

     Di kolom pendek, empat sakelar gambar (magnet, tetap menggambar,
     kunci, sembunyi) dilipat jadi SATU tombol setelan bermenu, dan di
     ponsel tombolnya 28 px. Tempat sampah tetap berdiri sendiri — ia yang
     paling sering dicari. `ruang > 0`: sebelum terukur, jangan berkedip ke
     bentuk padat di desktop. */
  const padat = sempit || (ruang > 0 && ruang < 480);

  /* Memegang alat saat gambar disembunyikan: yang baru digambar harus
     terlihat, jadi sembunyi dimatikan — persis yang dilakukan TradingView. */
  const pegang = useCallback((a: AlatPegang | null) => {
    if (a && sembunyi) ubah({ sembunyi: false });
    onAlat(a);
  }, [onAlat, sembunyi, ubah]);

  const butirAktif = (g: Grup): Butir => {
    const simpan = pilihan[g.id];
    return g.butir.find((b) => b.nilai === simpan) ?? g.butir[0];
  };
  const grupMenyala = (g: Grup) => (g.id === 'kursor'
    ? !alat
    : g.butir.some((b) => b.macam === 'alat' && b.nilai === alat));

  const pakai = (g: Grup, b: Butir) => {
    ubah({ pilihan: { ...pilihan, [g.id]: String(b.nilai) } });
    if (b.macam === 'kursor') { ubah({ kursor: b.nilai }); pegang(null); }
    else pegang(b.nilai);
    setMenu(null);
  };

  const klikGrup = (g: Grup) => {
    const b = butirAktif(g);
    /* Menekan alat yang sedang dipegang melepaskannya — kembali ke kursor. */
    if (b.macam === 'alat' && alat === b.nilai) { pegang(null); return; }
    pakai(g, b);
  };

  const bukaMenu = (id: string, el: HTMLElement) => {
    if (menu?.id === id) { setMenu(null); return; }
    const r = el.getBoundingClientRect();
    setMenu({ id, x: r.right + 6, y: r.top });
  };

  /* Menu samping ditutup oleh klik di luar, Escape, gulir, atau ubah
     ukuran — posisinya dihitung dari letak tombol saat dibuka, dan letak
     itu tidak berlaku lagi begitu halamannya bergeser. */
  useEffect(() => {
    if (!menu) return;
    const luar = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if ((e.target as HTMLElement).closest?.('[data-bilah-panah]')) return;
      setMenu(null);
    };
    const tutup = () => setMenu(null);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('pointerdown', luar, true);
    window.addEventListener('resize', tutup);
    window.addEventListener('scroll', tutup, true);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', luar, true);
      window.removeEventListener('resize', tutup);
      window.removeEventListener('scroll', tutup, true);
      window.removeEventListener('keydown', esc);
    };
  }, [menu]);

  /* Menu yang dibuka dekat kaki layar dinaikkan supaya tidak terpotong. */
  useEffect(() => {
    const el = menuRef.current;
    if (!menu || !el) return;
    const t = el.getBoundingClientRect();
    const lebih = t.bottom - (window.innerHeight - 8);
    if (lebih > 0) el.style.top = `${Math.max(8, menu.y - lebih)}px`;
  }, [menu]);

  /* ── PINTASAN ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      const t = document.activeElement?.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || (document.activeElement as HTMLElement | null)?.isContentEditable) return;
      /* Escape melepaskan alat yang sedang dipegang. */
      if (e.key === 'Escape' && alat) { pegang(null); return; }
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const p = PINTAS.find((x) => x.alt === e.key.toLowerCase() && !!x.shift === e.shiftKey);
      if (!p) return;
      /* preventDefault wajib: Alt+F di Chrome Windows membuka menu peramban. */
      e.preventDefault();
      const g = GRUP.find((x) => x.butir.some((b) => b.nilai === p.alat));
      if (g) ubah({ pilihan: { ...pilihan, [g.id]: p.alat } });
      pegang(alat === p.alat ? null : p.alat);
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [alat, pegang, pilihan, ubah]);

  /* ── TERLIPAT ───────────────────────────────────────────────────────── */
  if (!tampil) {
    return (
      <button onClick={() => setBuka(true)} title="Tampilkan bilah alat gambar"
        style={{ left: kiriTerlipat }}
        className="absolute top-1/2 z-20 flex h-10 w-4 -translate-y-1/2 cursor-pointer items-center justify-center rounded-r-md border border-l-0 border-zinc-800 bg-zinc-950/90 text-zinc-500 transition-colors hover:text-zinc-100">
        <ChevronsRight className="size-3" />
      </button>
    );
  }

  /* shrink-0 di SETIAP tombol — lihat catatan `padat` di atas. */
  const tombol = cn('relative flex shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors',
    sempit ? 'size-7' : 'size-8');
  const tinggiPanah = sempit ? 'h-7' : 'h-8';
  /* Sakelar yang MENGUBAH perilaku klik di chart. Kalau salah satunya
     menyala saat terlipat di menu setelan, tombol setelannya ikut menyala —
     gambar yang tidak bisa dipilih tanpa tanda apa pun terbaca sebagai
     chart yang rusak. */
  const setelanNyala = kunci || sembunyi;
  const biasa = 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100';
  const nyala = 'bg-emerald-500/15 text-emerald-300';

  const grupMenu = menu && GRUP.find((g) => g.id === menu.id);

  return (
    /* overflow-x-hidden WAJIB. Kolom 40 px dengan garis kanan 1 px cuma
       menyisakan 39 px isi, sedangkan panah menu tiap grup menjulur sampai
       40 px — lebih setengah piksel. Tanpa ini peramban memasang batang
       gulir mendatar tipis di dasar kolom: "slide bar kecil" yang
       dilaporkan pemilik 29 Sep 2026 (terukur clientWidth 39, scrollWidth 40). */
    /* TANPA garis batas kanan (30 Sep 2026, meniru Hyperliquid): garis
       tegak di sisi kolom berdiri persis di sebelah garis kisi pertama
       chart dan terbaca sebagai garis dobel. */
    <div ref={luarRef} className="relative w-10 shrink-0 bg-zinc-950">
    <div className="absolute inset-0 flex flex-col items-center gap-0.5 overflow-y-auto overflow-x-hidden py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {GRUP.map((g) => {
        if (g.jabarDesktop && jabar) {
          return (
            <div key={g.id} className="flex flex-col items-center gap-0.5">
              {g.butir.map((x) => {
                const on = x.macam === 'alat' ? alat === x.nilai : !alat && kursor === x.nilai;
                const judulX = x.macam === 'alat' && x.pintas ? `${x.nama} · ${x.pintas}` : x.nama;
                return (
                  <button key={String(x.nilai)} onClick={() => {
                    if (x.macam === 'alat' && alat === x.nilai) { pegang(null); return; }
                    pakai(g, x);
                  }} title={judulX} aria-pressed={on}
                    className={cn(tombol, 'shrink-0', on ? nyala : biasa)}>
                    <Ik>{IKON[x.ikon]}</Ik>
                  </button>
                );
              })}
            </div>
          );
        }
        const b = butirAktif(g);
        const on = grupMenyala(g);
        const judul = b.macam === 'alat' && b.pintas ? `${b.nama} · ${b.pintas}` : b.nama;
        return (
          <div key={g.id} className="group relative shrink-0">
            {g.pisahSebelum && <div className="mx-auto mb-1 mt-0.5 h-px w-6 bg-zinc-800" />}
            <button onClick={() => klikGrup(g)} title={judul} aria-pressed={on}
              className={cn(tombol, on ? nyala : biasa)}>
              <Ik>{IKON[b.ikon]}</Ik>
            </button>
            {/* Panah kecil pembuka menu — hanya untuk kelompok yang punya
                lebih dari satu alat, dan hanya terlihat saat disorot, seperti
                di Hyperliquid/TradingView. Segitiga sudut yang dulu selalu
                tampil dibuang 29 Sep 2026: membuat ikonnya terlihat tidak
                di tengah. */}
            {g.butir.length > 1 && (
              <>
                <button data-bilah-panah onClick={(e) => bukaMenu(g.id, e.currentTarget)}
                  title={`Pilihan ${g.judul.toLowerCase()}`}
                  className={cn('absolute -right-1 bottom-0 flex w-2.5 cursor-pointer items-center justify-center rounded-sm text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-zinc-100 group-hover:opacity-100',
                    tinggiPanah, menu?.id === g.id && 'opacity-100')}>
                  <svg viewBox="0 0 6 10" width={5} height={9} aria-hidden><path d="M1 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth={1.4} /></svg>
                </button>
              </>
            )}
          </div>
        );
      })}

      <div className="my-1 h-px w-6 shrink-0 bg-zinc-800" />

      {padat ? (
        <button onClick={(e) => bukaMenu('setelan', e.currentTarget)} aria-pressed={setelanNyala}
          title="Setelan gambar — magnet, tetap menggambar, kunci, sembunyikan"
          className={cn(tombol, setelanNyala || menu?.id === 'setelan' ? nyala : biasa)}>
          <Settings2 className="size-[17px]" strokeWidth={1.6} />
          {!setelanNyala && (magnet !== 'mati' || tetap) && (
            <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-emerald-400" />
          )}
        </button>
      ) : (<>
      {/* Magnet: klik menyalakan/mematikan kekuatan terakhir; menu memilih
          lemah atau kuat. */}
      <div className="group relative shrink-0">
        <button onClick={() => ubah({ magnet: magnet === 'mati' ? magnetTerakhir : 'mati' })}
          title={magnet === 'mati' ? 'Magnet mati — titik gambar tidak menempel ke lilin'
            : magnet === 'lemah' ? 'Magnet lemah — menempel ke OHLC saat kursor dekat' : 'Magnet kuat — selalu menempel ke OHLC terdekat'}
          aria-pressed={magnet !== 'mati'}
          className={cn(tombol, magnet !== 'mati' ? nyala : biasa)}>
          <Magnet className="size-[17px]" strokeWidth={1.6} />
          {magnet === 'kuat' && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-emerald-300" />}
        </button>
        <button data-bilah-panah onClick={(e) => bukaMenu('magnet', e.currentTarget)} title="Kekuatan magnet"
          className={cn('absolute -right-1 top-0 flex w-2.5 cursor-pointer items-center justify-center rounded-sm text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-zinc-100 group-hover:opacity-100',
            tinggiPanah, menu?.id === 'magnet' && 'opacity-100')}>
          <svg viewBox="0 0 6 10" width={5} height={9} aria-hidden><path d="M1 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth={1.4} /></svg>
        </button>
      </div>

      <button onClick={() => ubah({ tetap: !tetap })} aria-pressed={tetap}
        title={tetap ? 'Tetap menggambar: NYALA — alat tidak dilepas sesudah satu gambar' : 'Tetap menggambar: mati — alat dilepas sesudah satu gambar'}
        className={cn(tombol, tetap ? nyala : biasa)}>
        <PencilLine className="size-[17px]" strokeWidth={1.6} />
      </button>
      <button onClick={() => ubah({ kunci: !kunci })} aria-pressed={kunci}
        title={kunci ? 'Gambar terkunci — tidak bisa dipilih atau digeser' : 'Kunci semua gambar'}
        className={cn(tombol, kunci ? nyala : biasa)}>
        {kunci ? <Lock className="size-[17px]" strokeWidth={1.6} /> : <LockOpen className="size-[17px]" strokeWidth={1.6} />}
      </button>
      <button onClick={() => ubah({ sembunyi: !sembunyi })} aria-pressed={sembunyi}
        title={sembunyi ? `Tampilkan ${jumlahGambar} gambar` : 'Sembunyikan semua gambar'}
        className={cn(tombol, sembunyi ? nyala : biasa)}>
        {sembunyi ? <EyeOff className="size-[17px]" strokeWidth={1.6} /> : <Eye className="size-[17px]" strokeWidth={1.6} />}
      </button>
      </>)}
      <button onClick={onHapus} disabled={!jumlahGambar && !adaPilihan}
        title={adaPilihan ? 'Hapus gambar terpilih (Delete)' : 'Hapus semua gambar di simbol ini (semua timeframe)'}
        className={cn(tombol, 'text-zinc-400 hover:bg-zinc-800/80 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-zinc-400')}>
        <Trash2 className="size-[17px]" strokeWidth={1.6} />
      </button>

      <div className={cn('flex-1', padat ? 'min-h-1' : 'min-h-2')} />
      <button onClick={() => setBuka(false)} title="Sembunyikan bilah alat gambar"
        className={cn(tombol, sempit ? 'h-6 w-7' : 'size-7', 'text-zinc-600 hover:bg-zinc-800/80 hover:text-zinc-300')}>
        <ChevronsLeft className="size-3.5" />
      </button>

      {/* ── MENU SAMPING ─────────────────────────────────────────────────
          Lewat portal ke <body>: wadah chart ber-overflow-hidden, dan menu
          yang lebih panjang dari chart pendek akan terpotong di sana. */}
      {menu && createPortal(
        <div ref={menuRef} style={{ left: menu.x, top: menu.y }}
          className="fixed z-[80] min-w-[228px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-2xl shadow-black/50">
          <div className="px-3 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            {menu.id === 'magnet' ? 'Magnet' : menu.id === 'setelan' ? 'Setelan gambar' : grupMenu?.judul}
          </div>
          {menu.id === 'setelan' ? (
            <>
              {/* Magnet tiga pilihan dalam satu baris: yang dipilih langsung
                  terlihat, tanpa menu kedua di dalam menu. */}
              <div className="flex items-center gap-2.5 px-3 py-1.5">
                <Magnet className={cn('size-4 shrink-0', magnet !== 'mati' ? 'text-emerald-300' : 'text-zinc-400')} strokeWidth={1.6} />
                <span className="flex-1 text-[12.5px] text-zinc-200">Magnet</span>
                <div className="flex overflow-hidden rounded-md border border-zinc-800">
                  {(['mati', 'lemah', 'kuat'] as const).map((m) => (
                    <button key={m} onClick={() => ubah(m === 'mati' ? { magnet: m } : { magnet: m, magnetTerakhir: m })}
                      className={cn('cursor-pointer px-2 py-0.5 text-[11px] capitalize transition-colors',
                        magnet === m ? 'bg-emerald-500/15 text-emerald-300' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100')}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <BarisSakelar aktif={tetap} onKlik={() => ubah({ tetap: !tetap })}
                ikon={<PencilLine className="size-4 shrink-0" strokeWidth={1.6} />}
                nama="Tetap menggambar" ket="Alat tidak dilepas sesudah satu gambar" />
              <BarisSakelar aktif={kunci} onKlik={() => ubah({ kunci: !kunci })}
                ikon={kunci ? <Lock className="size-4 shrink-0" strokeWidth={1.6} /> : <LockOpen className="size-4 shrink-0" strokeWidth={1.6} />}
                nama="Kunci semua gambar" ket="Gambar tidak bisa dipilih atau digeser" />
              <BarisSakelar aktif={sembunyi} onKlik={() => ubah({ sembunyi: !sembunyi })}
                ikon={sembunyi ? <EyeOff className="size-4 shrink-0" strokeWidth={1.6} /> : <Eye className="size-4 shrink-0" strokeWidth={1.6} />}
                nama="Sembunyikan gambar" ket={jumlahGambar ? jumlahGambar + ' gambar di simbol ini' : 'Belum ada gambar'} />
            </>
          ) : menu.id === 'magnet'
            ? ([['lemah', 'Magnet lemah', 'Menempel saat kursor dekat lilin'],
                ['kuat', 'Magnet kuat', 'Selalu menempel ke OHLC terdekat']] as const).map(([m, nama, ket]) => (
                <button key={m} onClick={() => { ubah({ magnet: m, magnetTerakhir: m }); setMenu(null); }}
                  className={cn('flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-zinc-800/80',
                    magnet === m ? 'text-emerald-300' : 'text-zinc-200')}>
                  <Magnet className="size-4 shrink-0" strokeWidth={1.6} />
                  <span className="flex flex-col">
                    <span className="text-[12.5px]">{nama}</span>
                    <span className="text-[10.5px] text-zinc-500">{ket}</span>
                  </span>
                </button>
              ))
            : grupMenu?.butir.map((b) => {
                const on = b.macam === 'alat' ? alat === b.nilai : !alat && kursor === b.nilai;
                return (
                  <button key={String(b.nilai)} onClick={() => grupMenu && pakai(grupMenu, b)}
                    className={cn('flex w-full cursor-pointer items-center gap-2.5 px-3 py-1 text-left transition-colors hover:bg-zinc-800/80',
                      on ? 'text-emerald-300' : 'text-zinc-200')}>
                    <Ik kecil>{IKON[b.ikon]}</Ik>
                    <span className="flex-1 text-[12.5px]">{b.nama}</span>
                    {b.macam === 'alat' && b.pintas && <span className="angka text-[10.5px] text-zinc-500">{b.pintas}</span>}
                  </button>
                );
              })}
        </div>,
        document.body,
      )}
    </div>
    </div>
  );
}
