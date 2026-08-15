import { useState } from 'react';
import { TrendingUp, TrendingDown, X, Check, Ban, CandlestickChart, Minus, Hourglass , Share2 , Copy } from 'lucide-react';
import { cn, uang, harga as fHarga } from '@/lib/utils';
import { METODE_TP, type MetodeTp } from '@/lib/order-nyata';

/* ════════════════════════════════════════════════════════════════════════
   TIKET ORDER DI POJOK CHART
   ════════════════════════════════════════════════════════════════════════
   Ditaruh di atas grafik, bukan di panel terpisah di bawahnya. Alasannya
   bukan kerapian: saat mengambil keputusan mata sedang di chart, dan
   memindahkan pandangan ke bawah layar untuk menekan tombol adalah tempat
   paling sering orang salah tekan arah.

   DUA LANGKAH, BUKAN SATU.
   ──────────────────────────────────────────────────────────────────────
   Menekan BUY tidak membuka posisi. Yang terjadi adalah tiga garis muncul
   di chart — entry, SL, TP — yang bisa digeser sampai letaknya benar, dan
   baru setelah "Kirim" ditekan ordernya berangkat.

   Satu klik yang langsung mengirim order dengan SL hasil tebakan rumus
   adalah cara tercepat memasang stop di tempat yang tidak pernah dipilih
   siapa pun. Level adalah keputusan; tombol hanya menjalankannya.
   ════════════════════════════════════════════════════════════════════════ */

export interface RencanaOrder { entry?: number; sl?: number; tp?: number }

const KELAS_ISIAN =
  'h-7 w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 text-[11px] text-zinc-100 ' +
  'outline-none transition-colors focus-visible:border-zinc-500';

const KUNCI_TUTUP = 'jt.pojokTutup';

/* ── Isian angka: bisa dikosongkan, bisa dinaik-turunkan ────────────────
   Model lama `value={n || ''} onChange={Number(v) || 0}` punya dua cacat
   yang keduanya terasa saat mengetik:

     · Lot 0.01 MUSTAHIL diketik. "0" dan "0." sama-sama bernilai 0, dan
       0 dirender sebagai string kosong — kolomnya membersihkan diri
       sendiri di tengah pengetikan, dan angka desimal tidak pernah
       sempat terbentuk.
     · Leverage TIDAK BISA dihapus. Kosong berarti Number('') = 0, yang
       jatuh ke `|| 1` — jadi begitu isinya dihapus, angka 1 muncul
       menggantikannya. Mengganti 10 jadi 20 berarti berkelahi dulu.

   Perbaikannya: teks MENTAH yang sedang diketik disimpan apa adanya
   selama kolomnya dipegang, dan angka hanya dikirim ke atas kalau
   teksnya memang angka yang sah. Kolom yang ditinggalkan dalam keadaan
   kosong kembali menampilkan nilai terakhirnya — bukan 0, bukan 1.

   Segitiga naik-turun menambah/mengurangi satu langkah; panah keyboard
   ↑↓ melakukan hal yang sama, karena tangan yang sudah di kolomnya tidak
   perlu pindah ke mouse. */
function Segitiga({ arah }: { arah: 'atas' | 'bawah' }) {
  return (
    <svg viewBox="0 0 8 5" className="h-[4px] w-2" aria-hidden="true">
      <polygon points={arah === 'atas' ? '4,0 8,5 0,5' : '4,5 8,0 0,0'} fill="currentColor" />
    </svg>
  );
}

