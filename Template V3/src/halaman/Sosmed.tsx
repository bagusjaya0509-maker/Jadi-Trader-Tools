import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2, Link2Off, Loader2, Plug, TriangleAlert, Upload, Video,
} from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { bacaKoneksi, dasarBackend } from '@/lib/koneksi';

/* ════════════════════════════════════════════════════════════════════════
   SOSMED — menerbitkan video ke TikTok dari situs ini
   ════════════════════════════════════════════════════════════════════════
   KENAPA HALAMAN INI ADA, dan bukan sekadar skrip di komputer pemilik.
   Skripnya memang sudah jalan lebih dulu (`Pemasaran/alat/terbit-tiktok.mjs`).
   Tapi TikTok tidak meninjau skrip: untuk lolos audit Content Posting API
   mereka menuntut video demo yang memperlihatkan ANTARMUKA di domain yang
   didaftarkan, beserta interaksi penggunanya. Terminal tidak memenuhi itu.

   Jadi halaman ini bukan hiasan demi audit — ia jalur yang sama, dengan
   wajah. Setelah audit lulus, ia tetap berguna: memposting dari HP atau dari
   komputer mana pun tanpa menyiapkan Node lebih dulu.

   YANG TIDAK ADA DI SINI: client secret TikTok. Peramban tidak boleh
   memegangnya — siapa pun bisa membaca bundel JavaScript yang diunduhnya.
   Semua panggilan ke TikTok terjadi di VPS (`tiktok.js`), dan halaman ini
   hanya bicara ke VPS itu.

   URUTAN LAYARNYA SENGAJA SAMA DENGAN URUTAN YANG DIMINTA TIKTOK di video
   demo: sambungkan → pilih video → tulis caption → terbitkan → lihat
   statusnya sampai selesai. Satu kolom, dari atas ke bawah, tanpa tab —
   supaya perekamannya tidak perlu melompat-lompat mencari tombol.
   ════════════════════════════════════════════════════════════════════════ */

interface Status {
  disetel: boolean;
  tersambung: boolean;
  akun: string | null;
  scope: string | null;
  redirect: string;
}

type Fase = 'diam' | 'mengunggah' | 'memproses' | 'selesai' | 'gagal';

/* Pesan dari TikTok datang sebagai kode berhuruf besar. Diterjemahkan di sini
   karena "PROCESSING_UPLOAD" di layar orang yang sedang merekam demo terlihat
   seperti error, padahal itu justru tanda semuanya berjalan. */
const ARTI_STATUS: Record<string, string> = {
  PROCESSING_UPLOAD: 'TikTok sedang memproses videonya…',
  PUBLISH_COMPLETE: 'Selesai — videonya sudah ada di TikTok.',
  FAILED: 'TikTok menolak videonya.',
};

