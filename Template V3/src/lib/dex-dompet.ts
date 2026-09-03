/* ════════════════════════════════════════════════════════════════════════
   DOMPET PERAMBAN — SAMBUNGAN NON-KUSTODIAL
   ════════════════════════════════════════════════════════════════════════
   Berkas ini dan `dex-hl.ts` adalah SATU-SATUNYA jalur di seluruh aplikasi
   yang menandatangani sesuatu dengan kunci milik PENGGUNA. Jalur order
   pemilik (Chart & Entry → order-nyata.ts → VPS) tidak menyentuh apa pun di
   sini, dan itu disengaja: keduanya memakai kunci yang sangat berbeda dan
   menanggung risiko yang sangat berbeda.

   ── APA YANG DISIMPAN, DAN APA YANG TIDAK ───────────────────────────────
   TIDAK PERNAH disimpan: seed phrase, kunci privat dompet utama. Kami tidak
   memintanya, tidak menerimanya, dan tidak punya kotak isian untuknya.
   Dompet utama cuma diminta MENANDATANGANI, lewat MetaMask/Rabby.

   DISIMPAN di localStorage peramban ini: kunci privat AGENT WALLET —
   dibuat di peramban ini, tidak pernah dikirim ke mana pun.

   ── KENAPA AGENT WALLET AMAN DISIMPAN, DAN SEBERAPA AMAN ────────────────
   Agent wallet Hyperliquid bisa MEMBUKA dan MENUTUP posisi, tapi TIDAK BISA
   menarik dana keluar. Itu jaminan protokol, bukan janji kami — tidak ada
   konfigurasi di sisi kami yang bisa mengubahnya.

   Yang TETAP jadi risiko: siapa pun yang bisa menjalankan skrip di domain
   ini bisa membaca kunci itu dan membuka posisi atas nama pengguna. Ia
   tidak bisa mencuri uangnya, tapi ia bisa merugikannya. Karena itu agent
   diberi `valid_until` — sesudah lewat, kuncinya jadi kertas mati walaupun
   masih tersimpan.

   Ini pertukaran yang sama yang diambil app.hyperliquid.xyz sendiri, dan
   ditulis di sini apa adanya supaya siapa pun yang membaca kode ini tahu
   persis apa yang sedang dipertaruhkan.

   ── ADAPTOR DOMPET: KENAPA DITULIS TANGAN ───────────────────────────────
   `@nktkas/hyperliquid` menerima signer viem atau ethers, dan MENOLAK
   penyedia EIP-1193 mentah. Yang dibutuhkannya sebenarnya cuma tiga metode.
   Menulisnya tangan (25 baris) menghindari menyeret seluruh mesin klien
   viem ke dalam potongan halaman ini demi tiga panggilan `request()`.

   Satu jebakan yang tidak boleh disentuh: pustaka mengenali jenis dompet
   dari JUMLAH PARAMETER `signTypedData`. Harus tepat 1 atau 2 supaya
   terbaca sebagai akun viem JSON-RPC. Menambah parameter ketiga membuatnya
   terbaca sebagai signer ethers v6 dan dipanggil dengan bentuk argumen yang
   sama sekali berbeda — gagal di tempat yang jauh dari sebabnya.
   ════════════════════════════════════════════════════════════════════════ */

/** Bentuk minimum penyedia dompet peramban (MetaMask, Rabby, dll). */
export interface PenyediaEip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(peristiwa: string, tangani: (...a: unknown[]) => void): void;
  removeListener?(peristiwa: string, tangani: (...a: unknown[]) => void): void;
  isMetaMask?: boolean;
}

declare global {
  interface Window { ethereum?: PenyediaEip1193 }
}

export function penyedia(): PenyediaEip1193 | null {
  if (typeof window === 'undefined') return null;
  return window.ethereum ?? null;
}

export function adaDompet(): boolean {
  return !!penyedia();
}

/** Alamat yang SUDAH diizinkan, tanpa memunculkan popup.
 *
 *  Dipisah dari `sambungDompet` dengan sengaja: halaman yang memunculkan
 *  popup MetaMask begitu dibuka mengajari orang menekan "tolak" secara
 *  refleks, dan refleks itu ia bawa ke permintaan tanda tangan yang
 *  sungguhan. Popup hanya muncul kalau ada yang menekan tombol. */
