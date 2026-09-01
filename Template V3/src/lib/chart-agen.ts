import { auth } from '@/lib/firebase';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   CHART PANTAUAN — arsip privat, hanya untuk pemilik
   ════════════════════════════════════════════════════════════════════════
   Sebagian ruang yang dipantau agen tidak menulis levelnya sebagai teks;
   yang diposting tangkapan layar chart. Agen menyimpan gambarnya apa adanya
   di VPS, dan PEMILIK yang menyaring serta menetapkan area entry-nya.

   ── SEMUANYA BERTOKEN, TERMASUK GAMBARNYA ──────────────────────────────
   Chart-chart ini membawa tanda air sumbernya di dalam pikselnya. Karena
   itu gambarnya pun tidak bisa dipasang lewat <img src="…"> biasa: peramban
   tidak mengirim header Authorization untuk <img>, jadi permintaannya akan
   dijawab 403 dan yang tampil kotak rusak.

   Diambil dengan fetch bertoken lalu dijadikan object URL. Konsekuensinya
   URL itu WAJIB dilepas saat komponennya dibongkar — object URL yang tidak
   dilepas menahan seluruh isi gambarnya di memori tab selama tab itu hidup,
   dan panel yang menampilkan puluhan chart akan menumpuknya diam-diam.
   ════════════════════════════════════════════════════════════════════════ */

export interface ChartPantauan {
  id: string;
  agen: string;
  keterangan: string;
  waktu: number;
  kb: number;
  sembunyi: boolean;
  /** Sudah dipindahkan pemilik ke seksi koinnya.
   *
   *  OPSIONAL, dan `undefined` berarti SUDAH — bukan belum. Baris arsip yang
   *  ditulis sebelum medan ini ada tidak membawanya sama sekali, dan
   *  memperlakukan "tidak ada" sebagai belum-dipilah akan membuat seluruh
   *  arsip lama membanjiri rak Baru sekaligus. Yang baru disimpan dengan
   *  `false` yang tegas. */
  terpilah?: boolean;
  catatan: string;
  sinyalId: string | null;
}

function dasar(): string {
  return (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
}

async function token(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try { return await u.getIdToken(); } catch { return null; }
}

/** Daftar chart yang menunggu ditinjau.
 *
 *  MEMULANGKAN null SAAT GAGAL, bukan daftar kosong. Daftar kosong berarti
 *  "sudah bersih, tidak ada yang perlu ditinjau" — kalimat yang sangat
 *  berbeda dari "kami belum bisa bertanya ke server". Menyamakan keduanya
 *  membuat panel menulis "semua sudah ditinjau" saat VPS-nya justru mati. */
export async function daftarChart(semua = false): Promise<ChartPantauan[] | null> {
  const t = await token();
  if (!t) return null;
  try {
    const r = await fetch(`${dasar()}/api/agen/chart${semua ? '?semua=1' : ''}`, {
      headers: { Authorization: 'Bearer ' + t },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j?.chart) ? j.chart : [];
  } catch { return null; }
}

/** Gambarnya sebagai object URL. Pemanggil WAJIB memanggil
 *  URL.revokeObjectURL saat selesai — lihat catatan di kepala berkas. */
export async function gambarChart(id: string): Promise<string | null> {
  const t = await token();
  if (!t) return null;
  try {
    const r = await fetch(`${dasar()}/api/agen/chart/${encodeURIComponent(id)}/gambar`, {
      headers: { Authorization: 'Bearer ' + t },
    });
    if (!r.ok) return null;
    return URL.createObjectURL(await r.blob());
  } catch { return null; }
}

export async function tandaiChart(id: string, isi: { sembunyi?: boolean; catatan?: string; terpilah?: boolean }): Promise<boolean> {
  const t = await token();
  if (!t) return false;
  try {
    const r = await fetch(`${dasar()}/api/agen/chart/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify(isi),
    });
    return r.ok;
  } catch { return false; }
}

export async function hapusChart(id: string): Promise<boolean> {
  const t = await token();
  if (!t) return false;
  try {
    const r = await fetch(`${dasar()}/api/agen/chart/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + t },
    });
    return r.ok;
  } catch { return false; }
}

/* ── AKTIVITAS AGEN ──────────────────────────────────────────────────────
   Menjawab pertanyaan yang tidak bisa dijawab daftar chart-nya sendiri:
   "agennya bekerja, atau ruangnya memang sepi?" Dua keadaan itu
   menghasilkan daftar yang sama persis — tidak bertambah. */

export interface RuangAgen {
  agen: string;
  judul: string;
  topik: number | null;
  admin: number;
  nyala: number;
  denyut: number;
  terhubung: boolean;
}

export interface JejakAgen {
  waktu: number;
  agen: string;
  /** `nyala` pemantau menyala · `simpan` chart diarsipkan · `lewat` pesan
   *  ditolak saringan. Yang ketiga yang paling berharga: saringan yang
   *  menolak diam-diam adalah cara paling rapi kehilangan postingan. */
  jenis: 'nyala' | 'simpan' | 'lewat';
  pesan: string;
}

