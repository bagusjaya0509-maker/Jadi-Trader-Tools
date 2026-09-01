import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ChevronDown, EyeOff, FolderInput, GripHorizontal, Loader2, PenLine,
  RefreshCw, Trash2, Undo2, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  daftarChart, gambarChart, tandaiChart, hapusChart, jadikanSinyal, aktivitasChart,
  type ChartPantauan, type JejakAgen, type RuangAgen,
  bacaMata, simpanMata, bacaSekarang, type KeadaanMata,
} from '@/lib/chart-agen';

/* ════════════════════════════════════════════════════════════════════════
   PANEL CHART PANTAUAN — ruang kerja pemilik, bukan halaman publik
   ════════════════════════════════════════════════════════════════════════
   Agen menyimpan chart yang diposting di ruang pantauannya; di sini pemilik
   membacanya sendiri dan MENETAPKAN area entry-nya. Tidak ada satu pun
   angka di sini yang ditebak mesin.

   Chart-nya membawa tanda air sumbernya di dalam piksel, jadi panel ini
   tidak boleh bocor ke siapa pun. Gerbangnya di tiga lapis: rute server
   menolak selain uid pemilik, tab-nya tidak sah untuk selain pemilik, dan
   sidebar tidak menampilkannya. Yang menegakkan tetap yang pertama —
   dua sisanya cuma membuat pintunya tidak terlihat.
   ════════════════════════════════════════════════════════════════════════ */

/* ── PASANGAN DITEBAK DARI KETERANGANNYA ──────────────────────────────
   Supaya menekan "Jiplak di Chart & Entry" langsung mendarat di pair yang
   benar, bukan di simbol terakhir yang kebetulan terbuka lalu harus dicari
   sendiri. Bolak-balik itu yang dikeluhkan pemilik.

   Cocokkan DARI DAFTAR, bukan mengarang "<kata pertama> + USDT". Keterangan
   di ruang itu ditulis manusia dengan nama panjang ("HYPERLIQUID", "Bitcoin",
   "Gold"), dan menempelkan USDT ke kata apa pun akan menghasilkan simbol
   yang tidak ada — chart lalu terbuka kosong tanpa memberi tahu kenapa.

   Tidak ketemu = tidak menyebut simbol sama sekali, dan Chart & Entry
   membuka apa yang sudah terbuka. Menebak salah lebih buruk daripada tidak
   menebak: yang satu diam, yang lain memindahkan orang ke pasar yang salah
   sambil terlihat yakin. */
/* BATAS KATA SAJA TIDAK CUKUP — SEBAGIAN TICKER WAJIB HURUF BESAR.
   ──────────────────────────────────────────────────────────────────────
   Dua kesalahan berturut-turut di sini, dan keduanya senyap.

   Pertama polanya kehilangan `\b` sewaktu ditulis ke berkas — yang tertulis
   malah karakter backspace sungguhan, jadi TIDAK SATU PUN pola pernah
   cocok dan semua chart jatuh ke "Lainnya". Tidak ada galat, cuma
   pengelompokan yang diam-diam tidak pernah terjadi.

   Sesudah `\b` dikembalikan, muncul kesalahan kedua yang batas kata justru
   tidak bisa tolong: TICKER PENDEK YANG SAMA PERSIS DENGAN KATA INDONESIA.
   "tidak ADA sinyal" bukan Cardano. "harga SUdah" bukan Sui. "LINK grup"
   bukan Chainlink. `\bada\b` mencocokkannya dengan benar — memang itu kata
   utuh — dan justru karena itu ia salah.

   Jalan keluarnya bukan pola yang lebih pintar, melainkan pengamatan
   sederhana: di ruang itu ticker SELALU ditulis huruf besar ("ENA daily",
   "PUMP 1 jam", "HYPERLIQUID 1 JAM"), sementara kata biasa tidak. Jadi
   ticker yang bertabrakan kehilangan bendera `i`-nya; nama panjang yang
   tidak mungkin salah tangkap (bitcoin, solana, cardano) tetap longgar.

   Kalau suatu hari ada keterangan yang menulis "ena" huruf kecil, ia jatuh
   ke "Lainnya" — dan itu kegagalan yang benar: satu chart perlu
   dikelompokkan tangan, bukan sepuluh chart masuk koin yang salah. */
const KAMUS_PASANGAN: [RegExp, string][] = [
  /* Longgar — nama panjang, tidak bersarang di kata Indonesia mana pun. */
  [/\bxau|\bgold\b|\bemas\b/i, 'XAUUSD'],
  [/\bbtc\b|\bbitcoin\b/i, 'BTCUSDT'],
  [/\bethereum\b/i, 'ETHUSDT'],
  [/\bsolana\b/i, 'SOLUSDT'],
  [/\bhyperliquid\b/i, 'HYPEUSDT'],
  [/\bethena\b/i, 'ENAUSDT'],
  [/\bvirtual\b/i, 'VIRTUALUSDT'],
  [/\bcardano\b/i, 'ADAUSDT'],
  [/\bripple\b/i, 'XRPUSDT'],
  [/\bzcash\b/i, 'ZECUSDT'],
  [/\bdoge\b/i, 'DOGEUSDT'],
  [/\bavax\b/i, 'AVAXUSDT'],
  [/\bbnb\b/i, 'BNBUSDT'],
  [/\bxrp\b/i, 'XRPUSDT'],

  /* KETAT — huruf besar saja. Lihat catatan di atas. */
  [/\bETH\b/, 'ETHUSDT'],
  [/\bSOL\b/, 'SOLUSDT'],
  [/\bHYPE\b/, 'HYPEUSDT'],
  [/\bENA\b/, 'ENAUSDT'],
  [/\bPUMP\b/, 'PUMPUSDT'],
  [/\bADA\b/, 'ADAUSDT'],
  [/\bLINK\b/, 'LINKUSDT'],
  [/\bSUI\b/, 'SUIUSDT'],
  /* Ditulis "Zec" di ruang sumbernya — huruf besar cuma di depan,
     jadi pola ketat huruf-besar-semua tidak menangkapnya dan chartnya
     jatuh ke "Belum terbaca". Diberi bendera `i` sendiri karena "zec"
     tidak bersarang di kata Indonesia mana pun.

     KEMBARAN dari tabel yang sama di skrip/vps/pasangan-chart.js.
     Server harus bisa menebak pasangannya SENDIRI sebelum
     membunyikan lonceng, karena isi pesannya tidak pernah boleh ikut
     keluar ke /api/kabar yang terbuka. Ubah keduanya bersamaan. */
  [/\bzec\b/i, 'ZECUSDT'],
];

