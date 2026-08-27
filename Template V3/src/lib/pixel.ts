/* ════════════════════════════════════════════════════════════════════════
   META PIXEL — satu-satunya tempat aplikasi menyentuh fbq
   ════════════════════════════════════════════════════════════════════════
   KENAPA ADA. Sampai 27 Agu 2026 jaditrader.co.id tidak punya pixel sama
   sekali (Events Manager: "No data sources"). Akibatnya iklan Instagram
   hanya bisa dioptimalkan untuk KLIK MURAH — Meta tidak punya satu pun
   sinyal tentang siapa yang akhirnya mendaftar, apalagi membayar. Iklan
   24 Agu membeli 383 kunjungan seharga Rp160.422, dan tidak ada yang tahu
   berapa di antaranya jadi pelanggan.

   Dataset: "Jadi Trader Tools - Web", pixel 1707400253897614, di akun
   iklan 2136224923626617.

   ── KENAPA DIBUNGKUS, BUKAN MEMANGGIL fbq LANGSUNG ─────────────────────
   Tiga alasan, dan ketiganya pernah menggigit proyek lain:

   1. fbq bisa BELUM ADA. Pemblokir iklan menghapusnya, dan jaringan lambat
      menundanya. `fbq(...)` telanjang di jalur pembayaran berarti
      TypeError persis di detik paling mahal — orang sudah bayar, lalu
      layarnya berhenti. Di sini kegagalan pixel tidak pernah menjatuhkan
      apa pun.
   2. Nama peristiwa harus SATU EJAAN. "Purchase" dan "purchase" adalah dua
      peristiwa berbeda di mata Meta, dan yang salah eja tidak pernah
      muncul di laporan — ia diam saja.
   3. Di pengembangan (localhost) peristiwa tidak boleh ikut terkirim,
      kalau tidak data belajarnya tercemar percobaan sendiri.

   ── YANG TIDAK DIKIRIM ─────────────────────────────────────────────────
   Tidak ada email, nama, uid, atau apa pun yang menunjuk orang tertentu.
   Cuma nama peristiwa. Kebijakan Meta melarang mengirim data sensitif, dan
   situs ini menyangkut uang orang — jadi batasnya dibuat di kode, bukan
   diserahkan ke kehati-hatian pemanggilnya.
   ════════════════════════════════════════════════════════════════════════ */

/** Peristiwa baku Meta yang dipakai situs ini. Sengaja union, bukan string:
 *  salah ketik jadi galat kompilasi, bukan laporan yang diam-diam kosong. */
export type Peristiwa =
  | 'PageView'
  | 'Lead'              // minta akses gratis
  | 'InitiateCheckout'  // menuju halaman bayar Lynk
  | 'Purchase'          // pulang dari Lynk, pembayaran tercatat
  | 'CompleteRegistration'; // akun baru dibuat

type Fbq = ((...a: unknown[]) => void) & { queue?: unknown[] };

function fbq(): Fbq | null {
  if (typeof window === 'undefined') return null;
  const f = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof f === 'function' ? f : null;
}

/** Benar hanya di situs tayang. localhost dan pratinjau tidak ikut terhitung. */
function tayang(): boolean {
  if (typeof window === 'undefined') return false;
  return /(^|\.)jaditrader\.co\.id$/.test(window.location.hostname);
}

export function jejak(nama: Peristiwa, data?: Record<string, unknown>): void {
  if (!tayang()) return;
  const f = fbq();
  if (!f) return;
  try {
    if (data) f('track', nama, data);
    else f('track', nama);
  } catch {
    /* Pixel tidak pernah boleh menjatuhkan halaman. */
  }
}

/** Dipanggil tiap pindah rute. BrowserRouter tidak memuat ulang halaman,
 *  jadi PageView bawaan di <head> cuma menyala sekali seumur kunjungan. */
export function jejakHalaman(): void {
  jejak('PageView');
}