export async function aktivitasChart(): Promise<{ log: JejakAgen[]; ruang: RuangAgen[] } | null> {
  const t = await token();
  if (!t) return null;
  try {
    const r = await fetch(`${dasar()}/api/agen/chart/aktivitas`, {
      headers: { Authorization: 'Bearer ' + t },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return { log: Array.isArray(j?.log) ? j.log : [], ruang: Array.isArray(j?.ruang) ? j.ruang : [] };
  } catch { return null; }
}

/* ══ SAKLAR AI PEMBACA CHART ═════════════════════════════════════════════
   Satu-satunya bagian pemantau yang memanggil model penglihatan, dan
   satu-satunya yang ongkosnya naik seiring ramainya ruang. Dua kendali:
   nyala/mati, dan jendela tanggal chart mana yang boleh dibaca. */
export interface SetelanMata {
  aktif: boolean;
  /** YYYY-MM-DD, WIB, inklusif. null = tanpa batas di sisi itu. */
  dari: string | null;
  sampai: string | null;
  diubah: number;
}

/** Ruang Telegram beserta DUA sakelarnya di .env. `gambar` yang mati
 *  berarti ruang itu tidak pernah menyuapi model — apa pun isi saklar
 *  panel. `arsip` yang hidup berarti chart-nya tetap tersimpan untuk
 *  dibaca sendiri, dan itu tidak berbiaya token sama sekali. */
export interface RuangMata {
  awalan: string;
  agen: string;
  gambar: boolean;
  arsip: boolean;
}

export interface KeadaanMata {
  setelan: SetelanMata;
  jatah: { harian: number; pakai: number; sisa: number };
  model: string;
  ruang: RuangMata[];
}

export async function bacaMata(): Promise<KeadaanMata | null> {
  const t = await token();
  if (!t) return null;
  try {
    const r = await fetch(`${dasar()}/api/agen/chart/mata`, {
      headers: { Authorization: 'Bearer ' + t },
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.setelan) return null;
    return {
      setelan: {
        aktif: j.setelan.aktif !== false,
        dari: j.setelan.dari || null,
        sampai: j.setelan.sampai || null,
        diubah: Number(j.setelan.diubah) || 0,
      },
      jatah: {
        harian: Number(j.jatah?.harian) || 0,
        pakai: Number(j.jatah?.pakai) || 0,
        sisa: Number(j.jatah?.sisa) || 0,
      },
      model: String(j.model || ''),
      ruang: Array.isArray(j.ruang) ? j.ruang.map((r: RuangMata) => ({
        awalan: String(r.awalan || ''),
        agen: String(r.agen || ''),
        gambar: r.gambar === true,
        arsip: r.arsip === true,
      })) : [],
    };
  } catch { return null; }
}

/** Memulangkan pesan galatnya apa adanya — penolakan di sini berbunyi
 *  "Tanggal mulai ada sesudah tanggal akhir", kalimat yang menjelaskan
 *  persis apa yang perlu diperbaiki. */
export async function simpanMata(v: { aktif: boolean; dari: string | null; sampai: string | null }):
  Promise<{ ok: true; setelan: SetelanMata } | { ok: false; pesan: string }> {
  const t = await token();
  if (!t) return { ok: false, pesan: 'Belum masuk.' };
  try {
    const r = await fetch(`${dasar()}/api/agen/chart/mata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify(v),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, pesan: j.error || 'Gagal menyimpan.' };
    return { ok: true, setelan: j.setelan };
  } catch (e) {
    return { ok: false, pesan: e instanceof Error ? e.message : 'Gagal menyimpan.' };
  }
}

/** Menyuruh AI membaca chart arsip SEKARANG, sekali jalan.
 *
 *  Pasangan dari saklar: saklar mematikan yang otomatis, ini yang
 *  menghidupkan sekali. Yang sudah pernah dibaca dilewati kecuali
 *  `ulangi` — menekan tombolnya dua kali tidak boleh membayar dua kali
 *  untuk gambar yang sama. */
export async function bacaSekarang(v: { dari?: string | null; sampai?: string | null; ulangi?: boolean }):
  Promise<{ ok: true; dibaca: number; sisaAntre: number; pesan: string } | { ok: false; pesan: string }> {
  const t = await token();
  if (!t) return { ok: false, pesan: 'Belum masuk.' };
  try {
    const r = await fetch(`${dasar()}/api/agen/chart/mata/baca`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify({ dari: v.dari || null, sampai: v.sampai || null, ulangi: v.ulangi === true }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, pesan: j.error || 'Gagal membaca.' };
    return { ok: true, dibaca: Number(j.dibaca) || 0, sisaAntre: Number(j.sisaAntre) || 0,
             pesan: String(j.pesan || '') };
  } catch (e) {
    return { ok: false, pesan: e instanceof Error ? e.message : 'Gagal membaca.' };
  }
}

export interface LevelSinyal {
  pasangan: string; arah: 'BUY' | 'SELL';
  entry: number; sl: number; tp: number;
  tf?: string; alasan?: string;
}

/** Menerbitkan kartu dari level yang DITULIS PEMILIK.
 *
 *  Memulangkan pesan galatnya apa adanya, bukan sekadar false: penolakan di
 *  sini hampir selalu berupa "SL di sisi yang salah untuk BUY di 4598" —
 *  kalimat yang menjelaskan persis apa yang perlu diperbaiki. Menggantinya
 *  dengan "gagal" membuang satu-satunya bagian yang berguna. */
export async function jadikanSinyal(id: string, isi: LevelSinyal): Promise<{ ok: true } | { ok: false; pesan: string }> {
  const t = await token();
  if (!t) return { ok: false, pesan: 'Belum masuk.' };
  try {
    const r = await fetch(`${dasar()}/api/agen/chart/${encodeURIComponent(id)}/sinyal`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify(isi),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, pesan: String(j.error || 'Ditolak server (' + r.status + ').') };
    return { ok: true };
  } catch (e) {
    return { ok: false, pesan: 'Tidak bisa menghubungi server.' };
  }
}
