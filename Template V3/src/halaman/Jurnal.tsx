import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Plus, Pencil, Bitcoin, CandlestickChart, Link2, Link2Off, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Panel, PanelHead, BadgeTren, TipGrafik, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen, tanggalPendek, harga as fHarga } from '@/lib/utils';
import { statGabungan, kurvaEkuitas, plPerHari, rangkumLayering } from '@/lib/hitung';
import { useRiwayat, useSaldoAwal, usePosisi } from '@/lib/data';
import { LabelContoh, SpandukContoh } from '@/components/gerbang';
import { useAuth } from '@/lib/auth';
import type { Trade, Sumber } from '@/data/contoh';
import { useAkunMt5, useAkunBinance, type StatusAkun } from '@/lib/akun';
import { useEmosiPosisi, EMOSI } from '@/lib/emosi-posisi';
import { ModalTrade } from '@/components/modal-trade';
import { KotakArus } from '@/components/kotak-arus';
import { useArusKas, arusBersih, sinkronRiwayatMt5, sinkronRiwayatBinance, type Arus } from '@/lib/tulis-jurnal';
import { bacaStatistik, bacaPnl } from '@/lib/catatan-stat';
import { Link } from 'react-router-dom';

/* ════════════════════════════════════════════════════════════════════════
   JOURNAL — DUA jurnal terpisah dalam satu halaman
   ════════════════════════════════════════════════════════════════════════
   Trade-Fi (forex/XAU lewat MT5) dan Kripto (Binance) dipisah, persis
   seperti V2. Sebelumnya keduanya digabung jadi satu daftar dengan tombol
   penyaring, dan itu menyembunyikan hal yang paling penting: keduanya
   punya kurva ekuitas, winrate, dan pola emosi yang BERBEDA. Satu akun bisa
   untung di forex sambil rugi di kripto, dan daftar gabungan membuat
   keduanya saling menutupi.

   Dashboard adalah PENJUMLAHAN kedua blok ini. Ketiganya membaca array
   yang sama (`useRiwayat()`), dibagi lewat field `sumber` — bukan tiga
   sumber terpisah yang kebetulan mirip.
   ════════════════════════════════════════════════════════════════════════ */

