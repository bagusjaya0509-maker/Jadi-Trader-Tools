import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radar, ExternalLink, CandlestickChart, Loader2, Sparkles, PauseCircle } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn, harga as fHarga } from '@/lib/utils';
import { bacaKoneksi, PROXY_BAWAAN } from '@/lib/koneksi';
import { useAuth } from '@/lib/auth';
import { auth } from '@/lib/firebase';

/* ════════════════════════════════════════════════════════════════════════
   SINYAL PANTAUAN — hasil kurasi agen Pemburu Sinyal
   ════════════════════════════════════════════════════════════════════════
   Sinyal dari komunitas yang LOLOS disiplin agen: pair, arah, entry, SL,
   dan TP harus lengkap — sinyal tanpa SL ditolak di hulu dan tidak pernah
   sampai ke panel ini. Sumber dan analisnya ditulis terbuka (disadur
   dengan atribusi), umurnya dihitung di layar, dan R:R dihitung dari
   levelnya sendiri — bukan dari klaim siapa pun.

   Pair Binance membuka chart kita langsung dengan garis SL/TP terpasang;
   pair forex menaut ke chart sumbernya.
   ════════════════════════════════════════════════════════════════════════ */


interface Sinyal {
  id: string;
  pair: string;
  arah: 'BUY' | 'SELL';
  tf: string;
  entry: number;
  sl: number;
  tp: number;
  sumber: string;
  analis: string;
  waktu: number;
  catatan: string;
  tautan?: string;
  /** Sampai kapan levelnya masih layak dipakai — diisi agen SETELAH
   *  memeriksa harga terkini. 0 berarti tidak dinyatakan. */
  kadaluarsa?: number;
  /** Harga saat agen mengkurasi, dan penilaiannya: 'belum' (entry belum
   *  tersentuh), 'dekat', atau 'jalan' (harga sudah lewat — sinyalnya
   *  tinggal kenangan). */
  hargaSaatKurasi?: number;
  statusHarga?: 'belum' | 'dekat' | 'jalan' | '';
}

interface Permintaan { id: string; waktu: number; status: string; mulai?: number }
interface HasilHunter {
  waktu: number; status: string; diperiksa: number; sinyalBaru: number; ringkas: string;
  mulai?: number; durasiMs?: number;
}

/** "2m 14d" — sengaja pendek dan berjalan. Yang ditanyakan orang yang
 *  menekan tombol bukan jam dinding, melainkan berapa lama ia harus
 *  menunggu; angka yang bergerak menjawabnya tanpa perlu dijelaskan. */
function durasi(ms: number): string {
  if (!isFinite(ms) || ms < 0) return '—';
  const d = Math.floor(ms / 1000);
  if (d < 60) return `${d} dtk`;
  const m = Math.floor(d / 60);
  const sisa = d % 60;
  if (m < 60) return `${m}m ${String(sisa).padStart(2, '0')}d`;
  return `${Math.floor(m / 60)}j ${String(m % 60).padStart(2, '0')}m`;
}

function umurTeks(ts: number): string {
  const h = Math.floor((Date.now() - ts) / 3_600_000);
  if (h < 1) return 'baru saja';
  if (h < 24) return `${h} jam lalu`;
  const hari = Math.floor(h / 24);
  return `${hari} hari lalu`;
}

/** "hari ini 21.43" / "Sen 06.13" — cukup untuk tahu agennya masih hidup.
 *  Sengaja memuat JAM: "2 jam lalu" tidak menjawab pertanyaan yang
 *  sebenarnya diajukan, yaitu apakah pemeriksaan terakhir terjadi sebelum
 *  atau sesudah sesi pasar yang sedang dilihat. */
function kapan(ts: number): string {
  const d = new Date(ts);
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const sekarang = new Date();
  const samaHari = d.toDateString() === sekarang.toDateString();
  if (samaHari) return `hari ini ${jam}`;
  const kemarin = new Date(sekarang.getTime() - 86_400_000);
  if (d.toDateString() === kemarin.toDateString()) return `kemarin ${jam}`;
  return `${d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })} ${jam}`;
}

