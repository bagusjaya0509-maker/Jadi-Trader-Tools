import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Newspaper, X, Loader2, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { bacaKoneksi } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   NEWS — kalender ekonomi, pindahan dari screener
   ════════════════════════════════════════════════════════════════════════
   Dulu tombol ini duduk di baris kendali Area Pantau di screener V2.
   Tempatnya keliru: yang dijawab kalender ekonomi adalah "aman tidak saya
   entry sekarang", dan pertanyaan itu muncul saat orang sedang MENATAP
   CHART sambil menaruh SL — bukan saat sedang memilih koin. Sekarang ia
   menempel di bilah kendali Chart & Entry, satu klik dari tombol order.

   Datanya dari `/api/news` milik backend sendiri: penyedia kalender
   memblokir permintaan langsung dari browser, dan lewat backend jawabannya
   di-cache 15 menit. Rutenya PUBLIK — tidak butuh token — jadi orang yang
   belum mengatur Backend URL tetap melihat isinya lewat proxy bawaan.
   ════════════════════════════════════════════════════════════════════════ */

const PROXY_BAWAAN = 'https://103-253-145-38.sslip.io';

/** Ambil ulang tiap 10 menit. Backend sudah men-cache 15 menit, jadi lebih
 *  sering dari ini cuma menambah permintaan tanpa menambah data baru. */
const SEGARKAN_MS = 10 * 60 * 1000;

/** Di bawah 60 menit menuju rilis dampak tinggi = zona siaga. Angka ini
 *  bukan tebakan gaya: itu jendela ketika spread melebar dan stop mudah
 *  tersapu oleh lonjakan yang tidak ada hubungannya dengan analisa. */
const SIAGA_MENIT = 60;

function dasar() {
  const url = bacaKoneksi().url.trim();
  return (url || PROXY_BAWAAN).replace(/\/+$/, '');
}

export interface EventEkonomi {
  waktu: number;
  judul: string;
  mataUang: string;
  dampak: 'high' | 'medium' | 'low';
  actual?: string;
  forecast?: string;
  previous?: string;
}

const MATA_UANG = ['USD', 'major', 'all', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY'];
const MAYOR = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];
const DAMPAK: { v: string; t: string }[] = [
  { v: 'high', t: 'Dampak Tinggi' },
  { v: 'medium', t: 'Tinggi + Sedang' },
  { v: 'all', t: 'Semua Dampak' },
];

function fmtSelisih(ms: number): string {
  if (ms <= 0) return '';
  const menit = Math.floor(ms / 60000);
  const jam = Math.floor(menit / 60);
  const hari = Math.floor(jam / 24);
  if (hari > 0) return `${hari} hari ${jam % 24} jam`;
  if (jam > 0) return `${jam} jam ${menit % 60} menit`;
  return `${menit} menit`;
}

/* ── Hook: dipakai panel ini DAN penanda siaga di bilah kendali ──────────
   Dipisah supaya tombolnya bisa memberi peringatan TANPA panelnya dibuka.
   Peringatan yang cuma muncul setelah diklik tidak memperingatkan siapa
   pun — yang perlu diberi tahu justru orang yang tidak sedang membuka
   kalender. */