function IsianAngka({ nilai, atur, langkah, min = 0, maks, desimal = 2, lebar, judul, mati }: {
  nilai: number;
  atur: (n: number) => void;
  langkah: number;
  min?: number;
  maks?: number;
  desimal?: number;
  lebar: string;
  judul: string;
  mati?: boolean;
}) {
  const [draf, setDraf] = useState<string | null>(null);
  const teks = draf ?? (nilai ? String(nilai) : '');

  const rapi = (n: number) => Number(n.toFixed(desimal));
  const jepit = (n: number) => Math.min(maks ?? Infinity, Math.max(min, n));

  function geser(arah: 1 | -1) {
    if (mati) return;
    const dasar = draf !== null && draf.trim() !== '' ? Number(draf) : nilai;
    const mulai = isFinite(dasar) ? dasar : min;
    setDraf(null);
    atur(jepit(rapi(mulai + arah * langkah)));
  }

  return (
    <label className="block">
      <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide text-zinc-500">{judul}</span>
      <div className={cn('relative', lebar)}>
        <input value={teks} inputMode="decimal" disabled={mati}
               onChange={(e) => {
                 const v = e.target.value;
                 setDraf(v);
                 /* Kosong TIDAK dikirim ke atas: nilai lama bertahan diam-diam
                    sampai ada angka baru — itulah yang membuat kolomnya bisa
                    dihapus total tanpa melompat ke 0 atau 1. */
                 if (v.trim() === '') return;
                 const n = Number(v);
                 if (isFinite(n) && n >= 0) atur(jepit(n));
               }}
               onBlur={() => setDraf(null)}
               onKeyDown={(e) => {
                 if (e.key === 'ArrowUp') { e.preventDefault(); geser(1); }
                 if (e.key === 'ArrowDown') { e.preventDefault(); geser(-1); }
               }}
               className={cn(KELAS_ISIAN, 'angka pr-4')} />
        <div className="absolute inset-y-0 right-0 flex w-4 flex-col justify-center">
          {([['atas', 1], ['bawah', -1]] as const).map(([arah, delta]) => (
            <button key={arah} type="button" tabIndex={-1} disabled={mati}
                    onClick={() => geser(delta)}
                    title={`${delta > 0 ? 'Tambah' : 'Kurangi'} ${langkah}`}
                    className="flex h-[13px] cursor-pointer items-center justify-center text-zinc-500 transition-colors hover:text-zinc-100 disabled:cursor-default disabled:opacity-40">
              <Segitiga arah={arah} />
            </button>
          ))}
        </div>
      </div>
    </label>
  );
}

