import { useSyncExternalStore } from 'react';

/* ════════════════════════════════════════════════════════════════════════
   MULTI-CHART — keadaan, bus antar-jendela, dan kunci replay
   ════════════════════════════════════════════════════════════════════════
   Satu jendela "tools" membuka semua halaman; beberapa panel chart hidup
   di atasnya. Tiap panel adalah halaman Chart & Entry UTUH di dalam iframe
   (mode polos), jadi order, alat gambar, indikator, dan replay ikut tanpa
   satu fitur pun ditulis ulang.

   Tiga hal tinggal di berkas ini karena ketiganya harus dibaca dari DUA
   dunia yang berbeda — jendela utama dan isi iframe/popup:

   1. Keadaan multi (aktif + daftar panel), di localStorage supaya susunan
      kerjanya bertahan melintasi muat ulang.
   2. Bus BroadcastChannel: panel yang perlu membuka halaman lain (posting
      Copy Signal) MENYURUH jendela utama berpindah, alih-alih berpindah
      sendiri — panel kecil yang tiba-tiba menampilkan halaman Copy Signal
      bukan yang dimaksud siapa pun.
   3. Kunci replay: replay membebani, jadi hanya SATU konteks (panel,
      popup, atau jendela utama) yang boleh menjalankannya pada satu waktu.
   ════════════════════════════════════════════════════════════════════════ */

export interface PanelMulti { id: string; simbol: string; tf: string }
export interface KeadaanMulti { aktif: boolean; panel: PanelMulti[] }

export const MAKS_PANEL = 6;
const KUNCI = 'jt.multiChart';

/* ── Mode polos ──────────────────────────────────────────────────────────
   Dibekukan SEKALI saat modul dimuat, bukan dibaca ulang dari URL: navigasi
   internal SPA bisa mengubah query kapan saja, dan iframe yang tiba-tiba
   berhenti jadi polos akan menumbuhkan sidebar di dalam panel seperempat
   layar. Tiap konteks jendela memuat salinan modulnya sendiri, jadi nilai
   ini benar per konteks. */
export const POLOS: boolean = (() => {
  try { return new URLSearchParams(window.location.search).get('polos') === '1'; }
  catch { return false; }
})();

/* Panel PERTAMA grid membawa &utama=1: dialah satu-satunya yang tetap
   merender tabel Posisi Terbuka di bawah chartnya. Empat salinan tabel
   yang sama membuat tiap panel memanjang ke bawah tanpa menambah satu
   informasi pun — posisinya memang sama di semua panel. */
export const UTAMA: boolean = (() => {
  try { return new URLSearchParams(window.location.search).get('utama') === '1'; }
  catch { return false; }
})();

/** Id panel yang sedang dijalankan konteks ini, dari `&panel=`. Kosong di
 *  jendela tools. Dipakai untuk menerima kiriman simbol yang DITUJUKAN ke
 *  panel ini saja — tanpa alamat, satu pilihan di watchlist akan mengubah
 *  simbol semua panel sekaligus. */
export const ID_PANEL: string = (() => {
  try { return new URLSearchParams(window.location.search).get('panel') ?? ''; }
  catch { return ''; }
})();

function bacaSimpanan(): KeadaanMulti {
  try {
    const d = JSON.parse(localStorage.getItem(KUNCI) ?? 'null');
    if (d && typeof d.aktif === 'boolean' && Array.isArray(d.panel)) {
      const panel = d.panel
        .filter((p: unknown): p is PanelMulti => {
          const x = p as Record<string, unknown>;
          return !!x && typeof x.id === 'string' && typeof x.simbol === 'string' && typeof x.tf === 'string';
        })
        .slice(0, MAKS_PANEL);
      if (panel.length) return { aktif: d.aktif, panel };
    }
  } catch { /* privat atau rusak */ }
  return { aktif: false, panel: [] };
}

let simpanan: KeadaanMulti = bacaSimpanan();
const pendengar = new Set<() => void>();
function siarkan() { pendengar.forEach((f) => f()); }
function tulis(k: KeadaanMulti) {
  simpanan = k;
  try { localStorage.setItem(KUNCI, JSON.stringify(k)); } catch { /* privat */ }
  siarkan();
}
/* Tab lain menyalakan/mematikan multi → tab ini ikut tahu. */
try {
  window.addEventListener('storage', (e) => {
    if (e.key === KUNCI) { simpanan = bacaSimpanan(); siarkan(); }
  });
} catch { /* lingkungan tanpa window */ }

export function useMulti(): KeadaanMulti {
  return useSyncExternalStore(
    (cb) => { pendengar.add(cb); return () => { pendengar.delete(cb); }; },
    () => simpanan
  );
}

/* Kandidat panel tambahan. Yang pertama selalu chart yang sedang dibuka;
   sisanya pasangan yang paling sering dipantau. Duplikat simbol+tf
   dilewati supaya empat panel awal tidak berisi dua chart kembar. */
const CALON: { simbol: string; tf: string }[] = [
  { simbol: 'BTCUSDT', tf: '4h' }, { simbol: 'ETHUSDT', tf: '4h' },
  { simbol: 'SOLUSDT', tf: '4h' }, { simbol: 'BTCUSDT', tf: '1h' },
  { simbol: 'ETHUSDT', tf: '1h' }, { simbol: 'BTCUSDT', tf: '15m' },
];