export default function Sosmed() {
  const { pemilik, memuat } = useAuth();
  const [params, setParams] = useSearchParams();

  const [status, setStatus] = useState<Status | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const [berkas, setBerkas] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [privasi, setPrivasi] = useState('SELF_ONLY');
  const [pilihanPrivasi, setPilihanPrivasi] = useState<string[]>([]);

  const [fase, setFase] = useState<Fase>('diam');
  const [pesan, setPesan] = useState('');
  const berhenti = useRef(false);

  const dasar = dasarBackend();
  const token = bacaKoneksi().token.trim();

  const kepala = useCallback(
    () => ({ 'X-App-Token': token }),
    [token]
  );

  const muatStatus = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${dasar}/api/tiktok/status`, { headers: kepala() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'gagal membaca status');
      setStatus(j);
      setGalat(null);
      if (j.tersambung) void muatKreator();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    }
    // muatKreator sengaja tidak masuk dependensi: ia hanya dipanggil setelah
    // status bilang tersambung, dan menambahkannya membuat keduanya saling
    // membuat ulang tanpa henti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dasar, token, kepala]);

  const muatKreator = useCallback(async () => {
    try {
      const r = await fetch(`${dasar}/api/tiktok/creator`, { headers: kepala() });
      const j = await r.json();
      if (!r.ok) return;
      const pilihan: string[] = j.creator?.privacy_level_options || [];
      setPilihanPrivasi(pilihan);
      /* Nilai awal diambil dari yang TikTok izinkan, bukan dari tebakan.
         Sebelum audit lulus, PUBLIC_TO_EVERYONE memang tidak akan ada di
         daftar ini — dan memilihnya hanya menghasilkan penolakan. */
      if (pilihan.length && pilihan.indexOf(privasi) < 0) setPrivasi(pilihan[0]);
    } catch { /* daftar privasi cuma pembantu; penerbitan tetap memeriksanya di server */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dasar, kepala]);

  useEffect(() => { void muatStatus(); }, [muatStatus]);

  /* Kabar dari callback OAuth. Dibersihkan dari URL setelah dibaca supaya
     refresh tidak menampilkan pesan lama seolah baru terjadi. */
  useEffect(() => {
    const kabar = params.get('tiktok');
    if (!kabar) return;
    if (kabar === 'ok') { setGalat(null); void muatStatus(); }
    else if (kabar === 'batal') setGalat('Izin dibatalkan di layar TikTok.');
    else if (kabar === 'state') setGalat('Penanda keamanan tidak cocok atau kedaluwarsa. Ulangi dari tombol Hubungkan.');
    else setGalat('Penyambungan gagal. Coba lagi; kalau berulang, periksa log VPS.');
    params.delete('tiktok');
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { berhenti.current = true; }, []);

  async function hubungkan() {
    setSibuk(true); setGalat(null);
    try {
      const r = await fetch(`${dasar}/api/tiktok/mulai`, { headers: kepala() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'gagal memulai');
      window.location.href = j.url;   // pindah, bukan tab baru: callback-nya kembali ke sini
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
      setSibuk(false);
    }
  }

  async function putuskan() {
    setSibuk(true);
    try {
      await fetch(`${dasar}/api/tiktok/putus`, { method: 'POST', headers: kepala() });
      await muatStatus();
    } finally { setSibuk(false); }
  }

  async function terbitkan() {
    if (!berkas || !caption.trim()) return;
    setFase('mengunggah'); setGalat(null);
    setPesan(`Mengunggah ${(berkas.size / 1048576).toFixed(1)} MB…`);
    try {
      const q = new URLSearchParams({ judul: caption.trim(), privasi });
      const r = await fetch(`${dasar}/api/tiktok/terbit?${q}`, {
        method: 'POST',
        headers: { ...kepala(), 'Content-Type': berkas.type || 'video/mp4' },
        body: berkas,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error + (j.pilihan ? ` (yang tersedia: ${j.pilihan.join(', ')})` : ''));

      setFase('memproses');
      setPesan('Terkirim. Menunggu TikTok memproses…');

      /* TikTok memproses secara asinkron; tanpa jeda ini statusnya masih
         PROCESSING_UPLOAD selama beberapa detik pertama dan layarnya terlihat
         macet. Batas 5 menit supaya tidak berputar selamanya. */
      const sampai = Date.now() + 5 * 60 * 1000;
      for (;;) {
        if (berhenti.current) return;
        await new Promise((s) => setTimeout(s, 5000));
        const s = await fetch(`${dasar}/api/tiktok/terbit/${j.publish_id}`, { headers: kepala() });
        const d = await s.json();
        if (!s.ok) throw new Error(d.error || 'gagal membaca status');
        setPesan(ARTI_STATUS[d.status] || d.status);
        if (d.status === 'PUBLISH_COMPLETE') { setFase('selesai'); return; }
        if (d.status === 'FAILED') throw new Error(d.gagal || 'TikTok menolak videonya');
        if (Date.now() > sampai) throw new Error('Belum selesai setelah 5 menit. publish_id: ' + j.publish_id);
      }
    } catch (e) {
      setFase('gagal');
      setGalat(e instanceof Error ? e.message : String(e));
    }
  }

  if (memuat) return null;

  if (!pemilik) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Panel className="p-6 text-center">
          <TriangleAlert className="mx-auto mb-3 size-6 text-amber-400" />
          <p className="text-sm text-zinc-300">
            Halaman ini hanya untuk pemilik akun. Ia menerbitkan ke akun TikTok resmi
            Jadi Trader Tools, jadi aksesnya sengaja tidak dibagi.
          </p>
        </Panel>
      </div>
    );
  }

  const siapTerbit = Boolean(berkas && caption.trim() && status?.tersambung);
  const jalan = fase === 'mengunggah' || fase === 'memproses';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Sosial Media</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Menerbitkan video ke akun TikTok resmi. Semua panggilan ke TikTok terjadi
          di VPS — kunci rahasianya tidak pernah sampai ke peramban.
        </p>
      </div>

      {!token && (
        <Panel className="border-amber-500/40 p-4">
          <p className="text-sm text-amber-200">
            App Token belum dipasang di peramban ini. Isi dulu di <strong>Integrations</strong>,
            karena halaman ini memakai token yang sama untuk bicara ke VPS.
          </p>
        </Panel>
      )}

      {/* ── 1. Sambungan ─────────────────────────────────────────────── */}
      <Panel>
        <PanelHead judul="1. Sambungan TikTok" />
        <div className="p-4">
          {status?.disetel === false && (
            <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-200">
              Server belum punya <code>TIKTOK_CLIENT_KEY</code> / <code>TIKTOK_CLIENT_SECRET</code>.
              Isi di <code>.env</code> VPS lalu restart backend.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <span className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm',
              status?.tersambung
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-zinc-700 bg-zinc-900/60 text-zinc-400'
            )}>
              {status?.tersambung
                ? <><CheckCircle2 className="size-4" /> Tersambung{status.akun ? ` — @${status.akun}` : ''}</>
                : <><Link2Off className="size-4" /> Belum tersambung</>}
            </span>

            {status?.tersambung ? (
              <button onClick={() => void putuskan()} disabled={sibuk}
                      className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">
                Putuskan
              </button>
            ) : (
              <button onClick={() => void hubungkan()} disabled={sibuk || !token || status?.disetel === false}
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                {sibuk ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
                Hubungkan TikTok
              </button>
            )}
          </div>

          {status?.scope && (
            <p className="mt-3 text-xs text-zinc-500">Izin yang diberikan: {status.scope}</p>
          )}
        </div>
      </Panel>

      {/* ── 2. Video & caption ───────────────────────────────────────── */}
      <Panel>
        <PanelHead judul="2. Video dan caption" />
        <div className="flex flex-col gap-4 p-4">
          <label className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors',
            berkas ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-700 hover:border-zinc-600'
          )}>
            <input type="file" accept="video/mp4,video/quicktime" className="hidden"
                   onChange={(e) => { setBerkas(e.target.files?.[0] ?? null); setFase('diam'); }} />
            {berkas ? <Video className="size-6 text-emerald-400" /> : <Upload className="size-6 text-zinc-500" />}
            <span className="text-sm text-zinc-300">
              {berkas ? berkas.name : 'Pilih berkas video (MP4)'}
            </span>
            {berkas && (
              <span className="text-xs text-zinc-500">{(berkas.size / 1048576).toFixed(1)} MB</span>
            )}
          </label>

          <div>
            <label className="mb-1.5 block text-sm text-zinc-300">Caption</label>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4}
                      maxLength={2200} placeholder="Tulis caption beserta tagarnya…"
                      className="w-full rounded-md border border-zinc-700 bg-zinc-950/60 p-3 text-sm text-zinc-200 outline-none focus:border-zinc-600" />
            <p className="mt-1 text-right text-xs text-zinc-500">{caption.length} / 2200</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-zinc-300">Privasi</label>
            <select value={privasi} onChange={(e) => setPrivasi(e.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950/60 p-2.5 text-sm text-zinc-200 outline-none focus:border-zinc-600">
              {(pilihanPrivasi.length ? pilihanPrivasi : ['SELF_ONLY']).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-zinc-500">
              Daftar ini datang dari TikTok, bukan dari kami. Selama aplikasi belum lulus
              audit, hanya <code>SELF_ONLY</code> yang muncul — itu aturan mereka.
            </p>
          </div>
        </div>
      </Panel>

      {/* ── 3. Terbitkan ─────────────────────────────────────────────── */}
      <Panel>
        <PanelHead judul="3. Terbitkan" />
        <div className="p-4">
          <button onClick={() => void terbitkan()} disabled={!siapTerbit || jalan}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            {jalan ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Terbitkan ke TikTok
          </button>

          {pesan && (
            <p className={cn('mt-3 text-sm',
              fase === 'selesai' ? 'text-emerald-300' : fase === 'gagal' ? 'text-red-300' : 'text-zinc-400')}>
              {pesan}
            </p>
          )}

          {galat && (
            <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-300">
              {galat}
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