/** Sisa umur sinyal dalam kalimat pendek. */
function sisaUmur(kadaluarsa: number): { teks: string; habis: boolean } {
  const sisa = kadaluarsa - Date.now();
  if (sisa <= 0) return { teks: 'kadaluarsa', habis: true };
  const jam = Math.floor(sisa / 3_600_000);
  if (jam < 1) return { teks: `sisa ${Math.max(1, Math.floor(sisa / 60_000))} menit`, habis: false };
  if (jam < 24) return { teks: `sisa ${jam} jam`, habis: false };
  return { teks: `sisa ${Math.floor(jam / 24)} hari`, habis: false };
}

/* `ringkas` = panel ini sedang berdiri di dalam rak 4 slot di halaman Copy
   Signal, bukan membentang selebar halaman. Yang berubah HANYA tata letak
   dalamnya: kisi sinyal jadi satu kolom, dan jarak bawahnya dilepas karena
   grid induknya yang mengatur jarak. Tidak ada isi yang disembunyikan —
   panel yang menyembunyikan data saat disempitkan membuat orang mengira
   agennya berhenti bekerja. */
export function PanelSinyal({ ringkas = false }: { ringkas?: boolean } = {}) {
  const [daftar, setDaftar] = useState<Sinyal[]>([]);
  const [diperiksa, setDiperiksa] = useState(0);
  const [permintaan, setPermintaan] = useState<Permintaan | null>(null);
  const [hasil, setHasil] = useState<HasilHunter | null>(null);
  /* Agen bisa DIJEDA saat logikanya sedang diperbaiki. Tombol yang tetap
     hidup dalam keadaan itu menerima permintaan yang tidak akan pernah
     dikerjakan — dan menunggu selamanya lebih buruk daripada ditolak
     terus terang di muka. */
  const [jeda, setJeda] = useState(false);
  const [alasanJeda, setAlasanJeda] = useState('');
  const [meminta, setMeminta] = useState(false);
  const [kabarMinta, setKabarMinta] = useState('');
  const { pengguna } = useAuth();

  useEffect(() => {
    let hidup = true;
    const dasar = (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
    const tarik = () => {
      fetch(`${dasar}/api/sinyal`)
        .then((r) => r.json())
        .then((j) => {
          if (!hidup) return;
          if (Array.isArray(j?.sinyal)) {
            setDaftar(j.sinyal.filter((s: Sinyal) => s.pair && s.entry && s.sl && s.tp));
          }
          if (Number(j?.diperiksa) > 0) setDiperiksa(Number(j.diperiksa));
        })
        .catch(() => { /* panel kosong lebih baik daripada panel karangan */ });
    };
    const tarikStatus = () => {
      fetch(`${dasar}/api/hunter/status`)
        .then((r) => r.json())
        .then((j) => {
          if (!hidup) return;
          setPermintaan(j?.permintaan ?? null);
          setHasil(j?.terakhir ?? null);
          setJeda(j?.jeda === true);
          setAlasanJeda(String(j?.alasanJeda ?? ''));
        })
        .catch(() => { /* status diam lebih baik daripada status karangan */ });
    };
    tarik();
    tarikStatus();
    const jam = setInterval(tarik, 120_000);
    /* Status agen ditarik lebih sering DARIPADA daftar sinyalnya: setelah
       menekan tombol, yang ditunggu orangnya adalah kabar bahwa
       permintaannya sedang dikerjakan — bukan sinyalnya, yang memang belum
       ada sampai agennya selesai. */
    const jamStatus = setInterval(tarikStatus, 15_000);
    return () => { hidup = false; clearInterval(jam); clearInterval(jamStatus); };
  }, []);

  /* Meminta agen bekerja. Butuh login: tombolnya ada di browser, dan
     APP_TOKEN pemilik tidak boleh ikut ke sana. */
  async function mintaHunter() {
    const u = auth.currentUser;
    if (!u) { setKabarMinta('Masuk dulu untuk meminta agen bekerja.'); return; }
    setMeminta(true); setKabarMinta('');
    try {
      const dasar = (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
      const token = await u.getIdToken();
      const r = await fetch(`${dasar}/api/hunter/minta`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ catatan: 'Diminta dari halaman Copy Trading' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `Server menjawab ${r.status}`);
      setPermintaan(j.permintaan ?? null);
      setKabarMinta(j.sudahAntre
        ? 'Sudah ada permintaan yang menunggu — agen mengerjakan yang itu dulu.'
        : 'Permintaan terkirim. Agen mengerjakannya saat aplikasi Claude terbuka.');
    } catch (e) {
      setKabarMinta(e instanceof Error ? e.message : 'Gagal mengirim permintaan');
    } finally { setMeminta(false); }
  }

  const sedangJalan = !!permintaan && permintaan.status !== 'selesai'
    && Date.now() - permintaan.waktu < 30 * 60_000;

  /* Jam berjalan saat agen bekerja. Tanpa detik yang bergerak, tombol yang
     diam tiga menit tidak bisa dibedakan dari tombol yang macet — dan itu
     persis keluhannya. */
  const [tik, setTik] = useState(0);
  useEffect(() => {
    if (!sedangJalan) return;
    const j = setInterval(() => setTik((v) => v + 1), 1000);
    return () => clearInterval(j);
  }, [sedangJalan]);
  /* DUA keadaan yang berbeda, dan sebelumnya keduanya ditulis "bekerja":
       · menunggu dijemput — agen belum menyentuh apa pun
       · dikerjakan        — agen benar-benar sedang membaca ruang sinyal
     Menyebut yang pertama "bekerja 2m 50d" adalah kebohongan kecil yang
     membuat orang mengira ada yang macet, padahal agennya memang belum
     dibangunkan. Penjemputan berjalan tiap 2 menit. */
  const dijemputMs = 2 * 60_000;
  const sudahMulai = !!permintaan?.mulai;
  const berjalanMs = sudahMulai ? Date.now() - permintaan!.mulai! : 0;
  const sisaJemput = sedangJalan && !sudahMulai
    ? Math.max(0, dijemputMs - ((Date.now() - permintaan!.waktu) % dijemputMs))
    : 0;
  void tik;   // pemicu render tiap detik

  /* "Baru" berarti pencarian terakhir masih dalam 6 jam. Sejak agen bekerja
     ATAS PERMINTAAN, ukurannya bukan lagi "apakah jadwalnya jalan" —
     jadwalnya memang tidak ada. Yang berguna diketahui: apakah yang tampil
     ini hasil pencarian yang masih segar, atau sisa kemarin. */
  const aktif = diperiksa > 0 && Date.now() - diperiksa < 6 * 3_600_000;

  /* Panel tetap tampil walau belum ada sinyal — supaya "belum ada sinyal
     baru" bisa dibedakan dari "agennya mati". Yang membedakan cuma baris
     status di kepalanya. */
  if (!daftar.length && !diperiksa) return null;

  /* mb-4, bukan mt-4: panel ini PEMBUKA halaman Copy Trading — jaraknya
     ke bawah (panel permintaan akses), bukan ke atas. Saat kosong ia
     null, jadi margin-nya ikut hilang tanpa menyisakan celah. */
  return (
    /* Di rak 4 slot, tingginya DIKUNCI dan isinya yang menggulir.
       Tanpa ini panel pertama menjulur jauh ke bawah sementara tiga slot
       kosong di sebelahnya pendek — dan baris yang tingginya timpang
       terbaca sebagai tata letak yang rusak, bukan sebagai satu panel
       yang kebetulan berisi banyak. */
    <Panel className={cn(!ringkas && 'mb-4', ringkas && 'flex h-[460px] flex-col overflow-hidden')}>
      <PanelHead
        judul={
          /* Label beta menempel di JUDULNYA, bukan di catatan kecil yang
             bisa terlewat. Agen ini masih diperbaiki, dan orang yang
             menaruh uang berdasarkan sinyalnya berhak tahu itu sebelum
             membaca isinya — bukan sesudah. */
          <span className="flex items-center gap-2">
            Sinyal Pantauan
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9.5px] font-normal text-amber-400/90">
              beta
            </span>
          </span>
        }
        /* Kalimat panjangnya dipendekkan di rak. Di kolom 320 px ia
           membungkus jadi belasan baris dan mendorong sinyalnya —
           satu-satunya isi yang benar-benar dicari — turun ke luar layar.
           Peringatan betanya TIDAK hilang: ia sudah menempel di judul,
           dan kalimat lengkapnya tetap terbaca sebagai tooltip. */
        sub={ringkas
          ? 'Dikurasi agen Pemburu Sinyal. Masih beta — periksa ulang sebelum dipakai.'
          : 'Dikurasi agen Pemburu Sinyal — hanya sinyal berlevel lengkap yang lolos; sumbernya ditulis terbuka. Agennya masih dalam perbaikan: hasilnya bisa meleset atau tertunda, jadi periksa ulang sebelum dipakai.'}
        kanan={
          <span className="flex items-center gap-2">
            {/* Yang ditampilkan LAMA KERJANYA, bukan jam pemeriksaan.
                "diperiksa hari ini 00.01" tidak menjawab pertanyaan siapa
                pun; "bekerja 2m 14d" memberi tahu apakah menunggu tiga
                menit itu wajar. */}
            {sedangJalan ? (
              <span className="angka hidden text-[10.5px] text-amber-300/90 sm:inline">
                {sudahMulai ? `bekerja ${durasi(berjalanMs)}` : `dijemput ≤ ${durasi(sisaJemput)}`}
              </span>
            ) : hasil?.durasiMs ? (
              <span className="hidden text-[10.5px] text-zinc-500 sm:inline">
                terakhir bekerja <span className="angka">{durasi(hasil.durasiMs)}</span>
              </span>
            ) : null}
            {/* Tombol panggil. Agen tidak lagi memeriksa tiap 30 menit —
                ruang sinyal tidak berbicara sesering itu, dan 34 kali
                "tidak ada yang baru" sehari cuma membakar kuota. */}
            <button onClick={() => void mintaHunter()} disabled={jeda || meminta || sedangJalan || !pengguna}
              title={jeda ? (alasanJeda || 'Agen sedang dijeda untuk perbaikan')
                : !pengguna ? 'Masuk dulu untuk meminta agen bekerja'
                : sedangJalan ? 'Permintaanmu sedang dikerjakan' : 'Panggil agen untuk mencari sinyal terbaru sekarang'}
              className={cn('flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                jeda ? 'bg-zinc-800 text-zinc-500'
                  : sedangJalan ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-zinc-100 text-zinc-950 hover:bg-white',
                'disabled:cursor-not-allowed disabled:opacity-60')}>
              {jeda
                ? <><PauseCircle className="size-3" /> Agen dijeda</>
                : sedangJalan
                ? <><Loader2 className="size-3 animate-spin" /> Agen bekerja…</>
                : <><Sparkles className="size-3" /> Minta AI Hunter</>}
            </button>
            <Radar className={cn('size-4', aktif ? 'text-red-400' : 'text-zinc-600')} />
          </span>
        }
      />
      {/* DISEMBUNYIKAN DI RAK (permintaan pemilik 14 Agu 2026).
          ──────────────────────────────────────────────────────────────
          Blok ini menjelaskan keadaan AGEN — dijeda, sedang berjalan,
          hasil pencarian terakhir. Di kolom 320 px kalimatnya membungkus
          jadi belasan baris dan mendorong sinyalnya, satu-satunya isi
          yang benar-benar dicari, jauh ke bawah.

          Yang TIDAK ikut hilang: lencana "Agen dijeda" dan waktu bekerja
          di kepala panel. Keduanya menyampaikan hal yang sama dalam dua
          kata, dan itu bagian yang memang harus tetap terlihat — orang
          yang menaruh uang berdasarkan sinyal berhak tahu agennya sedang
          tidak bekerja.

          Yang hilang cuma kalimat panjangnya. Kabar hasil permintaan
          (kabarMinta) tetap tampil walau di rak: itu jawaban langsung
          atas tombol yang baru saja ditekan, dan menelannya membuat
          tombolnya terasa tidak melakukan apa-apa. */}
      {(ringkas ? !!kabarMinta : (jeda || kabarMinta || sedangJalan || hasil)) && (
        <div className="px-5 pb-2 text-[11px] leading-relaxed text-zinc-500">
          {!ringkas && jeda && (
            <span className="text-amber-300/90">
              Agen sedang dijeda{alasanJeda ? ` — ${alasanJeda}` : ' untuk perbaikan'}. Sinyal yang
              sudah terbit di bawah tetap berlaku sesuai masa berlakunya masing-masing.
            </span>
          )}
          {!jeda && kabarMinta && <span className="text-zinc-400">{kabarMinta}</span>}
          {!ringkas && sedangJalan && !kabarMinta && (
            <span className="text-amber-300/90">
              {sudahMulai
                ? <>Agen sedang membaca ruang sinyal — berjalan <span className="angka">{durasi(berjalanMs)}</span>.</>
                : <>Permintaan {kapan(permintaan!.waktu)} — belum dijemput. Penjemputan berjalan tiap 2 menit,
                   jadi agen mulai dalam <span className="angka">≤ {durasi(sisaJemput)}</span>. Ia hanya jalan saat aplikasi Claude terbuka.</>}
            </span>
          )}
          {!ringkas && !sedangJalan && !kabarMinta && hasil && (
            <span>
              Pencarian terakhir {kapan(hasil.waktu)}
              {hasil.durasiMs ? <> · lama kerja <span className="angka text-zinc-400">{durasi(hasil.durasiMs)}</span></> : null}
              {' '}· {hasil.diperiksa} postingan diperiksa,{' '}
              <span className={hasil.sinyalBaru > 0 ? 'text-emerald-400' : 'text-zinc-400'}>
                {hasil.sinyalBaru} sinyal baru
              </span>
              {hasil.ringkas ? ` · ${hasil.ringkas}` : ''}
            </span>
          )}
        </div>
      )}
      {/* Baris waktu untuk layar sempit — di sana lencana di kepala panel
          sudah penuh, dan kapan terakhir diperiksa terlalu penting untuk
          dibuang begitu saja. */}
      {diperiksa > 0 && (
        <div className="px-5 pb-1 text-[10.5px] text-zinc-600 sm:hidden">
          diperiksa {kapan(diperiksa)}
        </div>
      )}
      {!daftar.length && (
        <p className="px-5 pb-5 text-[12px] leading-relaxed text-zinc-500">
          Belum ada sinyal berlevel lengkap yang lolos.{' '}
          {aktif
            ? 'Agennya memeriksa ruang sinyal tiap 30 menit; postingan tanpa SL absolut memang ditolak di hulu.'
            : 'Agennya sedang tidak memeriksa — ia berjalan saat aplikasi Claude terbuka.'}
        </p>
      )}
      <div className={cn('grid grid-cols-1 gap-3 px-5 pb-5',
                          !ringkas && 'md:grid-cols-2 xl:grid-cols-3',
                          ringkas && 'min-h-0 flex-1 overflow-y-auto')}>
        {daftar.map((s) => {
          const jarakSl = Math.abs(s.entry - s.sl);
          const jarakTp = Math.abs(s.tp - s.entry);
          const rr = jarakSl > 0 ? jarakTp / jarakSl : 0;
          const kripto = s.pair.endsWith('USDT');
          /* Pair forex tidak berdolar — 181.643 yen bukan $181. */
          const f = (v: number) => (kripto ? fHarga(v) : v.toFixed(3));
          const tua = Date.now() - s.waktu > 3 * 86_400_000;
          /* Sinyal mati karena HARGANYA sudah jalan, bukan karena umurnya.
             Dua penanda dipisah supaya keduanya bisa dibaca: umur kurasi
             (kapan agen melihatnya) dan sisa masa berlaku (sampai kapan
             levelnya masih layak). */
          const umur = s.kadaluarsa ? sisaUmur(s.kadaluarsa) : null;
          const mati = (umur?.habis ?? false) || s.statusHarga === 'jalan';
          return (
            <div key={s.id}
                 className={cn('rounded-xl border p-3.5 transition-opacity',
                   mati ? 'border-zinc-800/50 opacity-55' : 'border-zinc-800/70')}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[13.5px] font-semibold tracking-tight text-zinc-100">{s.pair}</span>
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold',
                  s.arah === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
                  {s.arah}
                </span>
                <span className="text-[10.5px] uppercase text-zinc-600">{s.tf}</span>
                <span className={cn('ml-auto text-[10.5px]', tua ? 'text-amber-400/80' : 'text-zinc-500')}>
                  {umurTeks(s.waktu)}{tua ? ' · periksa ulang' : ''}
                </span>
              </div>

              {/* Masa berlaku & keadaan harga — hasil pemeriksaan agen, bukan
                  hitungan jam belaka. */}
              {(umur || s.statusHarga) && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                  {s.statusHarga === 'jalan' ? (
                    <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-red-400">
                      harga sudah jalan
                    </span>
                  ) : s.statusHarga === 'dekat' ? (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-amber-300">
                      dekat entry
                    </span>
                  ) : s.statusHarga === 'belum' ? (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-emerald-400">
                      belum tersentuh
                    </span>
                  ) : null}
                  {umur && (
                    <span className={cn(umur.habis ? 'text-red-400/80' : 'text-zinc-500')}>
                      {umur.habis ? 'kadaluarsa' : `berlaku · ${umur.teks}`}
                    </span>
                  )}
                  {s.hargaSaatKurasi ? (
                    <span className="text-zinc-600">harga saat dikurasi {f(s.hargaSaatKurasi)}</span>
                  ) : null}
                </div>
              )}
              <div className="mb-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-zinc-900/70 py-1.5">
                  <div className="text-[9.5px] uppercase tracking-wide text-zinc-600">Entry</div>
                  <div className="angka text-[12.5px] text-zinc-200">{f(s.entry)}</div>
                </div>
                <div className="rounded-lg bg-red-500/[0.07] py-1.5">
                  <div className="text-[9.5px] uppercase tracking-wide text-red-400/70">SL</div>
                  <div className="angka text-[12.5px] text-red-400">{f(s.sl)}</div>
                </div>
                <div className="rounded-lg bg-emerald-500/[0.07] py-1.5">
                  <div className="text-[9.5px] uppercase tracking-wide text-emerald-500/70">TP</div>
                  <div className="angka text-[12.5px] text-emerald-500">{f(s.tp)}</div>
                </div>
              </div>
              <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-500">
                <span>R:R <span className={cn('angka', rr >= 1.5 ? 'text-emerald-500' : 'text-zinc-300')}>1 : {rr.toFixed(2)}</span></span>
                <span className="truncate">· {s.analis}</span>
              </div>
              <p className="mb-2.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-600" title={s.catatan}>
                {s.catatan}
              </p>
              {/* SEMUA sinyal membuka Chart & Backtest kita, bukan chart
                  orang lain — lengkap dengan entry, SL, dan TP-nya. Menaut
                  ke chart sumber berarti menyuruh orang membaca level di
                  satu tempat lalu memasangnya sendiri di tempat lain, dan
                  di situlah angka salah ketik lahir.
                  Pair non-USDT dibuka lewat sumber MT5 (butuh EA terpasang
                  di simbol itu); tautan sumbernya tetap disediakan kecil
                  di sebelahnya sebagai rujukan. */}
              <div className="flex items-center gap-2">
                <Link
                  to={`/chart?simbol=${kripto ? s.pair : `MT5:${s.pair}`}`
                    + `&tf=${encodeURIComponent(s.tf || '4h')}`
                    + `&entry=${s.entry}&sl=${s.sl}&tp=${s.tp}&arah=${s.arah}`}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-950 transition-colors hover:bg-white">
                  <CandlestickChart className="size-3" /> Buka di Chart
                </Link>
                {s.tautan && (
                  <a href={s.tautan} target="_blank" rel="noreferrer"
                    title="Chart milik sumbernya"
                    className="flex cursor-pointer items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[10.5px] text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300">
                    <ExternalLink className="size-3" /> sumber
                  </a>
                )}
                <span className="ml-auto truncate text-[10px] text-zinc-600">{s.sumber}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Peringatan ditempel PADA panelnya, bukan diserahkan ke halaman Legal.
          Inilah satu-satunya tempat di aplikasi yang menampilkan pair, arah,
          entry, SL, dan TP sekaligus — bentuk yang paling mudah dibaca orang
          sebagai "beli sekarang di harga ini". Kalimat penyeimbangnya harus
          berada di layar yang sama, saat itu juga; disclaimer yang menunggu
          diklik di pojok bawah tidak pernah sampai ke orang yang sedang
          bersiap menekan Buka di Chart. */}
      <div className="border-t border-zinc-800/80 px-5 py-3">
        <p className="text-[11px] leading-relaxed text-zinc-600">
          Keluaran algoritma dari data harga publik — <span className="text-zinc-500">bukan rekomendasi
          beli atau jual</span>. Periksa ulang sebelum eksekusi; seluruh risiko dan keputusan ada padamu.{' '}
          <Link to="/legal" className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-400">
            Disclaimer
          </Link>
        </p>
      </div>
    </Panel>
  );
}