let nomorPanel = 0;
function idBaru(): string {
  /* Date.now saja bisa tabrakan saat dua panel lahir dalam milidetik yang
     sama (nyalakanMulti membuat empat sekaligus). */
  return 'p' + Date.now().toString(36) + '-' + (nomorPanel++);
}

export function nyalakanMulti(simbolAwal: string, tfAwal: string) {
  const terpakai = new Set<string>();
  const panel: PanelMulti[] = [];
  const tambah = (simbol: string, tf: string) => {
    const kunci = simbol + '|' + tf;
    if (terpakai.has(kunci) || panel.length >= 4) return;
    terpakai.add(kunci);
    panel.push({ id: idBaru(), simbol, tf });
  };
  tambah(simbolAwal, tfAwal);
  CALON.forEach((c) => tambah(c.simbol, c.tf));
  tulis({ aktif: true, panel });
}

export function matikanMulti() { tulis({ aktif: false, panel: [] }); }

export function tambahPanel() {
  if (!simpanan.aktif || simpanan.panel.length >= MAKS_PANEL) return;
  const terpakai = new Set(simpanan.panel.map((p) => p.simbol + '|' + p.tf));
  const c = CALON.find((x) => !terpakai.has(x.simbol + '|' + x.tf)) ?? { simbol: 'BTCUSDT', tf: '4h' };
  tulis({ aktif: true, panel: [...simpanan.panel, { id: idBaru(), ...c }] });
}

export function hapusPanel(id: string) {
  const sisa = simpanan.panel.filter((p) => p.id !== id);
  /* Panel terakhir ditutup = mode multinya selesai. Grid kosong yang tetap
     terbuka cuma layar hitam dengan satu tombol. */
  if (!sisa.length) { matikanMulti(); return; }
  tulis({ aktif: true, panel: sisa });
}

/* ── Bus antar-jendela ───────────────────────────────────────────────────
   BroadcastChannel menjangkau iframe DAN popup se-origin, dan tidak
   mengirim balik ke pengirimnya sendiri — persis yang dibutuhkan: panel
   berbicara, jendela utama mendengar. */
export type PesanBus =
  | { jenis: 'navigasi'; ke: string }
  /* Kirim simbol ke SATU panel. `panel` wajib: bus menyiar ke semua konteks
     se-origin, jadi pesan tanpa alamat akan diambil setiap panel. */
  | { jenis: 'simbol'; panel: string; simbol: string };

let kanal: BroadcastChannel | null = null;
function bus(): BroadcastChannel | null {
  try { if (!kanal) kanal = new BroadcastChannel('jt-bus'); return kanal; }
  catch { return null; } /* peramban tua tanpa BroadcastChannel */
}

export function kirimBus(p: PesanBus) { bus()?.postMessage(p); }

export function dengarBus(cb: (p: PesanBus) => void): () => void {
  const k = bus();
  if (!k) return () => {};
  const terima = (e: MessageEvent) => { cb(e.data as PesanBus); };
  k.addEventListener('message', terima);
  return () => k.removeEventListener('message', terima);
}

/* ── Kunci replay: satu konteks pada satu waktu ──────────────────────────
   Lewat localStorage + detak jantung, bukan lewat bus: pemegang kunci bisa
   mati mendadak (popup ditutup paksa, tab crash), dan kunci yang tidak
   pernah dilepas akan memblokir replay selamanya. Detak yang berhenti
   membuat kuncinya basi sendiri dalam 15 detik. */
const KUNCI_REPLAY = 'jt.replayKunci';
const BASI_MS = 15_000;
const ID_KONTEKS = Math.random().toString(36).slice(2, 10);

export function replayDipegangLain(): boolean {
  try {
    const d = JSON.parse(localStorage.getItem(KUNCI_REPLAY) ?? 'null');
    return !!d && d.id !== ID_KONTEKS && Date.now() - (Number(d.waktu) || 0) < BASI_MS;
  } catch { return false; }
}

/** Pegang kuncinya selama replay berjalan. Nilai baliknya fungsi pelepas —
 *  dipanggil saat replay selesai ATAU komponennya dibongkar. */
export function pegangReplay(): () => void {
  const detak = () => {
    try { localStorage.setItem(KUNCI_REPLAY, JSON.stringify({ id: ID_KONTEKS, waktu: Date.now() })); }
    catch { /* privat */ }
  };
  detak();
  const t = window.setInterval(detak, 5_000);
  const lepas = () => {
    window.clearInterval(t);
    try {
      const d = JSON.parse(localStorage.getItem(KUNCI_REPLAY) ?? 'null');
      /* Hanya kunci MILIK SENDIRI yang dihapus — konteks lain mungkin sudah
         mengambil alih setelah kunci ini basi. */
      if (d?.id === ID_KONTEKS) localStorage.removeItem(KUNCI_REPLAY);
    } catch { /* privat */ }
  };
  window.addEventListener('beforeunload', lepas);
  return () => { window.removeEventListener('beforeunload', lepas); lepas(); };
}