export function PojokOrder({
  posisi, hargaKini, draf, rencana, mode, jenis, risiko, tunda, onBatalTunda, onKirimSinyal, kabarSinyal, dariSinyal,
  onPilih, onUbah, onKirim, onBatal, onTutup, onGantiMode, mati,
  nyataSetelan, aturNyata, sibukNyata, kabar, demoSetelan, aturDemo,
  catatan, aturCatatan, qtyDemo, mt5, lotMt5, aturLotMt5, nilaiLotMt5, desimalHarga = 6,
}: {
  posisi: { arah: 'BUY' | 'SELL'; masuk: number; sl: number; tp: number; pnl: number; risiko: number; unit: number } | null;
  hargaKini?: number;
  /** Label jenis order hasil letak garis entry: "Market", "Buy Limit", dst. */
  jenis?: string;
  /** Risiko dolar menurut setelan saat ini. */
  risiko?: number;
  /** Qty demo yang dibekukan saat tiket dibuka — dolar risiko/imbalan
   *  dihitung darinya, jadi menggeser garis MENGUBAH angkanya. */
  qtyDemo?: number;
  /** Simbol Trade-Fi (MT5): REAL memakai lot, bukan modal × leverage. */
  mt5?: boolean;
  lotMt5?: number;
  aturLotMt5?: (n: number) => void;
  /** Dolar per 1 lot per 1.0 harga — dilaporkan EA v2.01. */
  nilaiLotMt5?: number;
  /** Berapa desimal yang dipakai simbol ini. Dulu di sini toFixed(6) untuk
   *  SEMUA simbol, dan hasilnya "4345.504523" di XAUUSD — angka yang tidak
   *  mungkin dikirim ke broker mana pun, dan SL yang ditolak broker adalah
   *  SL yang dikira terpasang padahal tidak ada. */
  desimalHarga?: number;
  /** Pending order demo yang sedang menunggu harganya tersentuh. */
  tunda?: { arah: 'BUY' | 'SELL'; jenis: 'MARKET' | 'LIMIT' | 'STOP'; entry: number; sl: number; tp: number } | null;
  onBatalTunda?: () => void;
  /** Arah tiket yang sedang disusun. null = belum ada tiket. */
  draf: 'BUY' | 'SELL' | null;
  rencana: RencanaOrder;
  mode: 'demo' | 'real';
  onPilih: (arah: 'BUY' | 'SELL') => void;
  onUbah: (r: RencanaOrder) => void;
  onKirim: () => void;
  onBatal: () => void;
  onTutup: () => void;
  /** Kirim rencana tiket ini ke formulir Copy Signal + tangkapan layar
   *  chart sebagai sampul. Tidak diberikan = tombolnya tidak muncul. */
  onKirimSinyal?: () => void;
  /** Pesan hasil pengiriman (mis. level belum lengkap). */
  kabarSinyal?: string;
  /** Level di chart ini datang dari analisa Copy Signal. Menyalakan
   *  penanda COPY biru — lihat catatan di tempat pembuatannya. */
  dariSinyal?: boolean;
  onGantiMode: (m: 'demo' | 'real') => void;
  mati?: boolean;
  /** Setelan order sungguhan — modal, leverage, metode TP. Diangkat ke
   *  halaman supaya label risiko di garis chart memakai angka yang sama. */
  nyataSetelan?: { modal: number; leverage: number; metode: MetodeTp };
  aturNyata?: (s: { modal: number; leverage: number; metode: MetodeTp }) => void;
  sibukNyata?: boolean;
  /** Kabar terakhir dari pengiriman order (sukses/gagal/pending). */
  kabar?: string;
  /** Setelan demo — modal, % risiko, usulan SL×ATR dan R:R. Dulu di panel
   *  bawah yang cuma muncul saat replay; order demo tidak bergantung pada
   *  replay, jadi setelannya pun tidak boleh. */
  demoSetelan?: { modal: number; risikoPersen: number; kaliAtr: number; rr: number };
  aturDemo?: (s: { modal: number; risikoPersen: number; kaliAtr: number; rr: number }) => void;
  /** Emosi + alasan yang akan tercatat di jurnal — diisi SEBELUM Kirim.
   *  Jurnal tanpa alasan entry adalah daftar angka, bukan bahan evaluasi. */
  catatan?: { emosi: string; alasan: string };
  aturCatatan?: (c: { emosi: string; alasan: string }) => void;
}) {
  const nyata = mode === 'real';
  /* Terlipat atau terbuka — pilihan yang diingat. Saat ada tiket, posisi,
     atau pending, panelnya SELALU tampil: keadaan yang sedang membawa uang
     tidak boleh tersembunyi di balik ikon. */
  const [tutupPanel, setTutupPanel] = useState(() => {
    try { return localStorage.getItem(KUNCI_TUTUP) === '1'; } catch { return false; }
  });
  function aturTutup(v: boolean) {
    setTutupPanel(v);
    try { localStorage.setItem(KUNCI_TUTUP, v ? '1' : '0'); } catch { /* privat */ }
  }

  /* ── Lencana mode ─────────────────────────────────────────────────────
     Saat chart dibuka untuk menyusun/melihat sinyal Copy Signal, lencana
     ini BERGANTI jadi "COPY" biru — bukan berdampingan dengan DEMO.
     Alasannya: dua lencana bersebelahan di bilah sesempit ini membuat
     keduanya jadi dekorasi yang tidak dibaca, dan yang perlu diketahui
     sekilas cuma satu hal — layar ini sedang untuk apa.

     Mode order sungguhannya tidak hilang: tombol Kirim tetap berwarna
     merah dan berbunyi "Kirim order" kalau modenya real, dan lencananya
     tetap bisa diklik untuk berganti. Judul tooltipnya menyebut mode yang
     sedang berlaku, jadi tidak ada yang disembunyikan. */
  const Lencana = (
    <button onClick={() => onGantiMode(nyata ? 'demo' : 'real')}
      title={dariSinyal
        ? `Chart dibuka untuk Copy Signal · mode order sekarang: ${nyata ? 'REAL' : 'DEMO'} (klik untuk ganti)`
        : nyata ? 'Ganti ke latihan (demo)' : 'Ganti ke order sungguhan (real)'}
      className={cn('flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide transition-colors',
        dariSinyal ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30'
          : nyata ? 'bg-red-500/25 text-red-300 hover:bg-red-500/35'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200')}>
      {dariSinyal && <Copy className="size-2.5" />}
      {dariSinyal ? 'COPY' : nyata ? 'REAL' : 'DEMO'}
    </button>
  );

  /* ── Penanda COPY ─────────────────────────────────────────────────────
     Muncul saat level di chart ini datang dari sebuah analisa Copy Signal,
     bukan disusun sendiri. Biru, terpisah dari lencana DEMO/REAL, karena
     yang dibedakannya hal lain: DEMO/REAL menjawab "uangnya sungguhan atau
     tidak", COPY menjawab "levelnya siapa".

     Perlu dibedakan justru karena tampilannya identik: tiga garis yang sama,
     panel yang sama. Tanpa penanda ini, rencana orang lain yang baru dibuka
     dari kartu analisa tidak bisa dibedakan dari rencana yang barusan
     disusun sendiri — dan yang pertama tidak boleh dikirim ke bursa karena
     mengira yang kedua. */

  /* ── Pending order menunggu ────────────────────────────────────────── */
  if (tunda) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-zinc-900/90 px-2 py-1.5 backdrop-blur-sm">
        {Lencana}
        <Hourglass className="size-3.5 text-amber-400" />
        <span className="text-[11px] text-amber-200/90">
          {tunda.arah === 'BUY' ? 'Buy' : 'Sell'} {tunda.jenis === 'STOP' ? 'Stop' : 'Limit'}{' '}
          <span className="angka">{fHarga(tunda.entry)}</span> menunggu
        </span>
        <button onClick={onBatalTunda} title="Batalkan pending order"
          className="flex cursor-pointer items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10.5px] text-zinc-300 transition-colors hover:border-zinc-500">
          <Ban className="size-3" /> Batal
        </button>
      </div>
    );
  }

  /* ── Posisi sudah berjalan ─────────────────────────────────────────── */
  if (posisi) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/90 px-2 py-1.5 backdrop-blur-sm">
        {Lencana}
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold',
          posisi.arah === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
          {posisi.arah}
        </span>
        <span className="angka text-[11px] text-zinc-400">{fHarga(posisi.masuk)}</span>
        <span className={cn('angka text-[11.5px] font-medium', posisi.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {uang(posisi.pnl, true)}
        </span>
        <button onClick={onTutup} title="Tutup posisi"
          className="flex cursor-pointer items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10.5px] text-zinc-300 transition-colors hover:border-zinc-500">
          <X className="size-3" /> Tutup
        </button>
      </div>
    );
  }

  /* ── Tiket sedang disusun ──────────────────────────────────────────── */
  if (draf) {
    const { entry, sl, tp } = rencana;
    /* Risk : Reward dihitung dari level yang SEDANG terpasang, bukan dari
       setelan. Angka ini satu-satunya cara tahu apakah seretan barusan
       merusak rencananya — dan ia harus ikut berubah selagi digeser. */
    const risk = entry && sl ? Math.abs(entry - sl) : 0;
    const reward = entry && tp ? Math.abs(tp - entry) : 0;
    const rr = risk > 0 && reward > 0 ? reward / risk : null;
    /* SL di sisi yang salah bukan sekadar RR jelek — ia order yang langsung
       kena begitu terkirim. Ditahan di sini, bukan ditolak backend. */
    const arahBenar = !entry || !sl || !tp
      ? false
      : draf === 'BUY' ? sl < entry && tp > entry : sl > entry && tp < entry;

    const Isian = ({ k, label, warna }: { k: 'entry' | 'sl' | 'tp'; label: string; warna: string }) => (
      <label className="block">
        <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide" style={{ color: warna }}>{label}</span>
        <input value={rencana[k] === undefined ? '' : String(Number(rencana[k]!.toFixed(desimalHarga)))}
               inputMode="decimal"
               onChange={(e) => onUbah({ ...rencana, [k]: Number(e.target.value) || undefined })}
               className={cn(KELAS_ISIAN, 'angka w-[86px]')} />
      </label>
    );

    return (
      /* max-w di HP: tiket ini duduk sebagai hamparan di pojok kiri-atas
         chart, dan tanpa batas ia melebar mengikuti isinya sampai ~306 px —
         di layar 375 px itu berarti menutupi hampir seluruh lebar lilin,
         dan ujung kanannya menabrak legend indikator. Dibatasi menyisakan
         5 rem supaya sumbu harga dan legend tetap terbaca; isinya sudah
         `flex-wrap`, jadi yang terjadi cuma turun baris. */
      <div className={cn('max-w-[calc(100vw-5rem)] rounded-lg border bg-zinc-900/92 px-2.5 py-2 backdrop-blur-sm sm:max-w-none',
        nyata ? 'border-red-500/40' : 'border-zinc-700')}>
        <div className="mb-1.5 flex items-center gap-2">
          {Lencana}
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold',
            draf === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
            {draf}
          </span>
          {/* Jenis order MENGIKUTI letak garis entry — geser ke atas harga
              dan tulisannya berubah sendiri. Keterangan inilah cara orangnya
              tahu seretan barusan mengubah jenis ordernya. */}
          {jenis && (
            <span className={cn('rounded px-1.5 py-0.5 text-[9.5px] font-medium',
              jenis === 'Market' ? 'bg-zinc-800 text-zinc-300' : 'bg-amber-500/15 text-amber-300')}>
              {jenis}
            </span>
          )}
          <span className="text-[10.5px] text-zinc-500">geser garisnya di chart</span>
        </div>

        <div className="flex items-end gap-1.5">
          <Isian k="entry" label="Entry" warna="#d4d4d8" />
          <Isian k="sl" label="SL" warna="#f87171" />
          <Isian k="tp" label="TP" warna="#10b981" />
        </div>

        {catatan && aturCatatan && (
          <div className="mt-1.5 flex items-end gap-1.5">
            <label className="block">
              <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide text-zinc-500">Emosi</span>
              <select value={catatan.emosi}
                      onChange={(e) => aturCatatan({ ...catatan, emosi: e.target.value })}
                      className={cn(KELAS_ISIAN, 'w-[104px] cursor-pointer')}>
                {['Netral', 'Percaya Diri', 'Tenang', 'Ragu-ragu', 'FOMO', 'Panik', 'Balas Dendam'].map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </label>
            <label className="block grow">
              <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide text-zinc-500">Alasan / setup</span>
              <input value={catatan.alasan}
                     onChange={(e) => aturCatatan({ ...catatan, alasan: e.target.value })}
                     placeholder="cth: retest support 4H"
                     className={cn(KELAS_ISIAN, 'w-full min-w-[140px]')} />
            </label>
          </div>
        )}

        {/* Ukuran latihan diatur DI SINI, bukan di panel bawah replay —
            order demo bisa dibuka tanpa menyentuh tombol replay sama
            sekali, jadi setelannya harus ikut tiketnya. */}
        {!nyata && demoSetelan && aturDemo && (
          <div className="mt-1.5 flex items-end gap-1.5">
            <IsianAngka judul="Modal $" lebar="w-[76px]" langkah={50}
                        nilai={demoSetelan.modal}
                        atur={(n) => aturDemo({ ...demoSetelan, modal: n })} />
            <IsianAngka judul="Risk %" lebar="w-[64px]" langkah={0.1} maks={100}
                        nilai={demoSetelan.risikoPersen}
                        atur={(n) => aturDemo({ ...demoSetelan, risikoPersen: n })} />
            <IsianAngka judul="SL ×ATR" lebar="w-[64px]" langkah={0.1}
                        nilai={demoSetelan.kaliAtr}
                        atur={(n) => aturDemo({ ...demoSetelan, kaliAtr: n })} />
            <IsianAngka judul="R : R" lebar="w-[62px]" langkah={0.1}
                        nilai={demoSetelan.rr}
                        atur={(n) => aturDemo({ ...demoSetelan, rr: n })} />
          </div>
        )}

        {/* Order sungguhan butuh UKURANNYA di tempat yang sama dengan
            levelnya — modal, leverage, dan metode TP yang persis sama
            dengan Area Entry. Tanpa ini tiketnya cuma setengah keputusan. */}
        {nyata && mt5 && (
          <div className="mt-1.5 flex items-end gap-1.5">
            {/* Langkah 0.01 = satu langkah lot terkecil di kebanyakan broker;
                batas 10 sama dengan pagar lot di server. */}
            <IsianAngka judul="Lot" lebar="w-[76px]" langkah={0.01} maks={10}
                        nilai={lotMt5 ?? 0}
                        atur={(n) => aturLotMt5?.(n)} />
            <span className="pb-1 text-[10px] leading-tight text-zinc-600">
              Market ke EA MT5 · SL/TP ikut terpasang
            </span>
          </div>
        )}

        {nyata && !mt5 && nyataSetelan && aturNyata && (
          <div className="mt-1.5 flex items-end gap-1.5">
            <IsianAngka judul="Modal $" lebar="w-[76px]" langkah={50}
                        nilai={nyataSetelan.modal}
                        atur={(n) => aturNyata({ ...nyataSetelan, modal: n })} />
            {/* Leverage bilangan bulat, minimal 1 — 125× adalah atap bursa
                yang paling longgar; di atas itu ordernya ditolak sebelum
                sempat merugikan siapa pun. */}
            <IsianAngka judul="Lev" lebar="w-[60px]" langkah={1} min={1} maks={125} desimal={0}
                        nilai={nyataSetelan.leverage}
                        atur={(n) => aturNyata({ ...nyataSetelan, leverage: n })} />
            <label className="block grow">
              <span className="mb-0.5 block text-[9.5px] uppercase tracking-wide text-zinc-500">Metode TP</span>
              <select value={nyataSetelan.metode}
                      onChange={(e) => aturNyata({ ...nyataSetelan, metode: e.target.value as MetodeTp })}
                      className={cn(KELAS_ISIAN, 'w-full max-w-[190px] cursor-pointer')}>
                {METODE_TP.map((m) => <option key={m.nilai} value={m.nilai}>{m.label}</option>)}
              </select>
            </label>
          </div>
        )}

        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[10.5px] text-zinc-500">
            R:R <span className={cn('angka', rr && rr >= 1.5 ? 'text-emerald-400' : 'text-zinc-300')}>
              {rr ? rr.toFixed(2) : '—'}
            </span>
          </span>
          {(() => {
            /* REAL: dolar dari ukuran order yang SEBENARNYA — qty = modal ×
               leverage / entry, dikali jarak harga. Angka risiko demo (persen
               dari modal latihan) di sini menyesatkan: ia bukan uang yang
               akan bergerak. */
            if (nyata && mt5 && entry && sl && tp && lotMt5 && nilaiLotMt5) {
              /* Dolar dari lot × nilai per lot yang dilaporkan EA — angka
                 yang sama dengan yang akan terjadi di MT5, bukan tebakan. */
              return (
                <span className="text-[10.5px] text-zinc-500">
                  <span className="angka text-red-400">-{uang(lotMt5 * nilaiLotMt5 * Math.abs(entry - sl))}</span>
                  {' / '}
                  <span className="angka text-emerald-400">+{uang(lotMt5 * nilaiLotMt5 * Math.abs(tp - entry))}</span>
                </span>
              );
            }
            if (nyata && !mt5 && nyataSetelan && entry && sl && tp) {
              const qty = (nyataSetelan.modal * nyataSetelan.leverage) / entry;
              return (
                <span className="text-[10.5px] text-zinc-500">
                  <span className="angka text-red-400">-{uang(qty * Math.abs(entry - sl))}</span>
                  {' / '}
                  <span className="angka text-emerald-400">+{uang(qty * Math.abs(tp - entry))}</span>
                </span>
              );
            }
            if (!nyata && risk > 0 && reward > 0) {
              /* Qty beku dari jangkar tiket: dolarnya MENGIKUTI garis. SL
                 yang ditarik menjauh menampilkan risiko lebih besar — bukan
                 angka %modal yang membeku berapa pun garisnya digeser. */
              const q = qtyDemo && isFinite(qtyDemo) && qtyDemo > 0
                ? qtyDemo
                : (risiko !== undefined ? risiko / risk : 0);
              if (q > 0) {
                return (
                  <span className="text-[10.5px] text-zinc-500">
                    <span className="angka text-red-400">-{uang(q * risk)}</span>
                    {' / '}
                    <span className="angka text-emerald-400">+{uang(q * reward)}</span>
                  </span>
                );
              }
            }
            return null;
          })()}
          <button onClick={onKirim} disabled={!arahBenar || mati || sibukNyata}
            title={arahBenar ? undefined : 'SL dan TP harus berada di sisi yang benar terhadap entry'}
            className={cn('ml-auto flex cursor-pointer items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              nyata ? 'bg-red-500/25 text-red-200 hover:bg-red-500/35'
                    : 'bg-zinc-100 text-zinc-950 hover:bg-white')}>
            <Check className="size-3" /> {sibukNyata ? 'Mengirim…' : nyata ? 'Kirim order' : 'Kirim'}
          </button>
          {/* Kirim rencana ini ke formulir Copy Signal beserta tangkapan
              layar chartnya. Ditaruh SEBARIS dengan Kirim/Batal karena ia
              nasib ketiga dari tiket yang sama: dieksekusi, dibatalkan,
              atau dibagikan sebagai analisa. */}
          {onKirimSinyal && (
            <button onClick={onKirimSinyal} disabled={!arahBenar}
              title={arahBenar ? 'Kirim entry/SL/TP + tangkapan layar chart ke formulir Copy Signal'
                               : 'SL dan TP harus berada di sisi yang benar terhadap entry'}
              className="flex cursor-pointer items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-300 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40">
              <Share2 className="size-3" /> Ke Copy Signal
            </button>
          )}
          {/* Alasan gagalnya DITAMPILKAN. Tombol yang diam saat ditekan
              membuat orang menekannya berulang kali sambil menebak apa
              yang salah — pola yang sudah dua kali muncul di aplikasi ini. */}
          {kabarSinyal && (
            <span className="w-full px-1 text-[10.5px] leading-tight text-amber-300/90">{kabarSinyal}</span>
          )}
          <button onClick={onBatal} title="Batalkan tiket"
            className="flex cursor-pointer items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200">
            <Ban className="size-3" /> Batal
          </button>
        </div>
        {kabar && <div className="mt-1.5 max-w-[320px] text-[10.5px] leading-relaxed text-zinc-400">{kabar}</div>}
      </div>
    );
  }

  /* ── Diam terlipat: cuma ikon ──────────────────────────────────────── */
  if (tutupPanel) {
    return (
      <button onClick={() => aturTutup(false)} title="Buka panel order"
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/85 text-zinc-400 backdrop-blur-sm transition-colors hover:border-zinc-600 hover:text-zinc-100">
        <CandlestickChart className="size-4" />
      </button>
    );
  }

  /* ── Diam terbuka: pilih arah ──────────────────────────────────────── */
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/85 px-1.5 py-1.5 backdrop-blur-sm">
      {Lencana}
      <button onClick={() => onPilih('BUY')} disabled={mati}
        className="flex cursor-pointer items-center gap-1 rounded bg-emerald-500/20 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40">
        <TrendingUp className="size-3.5" /> BUY
      </button>
      <button onClick={() => onPilih('SELL')} disabled={mati}
        className="flex cursor-pointer items-center gap-1 rounded bg-red-500/20 px-2.5 py-1 text-[11.5px] font-semibold text-red-300 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-40">
        <TrendingDown className="size-3.5" /> SELL
      </button>
      {hargaKini !== undefined && (
        <span className="angka px-1 text-[11px] text-zinc-500">{fHarga(hargaKini)}</span>
      )}
      <button onClick={() => aturTutup(true)} title="Lipat jadi ikon"
        className="flex size-6 cursor-pointer items-center justify-center rounded text-zinc-600 transition-colors hover:text-zinc-300">
        <Minus className="size-3.5" />
      </button>
      {kabar && (
        <span className="max-w-[260px] px-1 text-[10.5px] leading-tight text-zinc-400">{kabar}</span>
      )}
    </div>
  );
}