export function tebakPasangan(keterangan: string): string | null {
  const t = String(keterangan || '');
  for (const [pola, simbol] of KAMUS_PASANGAN) if (pola.test(t)) return simbol;
  return null;
}

function umur(t: number) {
  const d = Math.max(0, Date.now() - t);
  const m = Math.round(d / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return m + ' menit lalu';
  const j = Math.round(m / 60);
  if (j < 24) return j + ' jam lalu';
  return Math.round(j / 24) + ' hari lalu';
}

/* ── JENDELA GAMBAR — mengambang, bisa diseret ──────────────────────────
   Dulu gambarnya dibuka di TAB BARU. Bekerja, tapi salah untuk pekerjaan
   ini: menetapkan area entry menuntut melihat chart-nya SAMBIL mengetik
   angkanya, dan tab baru justru memindahkan orangnya menjauh dari kotak
   isian yang mau ia isi. Bolak-balik tab untuk satu angka.

   Jendela mengambang menyelesaikan keduanya: gambarnya besar, panelnya
   tetap di belakang, dan kalau ia menutupi kotak yang mau diisi — geser
   saja.

   ── TANPA LATAR GELAP, DAN ITU DISENGAJA ────────────────────────────────
   Jendela ini BUKAN modal. Latar gelap yang menutup halaman menyatakan
   "urus ini dulu, yang lain menunggu" — padahal yang dikerjakan orangnya
   justru membandingkan gambar ini DENGAN panel di belakangnya. Menggelapkan
   yang dibandingkan mengalahkan tujuannya.

   Karena itu pula ia tidak mengunci gulir dan tidak menangkap klik di luar
   dirinya: dua jendela boleh terbuka sekaligus untuk membandingkan dua
   chart, dan panel di belakangnya tetap bisa dipakai.

   DIPORTALKAN KE BODY. Panel induknya punya overflow dan tumpukan sendiri;
   jendela yang lahir di dalamnya akan terpotong tepat saat diseret keluar
   batas panel — dan terpotongnya baru terlihat sesudah diseret. */
function JendelaGambar({ url, judul, tutup }: { url: string; judul: string; tutup: () => void }) {
  /* Mulai di tengah layar, sedikit ke atas: gambar chart lebih lebar
     daripada tinggi, dan titik tengah sejati membuat kaki jendelanya
     menggantung di bawah lipatan pada layar pendek. */
  const [pos, setPos] = useState(() => ({
    x: Math.max(12, (window.innerWidth - Math.min(920, window.innerWidth - 40)) / 2),
    y: Math.max(12, window.innerHeight * 0.08),
  }));
  const seret = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') tutup(); };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [tutup]);

  return createPortal(
    <div className="fixed z-[70] w-[min(920px,calc(100vw-24px))] overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl"
         style={{ left: pos.x, top: pos.y }}>
      {/* Bilah judul = gagang seret. Seluruh jendela bisa saja dibuat
          menyeret, tapi gambarnya perlu tetap bisa disorot dan disalin —
          dan bidang seret yang menelan seluruh isi membuat setiap klik di
          gambar menggeser jendelanya sedikit. */}
      <div
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          seret.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
        }}
        onPointerMove={(e) => {
          const d = seret.current;
          if (!d) return;
          /* DIJEPIT ke dalam layar, dan yang dijepit tepi KIRI-ATAS-nya
             saja: jendela yang boleh keluar sepenuhnya bisa hilang tanpa
             cara memanggilnya kembali, sementara menjepit keempat sisinya
             membuat jendela yang lebih besar dari layar tidak bisa digeser
             untuk melihat bagian bawahnya. */
          setPos({
            x: Math.min(Math.max(-40, e.clientX - d.dx), window.innerWidth - 120),
            y: Math.min(Math.max(0, e.clientY - d.dy), window.innerHeight - 44),
          });
        }}
        onPointerUp={() => { seret.current = null; }}
        className="flex cursor-move touch-none items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2">
        <GripHorizontal className="size-3.5 shrink-0 text-zinc-600" />
        <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-300">{judul}</span>
        <button onClick={tutup} title="Tutup (Esc)"
          className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:text-zinc-100">
          <X className="size-4" />
        </button>
      </div>
      {/* Tinggi dibatasi tinggi layar supaya chart yang sangat jangkung
          tetap muat utuh; sisanya digulir di dalam jendelanya sendiri. */}
      <div className="max-h-[78vh] overflow-auto bg-zinc-950">
        <img src={url} alt={judul} className="w-full select-none" draggable={false} />
      </div>
    </div>,
    document.body,
  );
}

/* ── Gambar bertoken ────────────────────────────────────────────────────
   Dipisah jadi komponennya sendiri supaya object URL-nya punya siklus hidup
   yang sama persis dengan yang menampilkannya. Ditaruh di induknya, satu
   chart yang dibuang akan meninggalkan URL-nya hidup tanpa ada yang
   bertanggung jawab melepasnya. */