export async function alamatTersambung(): Promise<string | null> {
  const p = penyedia();
  if (!p) return null;
  try {
    const akun = await p.request({ method: 'eth_accounts' }) as string[];
    return akun?.[0]?.toLowerCase() ?? null;
  } catch { return null; }
}

/** Minta izin. Memunculkan popup dompet. */
export async function sambungDompet(): Promise<string> {
  const p = penyedia();
  if (!p) throw new Error('Tidak ada dompet di peramban ini. Pasang MetaMask atau Rabby dulu.');
  const akun = await p.request({ method: 'eth_requestAccounts' }) as string[];
  const a = akun?.[0]?.toLowerCase();
  if (!a) throw new Error('Dompet tidak memberikan satu pun alamat.');
  return a;
}

export async function rantaiKini(): Promise<number> {
  const p = penyedia();
  if (!p) return 0;
  try {
    const hex = await p.request({ method: 'eth_chainId' }) as string;
    return parseInt(hex, 16) || 0;
  } catch { return 0; }
}

/** Angka besar tidak muncul di aksi yang halaman ini pakai, tapi
 *  `JSON.stringify` MELEMPAR untuk BigInt alih-alih menuliskannya — dan
 *  lemparan di dalam penanda tangan terbaca sebagai "dompet menolak". */
function ganti(_kunci: string, nilai: unknown) {
  return typeof nilai === 'bigint' ? nilai.toString() : nilai;
}

/** Adaptor dompet utama, berbentuk akun viem JSON-RPC. */
export function dompetUtama(alamat: string) {
  const p = penyedia();
  if (!p) throw new Error('Dompet peramban tidak tersedia.');
  return {
    /* TEPAT SATU parameter — lihat catatan jebakan di kepala berkas. */
    signTypedData(params: {
      domain: unknown; types: unknown; primaryType: string; message: unknown;
    }): Promise<`0x${string}`> {
      return p.request({
        method: 'eth_signTypedData_v4',
        params: [alamat, JSON.stringify(params, ganti)],
      }) as Promise<`0x${string}`>;
    },
    async getAddresses(): Promise<`0x${string}`[]> {
      const akun = await p.request({ method: 'eth_accounts' }) as string[];
      return (akun ?? []) as `0x${string}`[];
    },
    async getChainId(): Promise<number> {
      const hex = await p.request({ method: 'eth_chainId' }) as string;
      return parseInt(hex, 16);
    },
  };
}

/* ════════════════════════════════════════════════════════════════════════
   AGENT WALLET YANG TERSIMPAN
   ════════════════════════════════════════════════════════════════════════
   Berkunci per ALAMAT PEMILIK, bukan satu kunci global. Satu peramban bisa
   dipakai dua akun — dan agent milik akun A yang terpakai untuk akun B
   ditolak Hyperliquid dengan pesan yang tidak menyebutkan sebabnya sama
   sekali. */

const AWALAN = 'jt.dexAgen.';

export interface AgenTersimpan {
  /** Kunci privat agent. Tidak pernah meninggalkan peramban ini. */
  kunci: `0x${string}`;
  alamat: string;
  /** Nama yang dikirim ke Hyperliquid, termasuk akhiran valid_until. */
  nama: string;
  /** Kedaluwarsa dalam milidetik epoch. */
  sampai: number;
  dibuat: number;
}

export function bacaAgen(pemilik: string): AgenTersimpan | null {
  try {
    const t = localStorage.getItem(AWALAN + pemilik.toLowerCase());
    if (!t) return null;
    const a = JSON.parse(t) as AgenTersimpan;
    if (!a?.kunci || !a?.alamat) return null;
    return a;
  } catch { return null; }
}

export function simpanAgen(pemilik: string, a: AgenTersimpan): void {
  try { localStorage.setItem(AWALAN + pemilik.toLowerCase(), JSON.stringify(a)); }
  catch { /* mode privat — sesi ini tetap jalan, penyegaran halaman tidak */ }
}

export function hapusAgen(pemilik: string): void {
  try { localStorage.removeItem(AWALAN + pemilik.toLowerCase()); } catch { /* privat */ }
}

/** Kedaluwarsa BUKAN sekadar hiasan: agent yang lewat masa berlakunya
 *  ditolak Hyperliquid, jadi kunci yang tertinggal di peramban umum
 *  berhenti berbahaya dengan sendirinya. */
export function agenKedaluwarsa(a: AgenTersimpan | null): boolean {
  return !!a && Date.now() > a.sampai;
}

export const UMUR_AGEN_MS = 7 * 24 * 60 * 60 * 1000;