export function useKalender() {
  const [events, setEvents] = useState<EventEkonomi[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  /* Detak per menit supaya hitung mundurnya benar-benar berjalan. Tanpa ini
     angkanya membeku di nilai saat panel dibuka — dan hitung mundur yang
     tidak turun lebih menyesatkan daripada tidak ada hitung mundur. */
  const [, setDetak] = useState(0);

  const muat = useCallback(async () => {
    try {
      const r = await fetch(`${dasar()}/api/news`);
      if (!r.ok) throw new Error(`Server menjawab ${r.status}`);
      const j = await r.json();
      if (!j || !Array.isArray(j.events)) throw new Error('Format jawaban tidak dikenali');
      setEvents(j.events as EventEkonomi[]);
      setGalat(null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat kalender');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
    const t = setInterval(() => void muat(), SEGARKAN_MS);
    const d = setInterval(() => setDetak((n) => n + 1), 60_000);
    return () => { clearInterval(t); clearInterval(d); };
  }, [muat]);

  /* Rilis dampak tinggi terdekat yang BELUM lewat, mata uang apa pun:
     penanda siaga di tombol tidak boleh ikut filter panel — orang yang
     menyaring ke JPY tetap perlu tahu NFP sebentar lagi rilis. */
  const berikut = useMemo(() => {
    if (!events) return null;
    const kini = Date.now();
    return events.find((e) => e.dampak === 'high' && MAYOR.includes(e.mataUang) && e.waktu > kini) ?? null;
  }, [events]);

  const siaga = !!berikut && berikut.waktu - Date.now() <= SIAGA_MENIT * 60_000;

  return { events, galat, memuat, berikut, siaga, muatUlang: muat };
}

/* forwardRef, BUKAN `ref` sebagai prop biasa. Proyek ini React 18: di sana
   `ref` yang diteruskan seperti prop lain DIABAIKAN DIAM-DIAM — tidak ada
   peringatan, refnya cuma selamanya null dan gulir otomatisnya tidak
   pernah jalan. (Baru React 19 yang memperbolehkannya.) */
/* Tipe props DIBERI NAMA, tidak ditulis inline di dalam <...> milik
   forwardRef. Bukan soal rapi: di berkas .tsx, parser Babel milik Vite
   membaca `<` sesudah nama sebagai awal JSX, lalu tersandung pada `;` di
   dalam tipe objek inline dan menggagalkan SELURUH modul dengan galat 500.
   tsc menerimanya tanpa keluhan, jadi ini tidak akan tertangkap oleh
   pemeriksaan tipe — hanya oleh membuka halamannya. */
interface PropsBaris { e: EventEkonomi; kini: number }

const Baris = forwardRef<HTMLDivElement, PropsBaris>(function Baris({ e, kini }, ref) {
  const lewat = e.waktu < kini;
  const d = new Date(e.waktu);
  const angka = [
    e.actual && ['Act', e.actual],
    e.forecast && ['Fcst', e.forecast],
    e.previous && ['Prev', e.previous],
  ].filter(Boolean) as [string, string][];

  return (
    <div ref={ref} className={cn('border-l-2 py-2 pl-3', lewat && 'opacity-45',
      e.dampak === 'high' ? 'border-red-500/70' : e.dampak === 'medium' ? 'border-amber-500/70' : 'border-zinc-700')}>
      <div className="flex items-baseline gap-2">
        <span className="angka shrink-0 text-[11px] text-zinc-500">
          {d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="shrink-0 rounded bg-zinc-800/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
          {e.mataUang}
        </span>
        <span className="min-w-0 flex-1 text-[12px] leading-snug text-zinc-200">{e.judul}</span>
      </div>
      {angka.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-[52px] text-[10.5px] text-zinc-500">
          {angka.map(([k, v]) => (
            <span key={k}>{k} <b className="angka text-zinc-300">{v}</b></span>
          ))}
        </div>
      )}
      {!lewat && !e.actual && (
        <div className="mt-0.5 pl-[52px] text-[10.5px] text-zinc-600">
          Rilis dalam {fmtSelisih(e.waktu - kini) || 'kurang dari semenit'}
        </div>
      )}
    </div>
  );
});

export function PanelNews() {
  const [buka, setBuka] = useState(false);
  const [cur, setCur] = useState('USD');
  const [dampak, setDampak] = useState('high');
  const { events, galat, memuat, berikut, siaga } = useKalender();
  const kotak = useRef<HTMLDivElement>(null);
  const barisDepan = useRef<HTMLDivElement>(null);

  /* Esc menutup. Panel melayang yang cuma bisa ditutup dengan menemukan
     tombol X-nya memaksa orang mencari, padahal tangannya sudah di papan
     ketik karena baru saja mengetik ukuran order. */
  useEffect(() => {
    if (!buka) return;
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') setBuka(false); };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [buka]);

  const kini = Date.now();

  const tampil = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => {
      const lolosCur = cur === 'all' ? true : cur === 'major' ? MAYOR.includes(e.mataUang) : e.mataUang === cur;
      const lolosDampak = dampak === 'all' ? true
        : dampak === 'medium' ? e.dampak === 'high' || e.dampak === 'medium'
        : e.dampak === 'high';
      return lolosCur && lolosDampak;
    });
  }, [events, cur, dampak]);

  /* Dikelompokkan per hari. Daftar jam tanpa tanggal memaksa orang menebak
     apakah 08:30 itu hari ini atau Kamis depan. */
  const perHari = useMemo(() => {
    const peta = new Map<string, EventEkonomi[]>();
    for (const e of tampil) {
      const k = new Date(e.waktu).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'short' });
      const arr = peta.get(k);
      if (arr) arr.push(e); else peta.set(k, [e]);
    }
    return [...peta.entries()];
  }, [tampil]);

  /* Event pertama yang BELUM lewat — titik gulir saat panel dibuka. */
  const pertamaDepan = useMemo(
    () => tampil.find((e) => e.waktu >= Date.now()) ?? null,
    [tampil],
  );

  /* Digulir ke hari ini, bukan ke puncak daftar. Kalender berisi seminggu
     penuh; membukanya di hari Senin berarti tiap kali harus menggulir
     melewati rilis yang sudah selesai untuk sampai ke yang belum. Yang
     sudah lewat tetap ADA di atas — kadang justru itu yang dicari ("tadi
     CPI-nya keluar berapa?") — cuma tidak lagi jadi yang pertama terlihat.
     'auto', bukan 'smooth': animasi gulir saat panel baru muncul terbaca
     sebagai isinya melompat sendiri. */
  useEffect(() => {
    if (!buka || !barisDepan.current) return;
    const t = setTimeout(() => {
      barisDepan.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    }, 0);
    return () => clearTimeout(t);
  }, [buka, perHari]);

  return (
    <div className="relative" ref={kotak}>
      <button
        onClick={() => setBuka((v) => !v)}
        title={berikut
          ? `Berikutnya: ${berikut.judul} (${berikut.mataUang})`
          : 'Kalender ekonomi — rilis berdampak tinggi'}
        className={cn(
          'flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors',
          siaga
            ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
            : buka
            ? 'border-zinc-600 text-zinc-100'
            : 'border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100',
        )}
      >
        <Newspaper className="size-3.5" /> News
        {/* Titik hanya muncul kalau memang ada yang perlu diwaspadai.
            Lencana yang selalu menyala berhenti dibaca dalam sehari. */}
        {siaga && <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />}
      </button>

      {buka && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setBuka(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 flex max-h-[70vh] w-[min(92vw,380px)] flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-zinc-800 px-3.5 py-2.5">
              <Newspaper className="size-3.5 text-zinc-400" />
              <span className="text-[12.5px] font-medium text-zinc-200">Kalender Ekonomi</span>
              <button onClick={() => setBuka(false)} aria-label="Tutup kalender"
                className="ml-auto cursor-pointer rounded p-0.5 text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-zinc-200">
                <X className="size-3.5" />
              </button>
            </div>

            <div className="flex gap-2 border-b border-zinc-800 px-3.5 py-2">
              {[
                { nilai: cur, set: setCur, opsi: MATA_UANG.map((v) => ({ v, t: v === 'major' ? 'Major' : v === 'all' ? 'Semua' : v })) },
                { nilai: dampak, set: setDampak, opsi: DAMPAK },
              ].map((s, i) => (
                <select key={i} value={s.nilai} onChange={(e) => s.set(e.target.value)}
                  className="h-7 flex-1 cursor-pointer rounded border border-zinc-800 bg-zinc-900/60 px-2 text-[11.5px] text-zinc-300 outline-none focus-visible:border-zinc-600">
                  {s.opsi.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                </select>
              ))}
            </div>

            {/* Rilis terdekat ditaruh DI ATAS daftar, bukan di dalamnya:
                inilah satu-satunya baris yang mengubah keputusan sekarang.

                Kalau sudah tidak ada, itu JUGA dikatakan. Slot yang menghilang
                begitu semua rilis minggu ini lewat terbaca sebagai panel yang
                gagal memuat — padahal "minggu ini sudah aman" justru kabar
                yang paling ingin didengar sebelum entry. */}
            {!memuat && !galat && (
              berikut ? (
                <div className={cn('border-b px-3.5 py-2.5 text-[11.5px] leading-relaxed',
                  siaga ? 'border-amber-500/30 bg-amber-500/[0.07] text-amber-200' : 'border-zinc-800 text-zinc-400')}>
                  Berikutnya <b className="text-zinc-100">{berikut.judul}</b> ({berikut.mataUang}) pukul{' '}
                  <span className="angka">{new Date(berikut.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  {' · '}{fmtSelisih(berikut.waktu - kini) || 'sebentar lagi'}
                  {siaga && (
                    <div className="mt-1 flex items-start gap-1.5 font-medium">
                      <TriangleAlert className="mt-px size-3.5 shrink-0" />
                      Hindari buka posisi baru sekarang.
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-b border-zinc-800 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-zinc-500">
                  Tidak ada rilis dampak tinggi yang tersisa minggu ini.
                </div>
              )
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-2">
              {memuat ? (
                <div className="flex items-center gap-2 py-6 text-[12px] text-zinc-500">
                  <Loader2 className="size-3.5 animate-spin" /> Memuat kalender…
                </div>
              ) : galat ? (
                /* Alasannya disebut. "Gagal memuat" tanpa sebab membuat orang
                   memeriksa koneksinya sendiri padahal yang mati backendnya. */
                <div className="py-6 text-[12px] leading-relaxed text-zinc-500">
                  Kalender tidak bisa diambil — {galat}. Panel ini membaca
                  <code className="mx-1 rounded bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-400">/api/news</code>
                  dari backend, jadi periksa Backend URL di Integrations.
                </div>
              ) : perHari.length === 0 ? (
                <div className="py-6 text-[12px] leading-relaxed text-zinc-500">
                  Tidak ada event {cur === 'all' ? '' : cur + ' '}yang cocok dengan filter ini.
                </div>
              ) : (
                perHari.map(([hari, isi]) => (
                  <div key={hari}>
                    <div className="sticky top-0 z-10 -mx-3.5 bg-zinc-950/95 px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600 backdrop-blur">
                      {hari}
                    </div>
                    {isi.map((e, i) => (
                      <Baris
                        key={`${e.waktu}-${e.judul}-${i}`} e={e} kini={kini}
                        /* Penanda untuk gulir otomatis: kalender memuat
                           seminggu penuh, jadi tanpa ini panel membuka di
                           hari Senin dan hari ini ada empat hari di bawah. */
                        ref={e === pertamaDepan ? barisDepan : undefined}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