function GambarChart({ id, alt }: { id: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [gagal, setGagal] = useState(false);
  /* Jendelanya dipegang DI SINI, bukan di induknya: object URL-nya lahir
     dan mati di komponen ini, dan jendela yang hidup di tempat lain bisa
     memegang URL yang sudah dicabut. */
  const [buka, setBuka] = useState(false);

  useEffect(() => {
    let hidup = true;
    let dipakai: string | null = null;
    void gambarChart(id).then((u) => {
      if (!hidup) { if (u) URL.revokeObjectURL(u); return; }
      if (!u) { setGagal(true); return; }
      dipakai = u;
      setUrl(u);
    });
    return () => {
      hidup = false;
      if (dipakai) URL.revokeObjectURL(dipakai);
    };
  }, [id]);

  if (gagal) {
    return (
      <div className="flex h-40 items-center justify-center border-b border-zinc-800 bg-zinc-900/60 text-[12px] text-zinc-500">
        Gambarnya tidak bisa diambil.
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex h-40 items-center justify-center border-b border-zinc-800 bg-zinc-900/60">
        <Loader2 className="size-4 animate-spin text-zinc-600" />
      </div>
    );
  }
  return (
    <>
      {/* Tombol, bukan tautan: yang terjadi bukan berpindah tempat melainkan
          membuka jendela di halaman yang sama. Tautan yang tidak menautkan ke
          mana pun membohongi menu klik-kanan dan penunjuk status peramban. */}
      <button type="button" onClick={() => setBuka(true)}
        title="Buka besar — jendelanya bisa digeser"
        className="block w-full cursor-zoom-in">
        {/* TANPA border & sudut membulat sendiri. Kartunya sekarang yang
            memotong sudutnya (overflow-hidden), dan gambar yang membawa
            bingkainya sendiri di dalam kartu berbingkai menghasilkan dua
            garis sejajar berjarak satu piksel. */}
        {/* loading="lazy" sejak arsipnya 59 chart, bukan 13. Semua sekaligus
            berarti hampir lima megabita tiap kali halaman ini dibuka, dan
            yang membukanya sering menumpang tethering. Yang di luar layar
            menunggu sampai digulir ke sana. */}
        <img src={url} alt={alt} loading="lazy" decoding="async"
             className="w-full transition-opacity hover:opacity-90" />
      </button>
      {buka && <JendelaGambar url={url} judul={alt} tutup={() => setBuka(false)} />}
    </>
  );
}

/* ── Formulir level ─────────────────────────────────────────────────────
   Kosong, selalu. Tidak ada prasetel dari gambarnya — itu inti keputusannya:
   angka yang muncul sendiri di kotak isian akan diterima apa adanya oleh
   siapa pun yang sedang buru-buru, dan angka hasil tebakan mesin yang
   diterima tanpa diperiksa persis sama bahayanya dengan angka karangan. */
function FormLevel({ chart, selesai }: { chart: ChartPantauan; selesai: () => void }) {
  const [pasangan, setPasangan] = useState('');
  const [arah, setArah] = useState<'BUY' | 'SELL'>('BUY');
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [tf, setTf] = useState('1h');
  const [alasan, setAlasan] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  /* Titik ATAU koma diterima. Papan angka ponsel di Indonesia memberi koma
     sebagai pemisah desimal, dan Number('0,16') itu NaN — kotak yang
     menolak angka yang baru saja diketik orangnya tanpa mengatakan kenapa
     adalah kegagalan yang paling menjengkelkan. */
  const angka = (x: string) => Number(String(x).trim().replace(',', '.'));

  async function kirim() {
    setGalat('');
    const e = angka(entry); const s = angka(sl); const t = angka(tp);
    if (!pasangan.trim()) return setGalat('Pasangannya belum diisi.');
    if (!(e > 0) || !(s > 0) || !(t > 0)) return setGalat('Entry, SL, dan TP harus angka lebih dari nol.');
    setSibuk(true);
    const h = await jadikanSinyal(chart.id, {
      pasangan: pasangan.trim().toUpperCase(), arah, entry: e, sl: s, tp: t, tf,
      alasan: alasan.trim() || undefined,
    });
    setSibuk(false);
    if (h.ok) selesai();
    else setGalat(h.pesan);
  }

  const kotak = 'w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600';

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <input className={kotak} placeholder="Pasangan (BTCUSDT)" value={pasangan}
               onChange={(e) => setPasangan(e.target.value)} />
        <div className="flex overflow-hidden rounded-md border border-zinc-800">
          {(['BUY', 'SELL'] as const).map((a) => (
            <button key={a} onClick={() => setArah(a)}
              className={cn('flex-1 cursor-pointer py-1.5 text-[12px] font-semibold transition-colors',
                arah === a
                  ? a === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                  : 'text-zinc-500 hover:text-zinc-300')}>
              {a}
            </button>
          ))}
        </div>
        <input className={kotak} placeholder="TF (1h)" value={tf}
               onChange={(e) => setTf(e.target.value)} />
        <input className={kotak} placeholder="Entry" inputMode="decimal" value={entry}
               onChange={(e) => setEntry(e.target.value)} />
        <input className={kotak} placeholder="SL" inputMode="decimal" value={sl}
               onChange={(e) => setSl(e.target.value)} />
        <input className={kotak} placeholder="TP" inputMode="decimal" value={tp}
               onChange={(e) => setTp(e.target.value)} />
      </div>
      <textarea className={cn(kotak, 'min-h-[52px] resize-y')} value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="Catatan yang ikut terbit di kartu (opsional)" />
      {galat && <p className="text-[12px] text-red-400">{galat}</p>}
      <div className="flex items-center gap-2">
        <button onClick={() => void kirim()} disabled={sibuk}
          className="cursor-pointer rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-default disabled:opacity-60">
          {sibuk ? 'Menerbitkan…' : 'Terbitkan sebagai sinyal'}
        </button>
        <span className="text-[11px] text-zinc-500">Kartunya terbit atas nama {chart.agen}.</span>
      </div>
    </div>
  );
}