function Kalender({ pl }: { pl: Map<string, number> }) {
  /* Bulan yang sedang dilihat, sebagai offset dari bulan berjalan.
     0 = bulan ini, -1 = bulan lalu. Menyimpan offset, bukan objek Date,
     membuat "maju/mundur satu bulan" tidak perlu memikirkan panjang bulan
     maupun pergantian tahun — Date(tahun, bulan-1, 1) sudah benar sendiri
     bahkan untuk Januari. */
  const [geserBulan, setGeserBulan] = useState(0);

  /* Bulan-bulan yang BENAR-BENAR punya transaksi, dari data. Dipakai untuk
     tombol lompat: menawarkan Maret yang kosong sama saja dengan menyuruh
     orang menebak-nebak di mana datanya. */
  const bulanBerisi = useMemo(() => {
    const set = new Set<string>();
    pl.forEach((_, kunci) => set.add(kunci.slice(0, 7)));
    return [...set].sort();
  }, [pl]);

  const acuan = new Date();
  const dilihat = new Date(acuan.getFullYear(), acuan.getMonth() + geserBulan, 1);
  const tahun = dilihat.getFullYear();
  const bulan = dilihat.getMonth();
  const jmlHari = new Date(tahun, bulan + 1, 0).getDate();
  const geser = (new Date(tahun, bulan, 1).getDay() + 6) % 7;
  const maks = Math.max(1, ...[...pl.values()].map(Math.abs));

  const sel: (null | { hari: number; nilai?: number })[] = [
    ...Array(geser).fill(null),
    ...Array.from({ length: jmlHari }, (_, i) => ({
      hari: i + 1,
      /* Kunci tanggal LOKAL, bukan toISOString(). toISOString() mengubah ke
         UTC, jadi tanggal 1 jam 00:00 WIB jatuh ke tanggal 30 bulan lalu —
         dan seluruh kalender bergeser satu hari. */
      nilai: pl.get(`${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`),
    })),
  ];
  const total = sel.reduce((s, c) => s + (c?.nilai ?? 0), 0);

  const kunciDilihat = `${tahun}-${String(bulan + 1).padStart(2, '0')}`;
  const adaData = bulanBerisi.includes(kunciDilihat);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button onClick={() => setGeserBulan((n) => n - 1)} aria-label="Bulan sebelumnya"
          className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-[12.5px] text-zinc-300">
          {dilihat.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          {!adaData && <span className="ml-1.5 text-[11px] text-zinc-600">· kosong</span>}
        </span>
        <button onClick={() => setGeserBulan((n) => Math.min(0, n + 1))} disabled={geserBulan >= 0}
          aria-label="Bulan berikutnya"
          className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30">
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Lompat langsung ke bulan yang ada isinya. Menekan panah enam kali
          untuk sampai ke Juli adalah gesekan yang tidak perlu ketika
          daftarnya sudah kita punya. */}
      {bulanBerisi.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {bulanBerisi.map((b) => {
            const [y, m] = b.split('-').map(Number);
            const off = (y - acuan.getFullYear()) * 12 + (m - 1 - acuan.getMonth());
            return (
              <button key={b} onClick={() => setGeserBulan(off)}
                className={cn('cursor-pointer rounded px-1.5 py-0.5 text-[10.5px] transition-colors',
                  off === geserBulan ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-800 text-zinc-500 hover:text-zinc-200')}>
                {new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })}
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-2 grid grid-cols-7 gap-1">
        {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((d, i) => (
          <div key={i} className="text-center text-[10.5px] text-zinc-600">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {sel.map((c, i) => {
          if (!c) return <div key={i} />;
          const ada = typeof c.nilai === 'number';
          const untung = (c.nilai ?? 0) >= 0;
          const kuat = ada ? Math.min(0.45, (Math.abs(c.nilai!) / maks) * 0.45) : 0;
          return (
            <div
              key={i}
              title={ada ? `${c.hari}: ${uang(c.nilai!)}` : undefined}
              className={cn(
                'flex aspect-square flex-col items-center justify-center rounded-md border text-[10.5px]',
                ada ? (untung ? 'border-emerald-500/25' : 'border-red-500/25') : 'border-zinc-800/50 text-zinc-600'
              )}
              style={ada ? { background: untung ? `rgba(16,185,129,${kuat})` : `rgba(239,68,68,${kuat})` } : undefined}
            >
              <span className={ada ? 'text-zinc-200' : ''}>{c.hari}</span>
              {ada && (
                <span className={cn('angka text-[8.5px]', untung ? 'text-emerald-400' : 'text-red-400')}>
                  {c.nilai! >= 0 ? '+' : ''}{c.nilai!.toFixed(0)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-zinc-800/60 pt-3 text-[12.5px]">
        <span className="text-zinc-500">Total bulan ini</span>
        <span className={cn('angka', total >= 0 ? 'text-emerald-500' : 'text-red-400')}>{uang(total, true)}</span>
      </div>
    </div>
  );
}

/** Kotak saldo dengan status sambungan — ikon rantai seperti V2.
 *
 *  Dua angka sengaja dipisah: SALDO JURNAL dihitung dari transaksi yang
 *  tercatat, SALDO BROKER datang dari MT5/Binance. Keduanya jarang sama
 *  persis (deposit, penarikan, biaya yang tidak masuk jurnal), dan
 *  menampilkan satu angka saja menyembunyikan selisih yang justru paling
 *  perlu diketahui. */
function KartuSaldo({ judul, saldoJurnal, akun, keIntegrasi }: {
  judul: string; saldoJurnal: number; akun: StatusAkun; keIntegrasi: string;
}) {
  const nyambung = akun.terhubung === true;
  const memeriksa = akun.terhubung === null;
  /* Saldo broker dipakai selama ADA — termasuk laporan terakhir EA yang
     sedang mati. Sumbernya disebut jujur di baris keterangan. */
  const adaSaldoBroker = akun.saldo !== null;
  const selisih = adaSaldoBroker ? akun.saldo! - saldoJurnal : null;

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12.5px] text-zinc-500">{judul}</div>
          <div className="angka mt-2 text-[28px] font-semibold leading-none tracking-tight text-zinc-100">
            {uang(adaSaldoBroker ? akun.saldo! : saldoJurnal)}
          </div>
          <div className="mt-2.5 text-[12px] text-zinc-500">
            {nyambung ? `dari broker · jurnal ${uang(saldoJurnal)}`
              : adaSaldoBroker ? `laporan terakhir EA · jurnal ${uang(saldoJurnal)}`
              : 'dihitung dari jurnal'}
          </div>
        </div>

        {/* Belum tersambung -> tautan, bukan sekadar label. Badge yang cuma
            memberi tahu tanpa memberi jalan keluar menyuruh orang mencari
            sendiri halaman mana yang harus dibuka. */}
        {nyambung ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-400">
            <Link2 className="size-3.5" strokeWidth={2.2} /> Connected
          </span>
        ) : (
          <Link
            to={keIntegrasi}
            title={akun.ket}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
              memeriksa ? 'bg-zinc-700/30 text-zinc-400' : 'bg-zinc-700/30 text-zinc-300 hover:bg-zinc-700/50'
            )}
          >
            <Link2Off className="size-3.5" strokeWidth={2.2} /> {memeriksa ? 'Memeriksa…' : 'Connect'}
          </Link>
        )}
      </div>

      {selisih !== null && Math.abs(selisih) >= 0.01 && (
        <div className="mt-3 border-t border-zinc-800/60 pt-2.5 text-[11.5px] text-zinc-500">
          Selisih broker vs jurnal{' '}
          <span className={cn('angka', selisih >= 0 ? 'text-emerald-500' : 'text-red-400')}>
            {uang(selisih, true)}
          </span>
          {' '}— biasanya deposit, penarikan, atau biaya yang belum tercatat.
        </div>
      )}
      {!nyambung && !memeriksa && (
        <div className="mt-3 border-t border-zinc-800/60 pt-2.5 text-[11.5px] text-zinc-600">{akun.ket}</div>
      )}
    </Panel>
  );
}

/** Posisi yang SEDANG terbuka untuk sumber ini.
 *
 *  Kripto dari `public/posisiTerbuka` (dan dari bursa langsung kalau App
 *  Token ada); Trade-Fi dari laporan EA. Dua sumber berbeda, satu tampilan —
 *  yang ditanyakan sama: apa yang sedang berjalan sekarang. */
function PanelPosisiJurnal({ sumber }: { sumber: Sumber }) {
  const { data: posisiKripto } = usePosisi();
  const mt5 = useAkunMt5();

  const emosiPos = useEmosiPosisi();

  /* Ukuran, entry, SL, dan TP ikut ditampilkan — tanpa keempatnya, panel
     ini cuma memberi tahu ADA posisi, bukan posisi seperti apa. Kripto
     memakai jumlah koin (size order), Trade-Fi memakai lot; keduanya
     ditulis dengan satuannya sendiri karena "0,05" tanpa satuan berarti
     dua hal yang sangat berbeda di dua pasar itu. */
  const baris = sumber === 'kripto'
    ? posisiKripto.map((p) => ({
        kunci: p.id, simbol: p.simbol, arah: p.arah,
        ket: p.tf && p.tf !== '—' ? p.tf : p.venue,
        ukuran: p.jumlah ? `${p.jumlah} ${p.simbol.replace(/USDT$/, '')}` : '',
        entry: p.entry, sl: p.sl, tp: p.tp,
        pnl: p.pnlFloat,
        tiket: undefined as string | undefined,
      }))
    : mt5.posisi.map((p) => ({
        kunci: p.tiket, simbol: p.simbol, arah: p.arah,
        ket: `#${p.tiket}`,
        ukuran: `${p.lot} lot`,
        entry: p.hargaBuka, sl: p.sl, tp: p.tp,
        pnl: p.profit,
        tiket: p.tiket as string | undefined,
      }));

  const total = baris.some((b) => b.pnl !== undefined)
    ? baris.reduce((s, b) => s + (b.pnl ?? 0), 0)
    : null;

  return (
    <Panel>
      <PanelHead
        judul="Posisi Terbuka"
        sub={sumber === 'kripto' ? 'Berjalan di Binance.' : 'Berjalan di MetaTrader 5.'}
        kanan={
          total === null
            ? <span className="text-[11.5px] text-zinc-500">{baris.length} posisi</span>
            : <span className={cn('angka text-[12.5px]', total >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {uang(total, true)}
              </span>
        }
      />
      <div className="px-5 pb-5">
        {/* Daftar posisi TANPA batas tinggi tetap.
            ────────────────────────────────────────────────────────────
            Dulu 190 px — pas untuk tiga baris, dan baris keempat
            terpotong di tengah tanpa tanda apa pun bahwa masih ada lagi.
            Punya lima posisi terbuka bukan keadaan luar biasa; yang luar
            biasa adalah panel yang menyembunyikannya. Gulir baru muncul
            kalau daftarnya benar-benar panjang. */}
        {baris.length === 0 ? (
          <div className="py-5 text-center text-[12.5px] text-zinc-600">
            {sumber === 'kripto' ? 'Tidak ada posisi kripto terbuka.' : mt5.terhubung === true ? 'Tidak ada posisi MT5 terbuka.' : mt5.ket}
          </div>
        ) : (
          <div className="gulir-senyap max-h-[520px] space-y-2 overflow-y-auto">
            {baris.map((b) => (
              <div key={b.kunci} className="rounded-lg border border-zinc-800/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[12.5px] text-zinc-200">{b.simbol}</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px]',
                      b.arah === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400')}>
                      {b.arah}
                    </span>
                    {b.ukuran && <span className="angka shrink-0 text-[11px] text-zinc-400">{b.ukuran}</span>}
                    <span className="truncate text-[11px] text-zinc-600">{b.ket}</span>
                  </span>
                  {/* Tanda hubung berarti PnL berjalannya tidak disiarkan —
                      bukan berarti nol. */}
                  <span className={cn('angka shrink-0 text-[12px]',
                    b.pnl === undefined ? 'text-zinc-600' : b.pnl >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                    {b.pnl === undefined ? '—' : uang(b.pnl, true)}
                  </span>
                </div>

                {/* Baris kedua: level yang sedang menjaga uangnya, lalu emosi.
                    SL/TP bernilai 0 berarti BELUM DIPASANG — ditulis apa
                    adanya, karena posisi tanpa stop adalah hal yang justru
                    harus terlihat, bukan disamarkan jadi tanda hubung. */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-zinc-600">masuk <span className="angka text-zinc-400">{fHarga(b.entry)}</span></span>
                  <span className="text-zinc-600">SL{' '}
                    <span className={cn('angka', b.sl > 0 ? 'text-red-400/90' : 'text-amber-400/80')}>
                      {b.sl > 0 ? fHarga(b.sl) : 'belum dipasang'}
                    </span>
                  </span>
                  <span className="text-zinc-600">TP{' '}
                    <span className={cn('angka', b.tp > 0 ? 'text-emerald-500/90' : 'text-zinc-600')}>
                      {b.tp > 0 ? fHarga(b.tp) : '—'}
                    </span>
                  </span>
                  {/* Emosi ditulis SEJAJAR dengan entry/SL/TP sebagai data,
                      bukan sebagai tombol. Kotak pilihan di antara angka
                      membuat barisnya terbaca seperti formulir, padahal
                      yang dibaca sekilas di sini adalah keadaan posisi.
                      Menyuntingnya tetap bisa: klik teksnya. */}
                  <span className="ml-auto flex items-center gap-1 text-zinc-600">
                    Emosi{' '}
                    <select
                      value={emosiPos.peta[b.kunci] ?? ''}
                      disabled={!emosiPos.bisaTulis}
                      onChange={(e) => { void emosiPos.simpan(b.kunci, e.target.value, b.tiket).catch(() => {}); }}
                      title="Emosi saat posisi ini berjalan — ikut tercatat di riwayat order saat ditutup"
                      className={cn('cursor-pointer appearance-none border-0 bg-transparent p-0 text-[11px] outline-none disabled:cursor-not-allowed',
                        emosiPos.peta[b.kunci] ? 'text-zinc-300' : 'text-zinc-600')}>
                      <option value="">—</option>
                      {EMOSI.map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

/** Catatan evaluasi satu baris. Warnanya menyampaikan nada sebelum
 *  kalimatnya dibaca — dan itu penting, karena kotak ini dibaca sekilas. */
function CatatanKecil({ c }: { c: { nada: 'baik' | 'awas' | 'buruk'; teks: string } }) {
  /* Kalimatnya abu-abu seperti teks penjelas lain; hanya ANGKA di dalamnya
     yang diwarnai menurut nadanya. Satu paragraf penuh berwarna membuat
     panel terlihat seperti peringatan, padahal isinya cuma keterangan —
     dan warna yang dipakai di mana-mana berhenti berarti apa-apa. */
  const warnaAngka =
    c.nada === 'baik' ? 'text-emerald-500' : c.nada === 'buruk' ? 'text-red-400' : 'text-amber-400';
  const potongan = c.teks.split(/(\$?-?\d[\d.,]*%?(?:x|×)?)/g);
  return (
    <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
      {potongan.map((s, i) =>
        /^\$?-?\d/.test(s)
          ? <span key={i} className={cn('angka', warnaAngka)}>{s}</span>
          : <span key={i}>{s}</span>
      )}
    </p>
  );
}

/** Satu blok jurnal lengkap: KPI, kurva ekuitas, kalender, riwayat, emosi.
 *
 *  Dipakai dua kali dengan daftar transaksi berbeda. Menuliskannya dua kali
 *  akan membuat kedua jurnal berbeda diam-diam dalam dua putaran revisi —
 *  persis yang terjadi pada `statPer` sebelum diperbaiki. */
function BlokJurnal({ judul, ket, Ikon, trade, saldoAwal, warna, idGradien, akun, labelSaldo, keIntegrasi, sumber, arus, bisaTulis, contoh = false, pemisah = false }: {
  judul: string; ket: string; Ikon: typeof Bitcoin;
  trade: Trade[]; saldoAwal: number; warna: string; idGradien: string;
  akun: StatusAkun; labelSaldo: string; keIntegrasi: string;
  sumber: Sumber; arus: Arus[]; bisaTulis: boolean; contoh?: boolean;
  /** Garis pemisah tebal di atas judul — menandai pergantian jurnal. */
  pemisah?: boolean;
  /** Kripto: pola emosinya sudah terwakili di Trade-Fi; riwayatnya yang
   *  butuh lebar penuh karena berisi ratusan baris sinkron. */
}) {
  /* Setoran & penarikan masuk ke SALDO, bukan ke P/L — jadi ia digabung ke
     saldo awal, bukan ke daftar transaksi. Kalau ikut ke transaksi, menyetor
     uang akan terbaca sebagai trade yang menang. */
  const modalAwal = saldoAwal + arusBersih(arus, sumber);
  const stat = statGabungan(trade, modalAwal);
  const kurva = useMemo(() => kurvaEkuitas(trade, modalAwal), [trade, modalAwal]);

  /* null = tertutup, 'baru' = tambah, objek Trade = sunting. Satu state untuk
     tiga keadaan; dua boolean terpisah selalu bisa menyala berbarengan. */
  const [modal, setModal] = useState<'baru' | Trade | null>(null);
  /* Rangkum layering — bawaannya MENYALA untuk Trade-Fi. Akun cent dengan
     layering membuka puluhan order kecil untuk satu keputusan, dan tabel yang
     menampilkan tiap layer tidak bisa dibaca. Kripto tidak dirangkum: di sana
     satu baris memang satu posisi. */
  const rangkum = sumber !== 'kripto';
  const [menuSinkron, setMenuSinkron] = useState(false);
  const barisTabel = useMemo(
    () => (rangkum ? rangkumLayering(trade) : trade.map((x) => ({ ...x, lapis: 1 }))),
    [rangkum, trade]
  );

  /* Catatan evaluasi dihitung dari daftar transaksi yang SAMA dengan
     statistiknya. Kalau keduanya berasal dari sumber berbeda, kalimatnya
     bisa menyebut angka yang tidak ada di kotak sebelahnya. */
  const catStat = useMemo(() => bacaStatistik(stat), [stat]);
  const catPnl = useMemo(() => bacaPnl(trade, stat), [trade, stat]);
  const [sinkron, setSinkron] = useState<{ sibuk: boolean; pesan: string }>({ sibuk: false, pesan: '' });
  /* Rentang & mode disimpan di perangkat: keduanya preferensi, bukan data.
     Menyimpannya di Firestore berarti satu tulisan tiap kali orang mengganti
     pilihan di dropdown. */
  const [sejak, setSejak] = useState(() => {
    try { return localStorage.getItem('jtSinkronSejak') ?? '0'; } catch { return '0'; }
  });
  const [otomatis, setOtomatis] = useState(() => {
    try { return localStorage.getItem('jtSinkronOtomatis') === '1'; } catch { return false; }
  });

  const aturSejak = (v: string) => {
    setSejak(v);
    try { localStorage.setItem('jtSinkronSejak', v); } catch { /* mode privat */ }
  };
  const aturOtomatis = (v: boolean) => {
    setOtomatis(v);
    try { localStorage.setItem('jtSinkronOtomatis', v ? '1' : '0'); } catch { /* idem */ }
  };

  const jamPesan = useRef<number | undefined>(undefined);
  const bersihkanPesan = useCallback(() => {
    window.clearTimeout(jamPesan.current);
    jamPesan.current = window.setTimeout(() => setSinkron((s) => ({ ...s, pesan: '' })), 12_000);
  }, []);

  const tarikDariMt5 = useCallback(async (diam = false) => {
    if (!diam) setSinkron({ sibuk: true, pesan: '' });
    try {
      /* Id yang sudah ada dikirim sebagai himpunan supaya penyaringan terjadi
         SEBELUM menulis. Menulis ulang ratusan dokumen tiap sinkron akan
         menghabiskan kuota tulis untuk data yang sudah sama persis. */
      const sudah = new Set(trade.map((x) => x.id));
      const batas = sejak === '0' ? 0 : Date.now() - Number(sejak) * 86_400_000;
      const h = await sinkronRiwayatMt5(sudah, batas);

      const jangkauan = h.terlama
        ? `Riwayat yang dikirim EA: ${tanggalPendek(h.terlama)} – ${tanggalPendek(h.terbaru)}.`
        : '';
      /* Pesannya hilang sendiri setelah 12 detik. Catatan hasil sinkron
         berguna tepat sesudah tombolnya ditekan; menetap di atas tabel
         selamanya ia cuma memakan tinggi panel untuk kabar yang sudah
         dibaca. */
      bersihkanPesan();
      setSinkron({
        sibuk: false,
        pesan: [
          h.ditambah
            ? `${h.ditambah} transaksi baru masuk jurnal.`
            : 'Sudah mutakhir — tidak ada transaksi baru.',
          h.diluarRentang ? `${h.diluarRentang} di luar rentang yang dipilih.` : '',
          jangkauan,
        ].filter(Boolean).join(' '),
      });
    } catch (e) {
      if (!diam) {
        bersihkanPesan();
        setSinkron({ sibuk: false, pesan: e instanceof Error ? e.message : 'Gagal menarik riwayat' });
      }
    }
  }, [trade, sejak, bersihkanPesan]);

  /* Sinkron otomatis: sekali saat halaman dibuka, lalu tiap 5 menit.
     Bukan tiap 30 detik — riwayat trade yang sudah tertutup tidak berubah,
     dan menariknya tiap setengah menit cuma membebani backend untuk jawaban
     yang hampir selalu "tidak ada yang baru". */
  useEffect(() => {
    if (!otomatis || !bisaTulis || sumber !== 'forex') return;
    void tarikDariMt5(true);
    const jam = setInterval(() => void tarikDariMt5(true), 5 * 60_000);
    return () => clearInterval(jam);
  }, [otomatis, bisaTulis, sumber, tarikDariMt5]);

  /* ── Auto-sinkron Binance untuk jurnal KRIPTO ─────────────────────────
     Order yang ditutup lewat aplikasi Binance tidak pernah lewat layar
     kita, jadi jurnalnya bolong tanpa ada yang salah pencet apa pun.
     Tiap 5 menit (dan sekali saat halaman dibuka) fill sungguhan ditarik
     dari /api/user-trades; ID dokumennya deterministic (bin<orderId>),
     jadi pengulangan tidak menggandakan baris. */
  const [pesanBin, setPesanBin] = useState('');
  useEffect(() => {
    if (!bisaTulis || sumber !== 'kripto') return;
    let hidup = true;
    const jalan = async () => {
      const sudahAda = new Set(trade.map((t) => t.id));
      const terbaru = trade.reduce((s, t) => Math.max(s, t.waktu), 0);
      const sejak = terbaru > 0 ? terbaru - 3_600_000 : Date.now() - 7 * 86_400_000;
      const h = await sinkronRiwayatBinance(sudahAda, sejak);
      if (!hidup) return;
      if (h.galat) setPesanBin('');
      else if (h.masuk > 0) setPesanBin(`${h.masuk} transaksi baru dari Binance masuk otomatis.`);
    };
    void jalan();
    const jam = setInterval(() => void jalan(), 5 * 60_000);
    return () => { hidup = false; clearInterval(jam); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bisaTulis, sumber, trade.length]);
  const pl = useMemo(() => plPerHari(trade), [trade]);

  const emosi = useMemo(() => {
    const peta = new Map<string, { n: number; pnl: number }>();
    trade.forEach((t) => {
      if (!t.emosi) return;
      const p = peta.get(t.emosi) ?? { n: 0, pnl: 0 };
      peta.set(t.emosi, { n: p.n + 1, pnl: p.pnl + t.pnl });
    });
    return [...peta.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [trade]);

  const kosong = trade.length === 0;

  return (
    <section className="mt-6 first:mt-0">
      {/* Garis pemisah tebal — dua jurnal di satu halaman butuh batas yang
          terlihat dari jauh, bukan sekadar jarak kosong. */}
      {pemisah && <div className="mb-6 border-t-2 border-zinc-800" />}
      <div className="mb-3 flex items-center gap-2.5">
        <Ikon className={cn('size-4', warna)} strokeWidth={1.9} />
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-100">{judul}</h2>
        <span className="text-[12px] text-zinc-500">{ket}</span>
        <span className="angka ml-auto text-[12px] text-zinc-600">{trade.length} transaksi</span>
      </div>

      <SpandukContoh contoh={contoh} />
      {kosong ? (
        <Panel className="px-5 py-10 text-center text-[13px] text-zinc-500">
          Belum ada transaksi {judul.toLowerCase()}.
        </Panel>
      ) : (
        <>
          {/* Empat kolom, bukan lima.
              ────────────────────────────────────────────────────────────
              Total trade, win rate, dan profit factor digabung jadi SATU
              kartu ringkas — ketiganya menjawab pertanyaan yang sama
              ("seberapa sering menang, seberapa besar bandingannya") dan
              memisahkannya cuma menghabiskan lebar. Ruang yang tersisa
              dipakai kotak Setoran & Penarikan, yang tempatnya memang di
              sini: ia bagian dari saldo, bukan catatan tambahan di bawah. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KartuSaldo judul={labelSaldo} saldoJurnal={stat.saldo} akun={akun} keIntegrasi={keIntegrasi} />

            {/* Dua angka di atas, satu di bawah — bukan tiga sejajar.
                Tiga kolom sama besar membuat ketiganya terbaca sederajat,
                padahal profit factor adalah kesimpulan dari dua yang lain.
                Menaruhnya di baris sendiri dengan catatan evaluasi membuat
                kotaknya punya arah baca, bukan sekadar rata. */}
            <Panel className="p-5">
              <div className="text-[12.5px] text-zinc-500">Statistik</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <div className="angka text-[21px] font-semibold leading-none tracking-tight text-zinc-100">{stat.jumlah}</div>
                  <div className="mt-1 text-[11px] text-zinc-500">trade</div>
                </div>
                <div>
                  <div className="angka text-[21px] font-semibold leading-none tracking-tight text-zinc-100">{persen(stat.winrate)}</div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    win rate <span className="text-zinc-600">· {stat.menang}/{stat.kalah}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 border-t border-zinc-800/60 pt-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="angka text-[19px] font-semibold leading-none tracking-tight text-zinc-100">
                    {stat.faktorProfit === null ? '—' : stat.faktorProfit === Infinity ? '∞' : stat.faktorProfit.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-zinc-500">profit factor</span>
                </div>
                {catStat && <CatatanKecil c={catStat} />}
              </div>
            </Panel>

            <Panel className="p-5">
              <div className="text-[12.5px] text-zinc-500">Net P/L</div>
              <div className={cn('angka mt-2 text-[28px] font-semibold leading-none tracking-tight',
                stat.bersih >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {uang(stat.bersih, true)}
              </div>
              <div className="mt-2 text-[11.5px] text-zinc-500">
                untung <span className="angka text-emerald-500">{uang(stat.untung)}</span>
                {' · '}rugi <span className="angka text-red-400">{uang(stat.rugi)}</span>
              </div>
              {catPnl && (
                <div className="mt-2.5 border-t border-zinc-800/60 pt-2.5">
                  <CatatanKecil c={catPnl} />
                </div>
              )}
            </Panel>

            <KotakArus sumber={sumber} arus={arus} bisaTulis={bisaTulis} ringkas />
          </div>

          {/* Kolom kiri jadi TUMPUKAN, bukan satu panel tinggi.
              ────────────────────────────────────────────────────────────
              Sebelumnya kurva ekuitas dipaksa setinggi kalender di
              sebelahnya, jadi grafiknya duduk di sepertiga atas dengan dua
              pertiga kosong di bawahnya. Grafik yang tingginya ditentukan
              tetangganya, bukan oleh isinya sendiri, selalu berakhir begitu.

              Sekarang kurva memakai tinggi secukupnya, dan sisa ruangnya
              diisi panel posisi terbuka — yang memang ingin dilihat
              berdampingan dengan kurva. */}
          {/* `min-w-0` BUKAN hiasan.
              ────────────────────────────────────────────────────────────
              Item grid bawaannya `min-width: auto`, artinya ia menolak
              menyusut lebih kecil dari isinya. Recharts mengukur lebar dari
              induknya, jadi begitu jendela dikecilkan induknya tidak ikut
              menyusut, chart mempertahankan lebar lamanya, dan panelnya
              menonjol keluar kolom. Tanpa `min-w-0` tata letak ini hanya
              rapi di lebar tempat ia pertama kali digambar. */}
          {/* TANPA items-start: item grid dibiarkan meregang setinggi baris,
              jadi tepi bawah kalender selalu sejajar dengan tepi bawah panel
              posisi terbuka — berapa pun lebar jendelanya. Dengan items-start
              tiap panel berhenti setinggi isinya sendiri, dan begitu jendela
              diubah keduanya berakhir compang-camping. */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
            <Panel>
              <PanelHead
                judul="Kurva Ekuitas"
                sub={`Dari ${uang(saldoAwal)} ke ${uang(stat.saldo)} · ${trade.length} transaksi.`}
                kanan={saldoAwal > 0 ? <BadgeTren nilai={Number(((stat.bersih / saldoAwal) * 100).toFixed(1))} /> : undefined}
              />
              {/* Tinggi ikut lebar layar: 280 px di layar lebar terasa pas,
                  tapi di jendela sempit grafiknya jadi kotak tinggi yang
                  memaksa gulir. */}
              <div className="h-[220px] px-2 pb-2 sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  {/* `bottom: 4` + XAxis setinggi 26 px membuat labelnya duduk
                      di dasar kotak, bukan melayang di tengah ruang kosong.
                      Sebelumnya bottom 0 dengan pb-4 di pembungkusnya: sumbu
                      berhenti lebih awal, lalu ada 16 px kosong di bawahnya. */}
                  <AreaChart data={kurva} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                    <defs>
                      <linearGradient id={idGradien} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fafafa" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#fafafa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
                    {/* `interval="preserveStartEnd"` menahan label pertama dan
                        terakhir tetap tampil; tanpa itu Recharts membuang
                        keduanya saat padat, dan rentang tanggalnya jadi tidak
                        terbaca sama sekali. */}
                    <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false}
                           minTickGap={48} height={30} dy={10} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={48}
                           tickFormatter={(v) => `$${v}`} domain={['dataMin - 8', 'dataMax + 8']} />
                    <Tooltip content={<TipGrafik />} cursor={{ stroke: 'rgba(255,255,255,.12)' }} />
                    {/* `baseValue="dataMin"` — isian turun sampai DASAR kotak.
                        Bawaannya 0, dan karena sumbunya dimulai di sekitar
                        $267 titik nol itu jauh di bawah layar: isiannya
                        digambar ke luar area gambar, jadi yang terlihat cuma
                        garis tanpa gradasi dan kurvanya terkesan menggantung. */}
                    <Area type="monotone" dataKey="nilai" name="Ekuitas" stroke="#fafafa" strokeWidth={1.8}
                          fill={`url(#${idGradien})`} dot={false} baseValue="dataMin" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            {/* Posisi Terbuka selebar penuh kolom kiri — sejajar dengan
                kurva ekuitas di atasnya, meregang menemui dasar kolom kanan. */}
            <div className="grow [&>div]:h-full"><PanelPosisiJurnal sumber={sumber} /></div>
            </div>

            {/* Kolom kanan: kalender + Pola Emosi PERSIS di bawahnya,
                selebar kalendernya — dan karena kolom kanan memanjang,
                Posisi Terbuka di kiri ikut meregang menyamainya. */}
            <div className="flex min-w-0 flex-col gap-4">
              <Panel className="flex min-w-0 flex-col">
                <PanelHead judul="Kalender P/L" sub="Klik panah atau nama bulan untuk berpindah." />
                <div className="flex grow flex-col justify-start px-5 pb-5"><Kalender pl={pl} /></div>
              </Panel>
              <Panel className="min-w-0">
                <PanelHead judul="Pola Emosi" sub="Emosi saat entry vs hasilnya." />
                <div className="px-5 pb-5">
                  {emosi.length === 0 ? (
                    <p className="py-4 text-center text-[12.5px] text-zinc-600">
                      Belum ada catatan emosi di jurnal ini.
                    </p>
                  ) : (
                    <div className="gulir-senyap max-h-[170px] overflow-y-auto">
                      {emosi.map(([nama, d]) => (
                        <div key={nama} className="flex items-center justify-between border-b border-zinc-800/50 py-2 text-[12.5px] last:border-0">
                          <span className="truncate text-zinc-300">{nama}</span>
                          <span className="flex shrink-0 items-center gap-2.5">
                            <span className="angka text-[11px] text-zinc-600">{d.n}×</span>
                            <span className={cn('angka text-[12px]', d.pnl >= 0 ? 'text-emerald-500' : 'text-red-400')}>{uang(d.pnl, true)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>
            </div>

            {/* Riwayat SELALU selebar tiga kolom — Pola Emosi sudah pindah
                ke sebelah Posisi Terbuka, jadi tidak ada lagi yang menuntut
                sepertiga baris ini. */}
            <Panel className="min-w-0 lg:col-span-3">
              <PanelHead
                judul="Riwayat Trade"
                sub={rangkum && barisTabel.length !== trade.length
                  ? `${Math.min(200, barisTabel.length)} baris dari ${barisTabel.length} — ${trade.length} transaksi asli dirangkum per pair, arah, dan hari.`
                  : `${Math.min(200, trade.length)} transaksi terakhir dari ${trade.length}.`}
                kanan={
                  <span className="flex items-center gap-2">
                  {/* Rangkum layering berjalan tanpa saklar di layar — akun cent
                      dengan layering memang harus dirangkum, dan centang yang
                      dipampang cuma menambah satu keputusan yang tidak pernah
                      perlu diambil. Saklar auto-sinkron pindah ke KLIK KANAN
                      pada tombol Sinkron MT5: opsi, bukan kendali utama. */}
                  {sumber === 'forex' && (
                    <span className="relative flex items-center gap-2">
                      <select value={sejak} onChange={(e) => aturSejak(e.target.value)}
                        title="Seberapa jauh ke belakang yang diambil"
                        className="h-[30px] cursor-pointer rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-[11.5px] text-zinc-300 outline-none">
                        <option value="30">30 hari</option>
                        <option value="90">90 hari</option>
                        <option value="180">6 bulan</option>
                        <option value="0">Semua</option>
                      </select>
                      <button onClick={() => void tarikDariMt5()} disabled={!bisaTulis || sinkron.sibuk}
                        onContextMenu={(e) => { e.preventDefault(); setMenuSinkron((v) => !v); }}
                        title="Klik: tarik sekarang · Klik kanan: opsi auto-sinkron"
                        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50">
                        <RefreshCw className={cn('size-3.5', sinkron.sibuk && 'animate-spin')} />
                        {sinkron.sibuk ? 'Menarik…' : 'Sinkron MT5'}
                        {otomatis && <span className="size-1.5 rounded-full bg-emerald-500" title="Auto-sinkron menyala" />}
                      </button>
                      {menuSinkron && (
                        <div className="absolute right-0 top-[36px] z-20 w-56 rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-xl">
                          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-zinc-300">
                            <input type="checkbox" checked={otomatis}
                                   onChange={(e) => { aturOtomatis(e.target.checked); setMenuSinkron(false); }}
                                   className="size-3.5 cursor-pointer accent-zinc-200" />
                            Auto-sinkron tiap 5 menit
                          </label>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">
                            Berjalan selama halaman ini terbuka. Titik hijau di
                            tombol menandakan sedang menyala.
                          </p>
                        </div>
                      )}
                    </span>
                  )}
                  <button onClick={() => setModal('baru')} disabled={!bisaTulis}
                    title={bisaTulis ? undefined : 'Masuk dulu untuk menambah catatan'}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                    <Plus className="size-3.5" /> Tambah
                  </button>
                  </span>
                }
              />
              <div className="px-5 pb-5">
                {sinkron.pesan && (
                  <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[12px] text-zinc-400">
                    {sinkron.pesan}
                  </div>
                )}
                {pesanBin && sumber === 'kripto' && (
                  <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[12px] text-emerald-400/90">
                    {pesanBin}
                  </div>
                )}
                <TabelBungkus className="max-h-[380px] overflow-y-auto">
                  <Tabel>
                    <thead className="sticky top-0 bg-zinc-950">
                      <tr>
                        <Th>Tanggal</Th><Th>Pair</Th><Th>Arah</Th>
                        <Th className="text-right">Lot/Qty</Th>
                        <Th className="text-right">Nilai Order</Th>
                        <Th className="text-right">P/L</Th>
                        <Th>Emosi</Th><Th>Setup</Th><Th />
                      </tr>
                    </thead>
                    <tbody>
                      {[...barisTabel].sort((a, b) => b.waktu - a.waktu).slice(0, 200).map((t) => (
                        <Tr key={t.id}>
                          <Td className="whitespace-nowrap text-zinc-500">{tanggalPendek(t.waktu)}</Td>
                          <Td className="whitespace-nowrap text-zinc-200">
                            {t.pair}
                            {t.lapis > 1 && (
                              <span className="ml-1.5 rounded bg-zinc-800 px-1 py-0.5 text-[9.5px] text-zinc-400"
                                    title={`${t.lapis} order digabung`}>
                                {t.lapis}×
                              </span>
                            )}
                          </Td>
                          <Td><span className={cn('text-[11.5px]', t.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>{t.arah}</span></Td>
                          <Td className="angka text-right text-zinc-400">{t.lot}</Td>
                          {/* Nilai order = margin x leverage, dalam dolar.
                              Tanda hubung berarti dokumennya tidak menyimpan
                              margin/leverage — bukan berarti nol. */}
                          <Td className="angka whitespace-nowrap text-right text-zinc-400">
                            {t.nilaiOrder ? uang(t.nilaiOrder) : '—'}
                            {t.leverage ? <span className="ml-1 text-[10.5px] text-zinc-600">{t.leverage}×</span> : null}
                          </Td>
                          <Td className={cn('angka text-right', t.pnl >= 0 ? 'text-emerald-500' : 'text-red-400')}>{uang(t.pnl, true)}</Td>
                          <Td className="whitespace-nowrap text-[12px] text-zinc-400">{t.emosi}</Td>
                          <Td className="max-w-[150px] truncate text-[12px] text-zinc-500" title={t.alasan}>{t.alasan}</Td>
                          <Td>
                            <button onClick={() => setModal(t)} disabled={!bisaTulis}
                              className="cursor-pointer text-zinc-600 transition-colors hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Sunting ${t.pair}`}>
                              <Pencil className="size-3.5" />
                            </button>
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Tabel>
                </TabelBungkus>
              </div>
            </Panel>

          </div>
        </>
      )}

      {/* Blok kosong pun boleh menambah transaksi — justru di situlah orang
          paling butuh tombolnya. Tombol di kepala tabel tidak terlihat kalau
          tabelnya belum ada. */}
      {kosong && bisaTulis && (
        <button onClick={() => setModal('baru')}
          className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white">
          <Plus className="size-3.5" /> Tambah transaksi pertama
        </button>
      )}

      {modal && (
        <ModalTrade sumber={sumber} trade={modal === 'baru' ? null : modal} tutup={() => setModal(null)} />
      )}
    </section>
  );
}

export default function Jurnal() {
  const { data: RIWAYAT, contoh } = useRiwayat();
  const saldoAwal = useSaldoAwal();
  const { pengguna } = useAuth();
  const { data: arus } = useArusKas();
  /* Menulis butuh akun sendiri. Pengunjung yang belum masuk sedang melihat
     data contoh — tombol simpan di situ akan menulis ke ruang hampa. */
  const bisaTulis = !!pengguna;

  const forex = useMemo(() => RIWAYAT.filter((t) => t.sumber === 'forex'), [RIWAYAT]);
  const kripto = useMemo(() => RIWAYAT.filter((t) => t.sumber === 'kripto'), [RIWAYAT]);
  const mt5 = useAkunMt5();
  const binance = useAkunBinance();

  return (
    <div className="p-4 sm:p-6">
      {contoh && <div className="mb-4"><LabelContoh tampil /></div>}

      {/* Tidak ada ringkasan gabungan di sini. Konsepnya jurnal TERPISAH:
          angka gabungan tempatnya di Dashboard, dan menaruhnya juga di sini
          membuat orang membaca satu angka besar lalu mengira kedua blok di
          bawahnya adalah rinciannya — padahal masing-masing punya saldo
          brokernya sendiri yang tidak selalu berjumlah demikian. */}

      {/* Saldo awal dibebankan ke blok Trade-Fi saja, dan nol untuk kripto.
          Kalau keduanya diberi saldo awal penuh, jumlah kedua kurva ekuitas
          jadi dua kali saldo awal — dan angka Dashboard tidak akan pernah
          cocok dengan penjumlahan kedua jurnal ini. */}
      <BlokJurnal
        judul="Jurnal Trade-Fi" ket="Forex & XAU lewat MetaTrader 5"
        Ikon={CandlestickChart} trade={forex} saldoAwal={saldoAwal}
        warna="text-amber-400" idGradien="gEqForex"
        akun={mt5} labelSaldo="Saldo MetaTrader 5" keIntegrasi="/integrasi"
        sumber="forex" arus={arus} bisaTulis={bisaTulis}
      />

      <BlokJurnal pemisah
        judul="Jurnal Kripto" ket="Binance Futures lewat Screener"
        Ikon={Bitcoin} trade={kripto} saldoAwal={0}
        warna="text-emerald-400" idGradien="gEqKripto"
        akun={binance} labelSaldo="Saldo Binance Futures" keIntegrasi="/integrasi"
        sumber="kripto" arus={arus} bisaTulis={bisaTulis}
      />
    </div>
  );
}