/* ── FORMULIR LEVEL DIPADAMKAN ──────────────────────────────────────────
   Keputusan pemilik: tombol "Tetapkan area entry" tidak terpakai — level
   ditetapkan langsung di Chart & Entry sesudah menjiplak, bukan diketik dari
   panel ini.

   KODENYA SENGAJA TIDAK DIHAPUS. Rute servernya masih hidup
   (/api/agen/chart/:id/sinyal, lengkap dengan pemeriksaan sisi SL/TP dan
   penerbitan kartu atas nama agennya), dan formulir ini satu-satunya
   pemakainya. Membuangnya berarti mengerjakan ulang keduanya kalau suatu
   hari jalur itu diperlukan lagi.

   Ubah ke `true` untuk menampilkannya kembali — tombol dan formulirnya
   muncul bersamaan. */
const FORM_LEVEL_TAMPIL = false;


/* ── SAKLAR AI PEMBACA CHART ────────────────────────────────────────────
   Diminta pemilik, dan alasannya soal uang: tiap gambar yang masuk ruang
   chart memanggil model penglihatan, satu per satu, sampai jatah hariannya
   habis. Ruang bisa ramai berhari-hari tanpa satu pun setup yang layak
   dibaca — dan selama itu ongkosnya tetap berjalan.

   Dua kendali, sengaja terpisah:

     · Hentikan  — berhenti TOTAL. Tidak ada panggilan model yang berangkat,
       dan gambarnya bahkan tidak diunduh dari Telegram.

     · Rentang tanggal — dipakai saat MENYALAKAN LAGI. Tanpa batas tanggal,
       menyalakan ulang berarti seluruh antrean yang menumpuk selama mati
       ikut dibaca sekaligus; itu kebalikan dari berhemat.

   Berdiri sendiri, tidak menumpang di bilah aktivitas: bilah itu
   menghilang saat pemantau belum pernah melapor, dan saklar yang lenyap
   justru pada saat orangnya ingin mematikan sesuatu adalah saklar yang
   tidak bisa dipercaya. */
function SaklarMata() {
  const [mata, setMata] = useState<KeadaanMata | null>(null);
  const [dari, setDari] = useState('');
  const [sampai, setSampai] = useState('');
  const [aturBuka, setAturBuka] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');
  const [membaca, setMembaca] = useState(false);
  const sidik = useRef('');

  const muat = useCallback(async () => {
    const d = await bacaMata();
    if (!d) return;
    setMata(d);
    /* Isian hanya disetel ulang kalau nilai SERVER berubah. Menyetelnya
       tiap tarikan akan menghapus tanggal yang sedang diketik orangnya —
       panel ini menarik ulang tiap dua menit, dan dua menit lebih pendek
       daripada waktu yang dibutuhkan untuk mengisi dua kolom tanggal. */
    const s = `${d.setelan.dari || ''}|${d.setelan.sampai || ''}|${d.setelan.diubah}`;
    if (s !== sidik.current) {
      sidik.current = s;
      setDari(d.setelan.dari || '');
      setSampai(d.setelan.sampai || '');
    }
  }, []);

  useEffect(() => {
    void muat();
    const t = setInterval(() => { void muat(); }, 120000);
    return () => clearInterval(t);
  }, [muat]);

  if (!mata) return null;

  const aktif = mata.setelan.aktif;
  /* Saklar panel menyala TIDAK sama dengan AI sedang bekerja. Ruang yang
     TG*_GAMBAR-nya nol tidak pernah menyuapi model, dan kalau semua ruang
     begitu maka saklar ini tidak mengubah apa pun sampai env-nya diubah.
     Keadaan itu punya tampilannya sendiri di bawah — bukan disamarkan
     jadi "menyala". */
  const adaPenyuap = mata.ruang.some((r) => r.gambar);
  const adaArsip = mata.ruang.some((r) => r.arsip);
  const bekerja = aktif && adaPenyuap;

  async function simpan(ubah: { aktif?: boolean; pakaiTanggal?: boolean }) {
    if (!mata) return;
    setSibuk(true); setKabar('');
    const h = await simpanMata({
      aktif: ubah.aktif ?? mata.setelan.aktif,
      dari: ubah.pakaiTanggal === false ? null : (dari || null),
      sampai: ubah.pakaiTanggal === false ? null : (sampai || null),
    });
    setSibuk(false);
    if (!h.ok) { setKabar(h.pesan); return; }
    sidik.current = '';
    await muat();
    setKabar(h.setelan.aktif ? 'Tersimpan — agen membaca lagi.' : 'Dihentikan. Tidak ada panggilan model yang berangkat.');
  }

  const adaRentang = !!(mata.setelan.dari || mata.setelan.sampai);

  return (
    <div className={cn('rounded-lg border', bekerja ? 'border-zinc-800 bg-zinc-900/40' : 'border-amber-500/30 bg-amber-500/5')}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2">
        <span aria-hidden className={cn('size-2 shrink-0 rounded-full', bekerja ? 'bg-emerald-400' : 'bg-amber-400')} />
        <span className="text-[12px] font-medium text-zinc-200">
          {!aktif ? 'AI baca chart DIHENTIKAN'
            : adaPenyuap ? 'AI baca chart menyala'
            : 'AI baca chart tidak menerima gambar'}
        </span>
        <span className="text-[11px] text-zinc-500">
          {!aktif ? 'tidak ada gambar yang dibaca, tidak ada token yang keluar'
            : adaPenyuap ? mata.jatah.pakai + ' dari ' + mata.jatah.harian + ' gambar hari ini'
            : 'tidak ada ruang yang menyuapinya — token tetap nol'}
        </span>
        {adaRentang && (
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10.5px] text-zinc-400">
            {mata.setelan.dari || '…'} → {mata.setelan.sampai || '…'}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button onClick={() => setAturBuka((v) => !v)} disabled={sibuk}
            className="cursor-pointer rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:cursor-default disabled:opacity-50">
            Rentang tanggal
          </button>
          {/* ── BACA SEKARANG ─────────────────────────────────────
              Inti dari seluruh permintaan pemilik: AI tidak pernah jalan
              sendiri, ia berangkat saat tombol ini ditekan. Membaca dari
              ARSIP di disk, bukan dari Telegram — jadi ia tetap bekerja
              walau pemantau Telegram sedang mati, dan tetap menghormati
              rentang tanggal yang sedang terpasang.

              Sengaja ditaruh SEBELUM tombol Hentikan/Nyalakan: ini yang
              paling sering ditekan, dan yang paling sering ditekan pantas
              duduk lebih dulu di jalur baca kiri-ke-kanan. */}
          <button onClick={async () => {
              setMembaca(true); setKabar('');
              const h = await bacaSekarang({ dari: dari || null, sampai: sampai || null });
              setMembaca(false);
              setKabar(h.ok ? h.pesan + (h.sisaAntre ? ' Masih ada ' + h.sisaAntre + ' menunggu — tekan lagi.' : '')
                            : h.pesan);
              sidik.current = '';
              await muat();
            }} disabled={membaca || sibuk}
            title="Suruh AI membaca chart arsip sekarang, sekali jalan"
            className="cursor-pointer rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-default disabled:opacity-50">
            {membaca ? 'Membaca…' : 'Baca sekarang'}
          </button>
          <button onClick={() => void simpan({ aktif: !aktif })} disabled={sibuk || membaca}
            className={cn('cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-default disabled:opacity-60',
              aktif ? 'bg-zinc-100 text-zinc-950 hover:bg-white'
                    : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400')}>
            {sibuk ? 'Menyimpan…' : aktif ? 'Hentikan' : 'Nyalakan'}
          </button>
        </div>
      </div>

      {aturBuka && (
        <div className="border-t border-zinc-800/70 px-3 py-2.5">
          <p className="mb-2 text-[11.5px] leading-relaxed text-zinc-500">
            Hanya chart yang diposting dalam rentang ini yang dibaca AI. Tanggal
            memakai WIB dan keduanya ikut terhitung. Kosongkan salah satunya untuk
            membiarkan sisi itu tanpa batas — kosong dua-duanya berarti semua
            tanggal dibaca.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[130px] flex-1">
              <span className="mb-1 block text-[10.5px] uppercase tracking-wide text-zinc-600">Dari tanggal</span>
              <input type="date" value={dari} onChange={(e) => setDari(e.target.value)}
                className="angka h-8 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-[12px] text-zinc-200 outline-none focus-visible:border-zinc-600" />
            </label>
            <label className="min-w-[130px] flex-1">
              <span className="mb-1 block text-[10.5px] uppercase tracking-wide text-zinc-600">Sampai tanggal</span>
              <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)}
                className="angka h-8 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-[12px] text-zinc-200 outline-none focus-visible:border-zinc-600" />
            </label>
            <button onClick={() => void simpan({})} disabled={sibuk}
              className="h-8 cursor-pointer rounded-md bg-zinc-100 px-3 text-[11.5px] font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-default disabled:opacity-60">
              Simpan
            </button>
            <button onClick={() => { setDari(''); setSampai(''); void simpan({ pakaiTanggal: false }); }}
              disabled={sibuk || !adaRentang}
              className="h-8 cursor-pointer rounded-md border border-zinc-800 px-2.5 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:cursor-default disabled:opacity-40">
              Hapus batas
            </button>
          </div>
        </div>
      )}

      {/* ── KENAPA SAKLAR HIJAU PUN BISA TIDAK MEMBACA ────────────────
          Dijelaskan di layar, bukan dibiarkan jadi teka-teki. Yang paling
          membingungkan dari dua gerbang berlapis adalah saat yang satu
          hijau dan yang lain merah tanpa keduanya terlihat bersamaan. */}
      {aktif && !adaPenyuap && (
        <p className="border-t border-zinc-800/70 px-3 py-2 text-[11.5px] leading-relaxed text-zinc-400">
          Saklar ini menyala, tapi tidak ada ruang Telegram yang menyerahkan
          gambarnya ke AI — <span className="angka text-zinc-300">TG*_GAMBAR</span> di
          .env VPS bernilai 0 untuk semua ruang. Selama begitu, tidak ada
          panggilan model yang berangkat berapa pun setelan di sini.
          {adaArsip && ' Chart-nya tetap diarsipkan ke rak di bawah — pengarsipan tidak memakai token sama sekali.'}
        </p>
      )}

      {mata.ruang.length > 0 && (
        <div className="border-t border-zinc-800/70 px-3 py-1.5">
          {mata.ruang.map((r) => (
            <p key={r.awalan} className="text-[10.5px] text-zinc-600">
              <span className="text-zinc-400">{r.agen}</span>
              {' · '}dibaca AI: <span className={r.gambar ? 'text-emerald-400' : 'text-zinc-500'}>
                {r.gambar ? 'ya' : 'tidak'}</span>
              {' · '}diarsipkan: <span className={r.arsip ? 'text-emerald-400' : 'text-zinc-500'}>
                {r.arsip ? 'ya' : 'tidak'}</span>
            </p>
          ))}
        </div>
      )}

      {kabar && (
        <p className="border-t border-zinc-800/70 px-3 py-1.5 text-[11.5px] text-zinc-400">{kabar}</p>
      )}
    </div>
  );
}

/* ── BILAH AKTIVITAS AGEN ───────────────────────────────────────────────
   Rak chart yang tidak bertambah punya DUA sebab yang terlihat sama persis:
   agennya mati, atau ruangnya memang sepi. Tanpa bilah ini satu-satunya
   cara membedakannya adalah masuk ke VPS dan membaca log pm2.

   Denyutnya yang menjawab "hidup?" — pemantau menuliskannya tiap jam, jadi
   apa pun yang lebih tua dari dua jam berarti ia berhenti melapor. Dua jam,
   bukan satu: satu denyut yang terlewat karena restart atau jaringan
   berkedip adalah kejadian biasa, dan alarm yang berbunyi untuk kejadian
   biasa adalah alarm yang dimatikan orang. */
function BilahAktivitas() {
  const [data, setData] = useState<{ log: JejakAgen[]; ruang: RuangAgen[] } | null>(null);
  const [buka, setBuka] = useState(false);

  useEffect(() => {
    let hidup = true;
    const tarik = () => { void aktivitasChart().then((d) => { if (hidup && d) setData(d); }); };
    tarik();
    const t = setInterval(tarik, 120000);
    return () => { hidup = false; clearInterval(t); };
  }, []);

  if (!data || !data.ruang.length) return null;

  const BATAS_DENYUT = 2 * 60 * 60 * 1000;
  const sehat = data.ruang.every((r) => r.terhubung && Date.now() - r.denyut < BATAS_DENYUT);
  const denyutTua = Math.min(...data.ruang.map((r) => r.denyut));
  /* Yang ditolak saringan dihitung terpisah dan ditulis di bilah utamanya,
     bukan disembunyikan di dalam daftar: satu pun penolakan berarti ada
     postingan yang TIDAK sampai, dan itu kabar yang tidak boleh menunggu
     seseorang membuka daftar dulu. */
  const ditolak = data.log.filter((l) => l.jenis === 'lewat').length;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      <button onClick={() => setBuka((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left">
        <span aria-hidden className={cn('size-2 shrink-0 rounded-full',
          sehat ? 'bg-emerald-400' : 'bg-amber-400')} />
        <span className="text-[12px] font-medium text-zinc-200">
          {sehat ? 'Agen berjalan' : 'Agen tidak melapor'}
        </span>
        <span className="min-w-0 truncate text-[11px] text-zinc-500">
          {data.ruang.map((r) => r.agen).join(', ')} · denyut {umur(denyutTua)}
        </span>
        {ditolak > 0 && (
          <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-300">
            {ditolak} ditolak saringan
          </span>
        )}
        <ChevronDown className={cn('ml-auto size-3.5 shrink-0 text-zinc-500 transition-transform',
          buka && 'rotate-180')} />
      </button>

      {buka && (
        <div className="border-t border-zinc-800 px-3 py-2">
          <div className="mb-2 space-y-1">
            {data.ruang.map((r) => (
              <p key={r.agen} className="text-[11px] text-zinc-500">
                <span className="text-zinc-300">{r.agen}</span> · {r.judul} · topik {r.topik ?? '—'}
                {' · '}{r.admin} admin · denyut {umur(r.denyut)}
                {!r.terhubung && <span className="text-amber-400"> · SAMBUNGAN PUTUS</span>}
              </p>
            ))}
          </div>

          {data.log.length === 0 ? (
            <p className="py-2 text-[11.5px] text-zinc-600">
              Belum ada kejadian sejak pemantau menyala. Rak yang kosong berarti
              ruangnya memang sepi, bukan agennya berhenti.
            </p>
          ) : (
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {data.log.map((l, i) => (
                <div key={l.waktu + '-' + i} className="flex items-baseline gap-2 py-0.5">
                  <span className={cn('shrink-0 text-[10px] font-medium uppercase tracking-wide',
                    l.jenis === 'simpan' ? 'text-emerald-400'
                      : l.jenis === 'lewat' ? 'text-amber-400' : 'text-zinc-500')}>
                    {l.jenis === 'simpan' ? 'simpan' : l.jenis === 'lewat' ? 'ditolak' : 'nyala'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-zinc-400">{l.pesan}</span>
                  <span className="shrink-0 text-[10.5px] tabular-nums text-zinc-600">{umur(l.waktu)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PanelChartAgen() {
  const [chart, setChart] = useState<ChartPantauan[] | null>(null);
  const [gagal, setGagal] = useState(false);
  const [semua, setSemua] = useState(false);
  const [buka, setBuka] = useState<string | null>(null);
  const [muat, setMuat] = useState(true);
  const pertama = useRef(true);

  const tarik = useCallback(async (tampilkanMuat = false) => {
    if (tampilkanMuat) setMuat(true);
    const d = await daftarChart(semua);
    /* null = tidak bisa bertanya. Daftar lama DIPERTAHANKAN, tidak
       dikosongkan: satu tarikan yang gagal saat jaringan berkedip tidak
       berarti arsipnya kosong, dan mengosongkan layar karenanya membuat
       pemiliknya mengira chart-nya hilang. */
    if (d) { setChart(d); setGagal(false); } else setGagal(true);
    setMuat(false);
  }, [semua]);

  useEffect(() => {
    void tarik(pertama.current);
    pertama.current = false;
    /* Ditarik ulang tiap dua menit. Chart datang beberapa kali sehari, jadi
       lebih rapat dari ini cuma menambah permintaan tanpa menambah kabar. */
    const t = setInterval(() => { void tarik(); }, 120000);
    return () => clearInterval(t);
  }, [tarik]);

  async function sembunyikan(c: ChartPantauan) {
    setChart((d) => (d || []).map((x) => (x.id === c.id ? { ...x, sembunyi: !x.sembunyi } : x)));
    await tandaiChart(c.id, { sembunyi: !c.sembunyi });
    void tarik();
  }

  async function buang(c: ChartPantauan) {
    setChart((d) => (d || []).filter((x) => x.id !== c.id));
    await hapusChart(c.id);
    void tarik();
  }

  if (muat) {
    return (
      <div className="flex items-center gap-2 py-10 text-[13px] text-zinc-500">
        <Loader2 className="size-4 animate-spin" /> Mengambil chart…
      </div>
    );
  }

  const daftar = chart || [];

  /* ── DIKELOMPOKKAN PER KOIN, TERBARU DI ATAS ────────────────────────
     Satu koin sering punya dua-tiga chart pembaruan berturut-turut, dan
     dalam satu rak panjang mereka terserak di antara koin lain — jadi
     membandingkan "yang mana yang terakhir" butuh menyapu seluruh halaman.

     Diurutkan dari `waktu`, BUKAN dari urutan berkasnya. Pengisi awal
     menelusuri Telegram dari yang terbaru sambil memakai unshift, jadi
     yang tertua justru berakhir paling depan di berkas — dan mengandalkan
     urutan simpan berarti tampilan ikut salah tiap kali arsipnya diisi
     ulang. Waktu pesan tidak bisa berbohong begitu.

     Seksi juga diurutkan dari isi TERBARUNYA, bukan menurut abjad: yang
     baru saja diperbarui memang yang paling ingin dilihat, dan daftar
     berabjad menaruh koin yang diam berbulan-bulan di atas hanya karena
     namanya dimulai huruf A. */
  /* ── RAK "BARU" DI PALING ATAS ──────────────────────────────────────
     Chart yang baru diambil agen berkumpul di satu rak paling atas, apa pun
     koinnya, sampai pemilik memindahkannya. Alasannya bukan kerapian:
     dikelompokkan langsung per koin, chart baru akan terselip di tengah
     seksi yang isinya sudah belasan — dan yang baru datang adalah justru
     yang paling perlu dilihat.

     `terpilah === false` yang masuk rak ini, BUKAN "tidak terpilah".
     Arsip lama tidak membawa medan itu sama sekali, dan menganggap
     "tidak ada" berarti belum-dipilah akan menumpahkan seluruh arsip ke
     rak Baru sekaligus. */
  const seksi = (() => {
    const urut = [...daftar].sort((a, b) => b.waktu - a.waktu);
    const baru = urut.filter((c) => c.terpilah === false);
    const sisa = urut.filter((c) => c.terpilah !== false);

    const peta = new Map<string, ChartPantauan[]>();
    for (const c of sisa) {
      const kunci = tebakPasangan(c.keterangan) || 'Lainnya';
      const isi = peta.get(kunci);
      if (isi) isi.push(c); else peta.set(kunci, [c]);
    }
    const koin = [...peta.entries()]
      .map(([nama, isi]) => ({ nama, isi, baru: false }))
      .sort((a, b) => {
        /* "Lainnya" selalu paling bawah: isinya chart yang pasangannya
           tidak terbaca, dan itu keranjang sisa — bukan koin yang kebetulan
           paling baru. */
        if (a.nama === 'Lainnya') return 1;
        if (b.nama === 'Lainnya') return -1;
        return b.isi[0].waktu - a.isi[0].waktu;
      });

    return baru.length ? [{ nama: 'Baru masuk', isi: baru, baru: true }, ...koin] : koin;
  })();

  /* Memindahkan satu chart ke seksi koinnya. Layarnya berubah SEKETIKA
     (tanpa menunggu server) supaya kartunya terlihat berpindah tepat saat
     ditekan; tarikan sesudahnya yang menyamakan dengan keadaan server. */
  async function pilah(c: ChartPantauan) {
    setChart((d) => (d || []).map((x) => (x.id === c.id ? { ...x, terpilah: true } : x)));
    await tandaiChart(c.id, { terpilah: true });
    void tarik();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Nama agennya TIDAK diulang di sini — kepala kanal di atas sudah
            menyebutnya. Yang perlu dijelaskan cuma satu hal yang tidak
            terlihat dari mana pun: bahwa isi tab ini tidak tampil ke siapa
            pun selain dirinya, sampai ia sendiri menerbitkannya. */}
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-zinc-100">Ruang penyaringan</h2>
          <p className="mt-0.5 text-[12.5px] text-zinc-500">
            Chart yang diambil agen, tersimpan apa adanya dan hanya terlihat
            oleh Anda. Tetapkan sendiri zona, SL, dan TP-nya — baru setelah
            diterbitkan ia tampil di publik sebagai sinyal kartu ini.
          </p>
        </div>
        <button onClick={() => setSemua((v) => !v)}
          className="cursor-pointer rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:text-zinc-100">
          {semua ? 'Sembunyikan yang selesai' : 'Tampilkan semua'}
        </button>
        <button onClick={() => void tarik(true)} title="Muat ulang"
          className="cursor-pointer rounded-md border border-zinc-800 p-1.5 text-zinc-400 transition-colors hover:text-zinc-100">
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      <SaklarMata />
      <BilahAktivitas />

      {gagal && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12.5px] text-amber-300">
          Server tidak menjawab — yang tampil di bawah bacaan terakhir yang berhasil.
        </p>
      )}

      {daftar.length === 0 && !gagal && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-10 text-center">
          <p className="text-[13px] text-zinc-400">Belum ada chart yang menunggu.</p>
          <p className="mt-1 text-[12px] text-zinc-600">
            Chart baru dari ruang pantauan muncul di sini sendiri, tanpa perlu dimuat ulang.
          </p>
        </div>
      )}

      {seksi.map((sk) => (
        <section key={sk.nama} className="pb-2">
          {/* Kepala seksi MENEMPEL saat digulir dan punya GARIS yang jelas.
              Versi pertama cuma menebalkan namanya, dan di layar penuh
              kartu gelap yang seragam itu tenggelam — dari jauh raknya
              terbaca sebagai satu deretan panjang lagi, persis keluhan yang
              mau diselesaikan.

              Garisnya melintang penuh, bukan cuma di bawah tulisannya:
              yang perlu ditandai batas antar KELOMPOK, dan garis sepanjang
              tulisan cuma menghias judulnya. */}
          <div className={cn('sticky top-0 z-10 -mx-1 mb-3 border-b bg-zinc-950/95 px-1 pb-1.5 pt-2 backdrop-blur-sm',
            sk.baru ? 'border-amber-500/40' : 'border-zinc-700')}>
            <div className="flex items-baseline gap-2">
              <span aria-hidden className={cn('h-3.5 w-[3px] shrink-0 self-center rounded-full',
                sk.baru ? 'bg-amber-400' : 'bg-violet-400/80')} />
              <h3 className={cn('text-[13.5px] font-semibold tracking-tight',
                sk.baru ? 'text-amber-300' : 'text-zinc-100')}>{sk.nama}</h3>
              <span className="text-[11px] text-zinc-500">
                {sk.isi.length} chart · terbaru {umur(sk.isi[0].waktu)}
              </span>
              {sk.baru && (
                <span className="ml-auto text-[10.5px] text-zinc-600">
                  Pindahkan ke seksi koinnya setelah dilihat
                </span>
              )}
            </div>
          </div>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,26rem),1fr))]">
            {sk.isi.map((c) => (
              <div key={c.id}
                /* TANPA PADDING di pembungkusnya. Gambarnya menyentuh tepi
                   kiri, kanan, dan atas kartu; yang berpadding cuma bagian
                   teks di bawahnya. overflow-hidden yang membuat sudut
                   gambarnya ikut membulat mengikuti kartunya. */
                className={cn('overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 transition-opacity',
                  c.sembunyi && 'opacity-55')}>
                {/* NAMA KOIN TIDAK DIULANG DI SINI.
                    ─────────────────────────────────────────────────────
                    Kepala seksi di atasnya sudah menyebutnya, dan tiap kartu
                    di dalam seksi itu memang koin yang sama — mengulangnya
                    di setiap kartu berarti tiga baris identik berturut-turut
                    yang tidak menjawab pertanyaan apa pun. Yang membedakan
                    kartu-kartu dalam satu seksi keterangan dan waktunya. */}
                {/* Nama koin muncul HANYA di rak Baru. Di seksi koin ia
                    diulang dari kepala seksinya dan tidak menjawab apa pun;
                    di rak Baru isinya campur, jadi justru itu yang pertama
                    perlu diketahui — "grafik apa yang barusan masuk". */}
                {sk.baru && (
                  <div className="flex items-baseline gap-2 px-3 pb-2 pt-2.5">
                    <p className="min-w-0 truncate text-[12.5px] font-semibold tracking-tight text-amber-300">
                      {tebakPasangan(c.keterangan) || 'Belum terbaca'}
                    </p>
                  </div>
                )}

                <GambarChart id={c.id} alt={c.keterangan || 'Chart pantauan'} />

                <div className="p-3">
                  {c.keterangan && (
                    <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-zinc-300">
                      {c.keterangan}
                    </p>
                  )}

                  {c.sinyalId && (
                    <p className="mt-2 text-[12px] text-emerald-400">Sudah diterbitkan sebagai sinyal.</p>
                  )}

                  {FORM_LEVEL_TAMPIL && buka === c.id && (
                    <FormLevel chart={c} selesai={() => { setBuka(null); void tarik(); }} />
                  )}

                  {/* Baris tindakan. Tetap digambar walau formulirnya terbuka
                      supaya menghapus atau menandai selesai tidak menuntut
                      menutup formulir dulu, dan ml-auto menahan ikonnya di
                      ujung kanan dalam kedua keadaan: letak tombol hapus yang
                      berpindah-pindah adalah tombol hapus yang cepat atau
                      lambat tersenggol. */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {FORM_LEVEL_TAMPIL && buka !== c.id && (
                      <button onClick={() => setBuka(c.id)}
                        className="cursor-pointer rounded-md border border-zinc-700 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100">
                        {c.sinyalId ? 'Terbitkan lagi' : 'Tetapkan area entry'}
                      </button>
                    )}
                    {/* Alamatnya membawa id chart-nya. Halaman Chart & Entry yang
                        mengambil gambarnya sendiri — bukan dioper lewat state
                        navigasi: alamat yang lengkap bisa disalin, dibuka di tab
                        baru, dan dimuat ulang tanpa kehilangan jiplakannya. */}
                    <Link to={`/chart-entry?jiplak=${encodeURIComponent(c.id)}`
                      + (tebakPasangan(c.keterangan) ? `&simbol=${tebakPasangan(c.keterangan)}` : '')}
                      title={tebakPasangan(c.keterangan)
                        ? `Buka ${tebakPasangan(c.keterangan)} dengan chart ini di sampingnya`
                        : 'Pasangannya tidak terbaca dari keterangan — chart yang sedang terbuka dipakai apa adanya'}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[12px] text-violet-300 transition-colors hover:border-violet-500/50 hover:text-violet-200">
                      <PenLine className="size-3.5" />
                      Jiplak di Chart &amp; Entry
                    </Link>

                    {sk.baru && (
                      <button onClick={() => void pilah(c)}
                        title="Pindahkan ke seksi koinnya"
                        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[12px] text-amber-300 transition-colors hover:border-amber-500/60 hover:text-amber-200">
                        <FolderInput className="size-3.5" />
                        Pindahkan ke section
                      </button>
                    )}

                    <span className="ml-auto flex shrink-0 items-center gap-0.5">
                      <button onClick={() => void sembunyikan(c)}
                        title={c.sembunyi ? 'Kembalikan ke daftar' : 'Tandai selesai'}
                        className="cursor-pointer rounded p-1.5 text-zinc-500 transition-colors hover:text-zinc-200">
                        {c.sembunyi ? <Undo2 className="size-3.5" /> : <EyeOff className="size-3.5" />}
                      </button>
                      <button onClick={() => void buang(c)} title="Hapus berikut gambarnya"
                        className="cursor-pointer rounded p-1.5 text-zinc-500 transition-colors hover:text-red-400">
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </div>

                  {/* Waktu di KAKI kartu, bukan di kepala. Ia keterangan
                      arsip — berguna saat membandingkan dua pembaruan koin
                      yang sama, tapi bukan hal pertama yang dicari mata saat
                      menyapu rak. Yang pertama gambarnya. */}
                  <p className="mt-2 text-[10.5px] tabular-nums text-zinc-600">
                    {umur(c.waktu)} · {c.kb} KB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}