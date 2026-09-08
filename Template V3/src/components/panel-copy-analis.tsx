import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, TriangleAlert, CircleCheck, Plug } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, uang } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useAkunMt5, useAkunBinance } from '@/lib/akun';
import { bacaKoneksi, koneksiLengkap } from '@/lib/koneksi';
import {
  kontrakBawaan, kontrakBerlaku, deteksiJenisAkun, lotUntukCopy,
} from '@/lib/ukuran-posisi';
import { simpanLanggananVps, hapusLanggananVps, kirimIkuti } from '@/lib/pengikut-vps';
import {
  bacaLangganan, simpanLangganan, hapusLangganan, type LanggananCopy,
} from '@/lib/copy-langganan';

/* ════════════════════════════════════════════════════════════════════════
   COPY SIGNAL — BERLANGGANAN KE SEORANG ANALIS (Trade-Fi)
   ════════════════════════════════════════════════════════════════════════
   Dibuka SEBELUM ada sinyal yang jalan, dan itu memang tempatnya: ukuran
   posisi harus ditetapkan selagi kepala dingin, bukan saat sinyal baru
   terbit dan tangan sedang buru-buru.

   ── SATU PERTANYAAN, BUKAN ENAM ─────────────────────────────────────────
   Versi sebelumnya menanyakan modal, persen risiko, lot tetap, ukuran
   kontrak, jenis akun, dan jarak SL acuan. Lima dari enam itu sudah
   dipegang aplikasi atau bisa diturunkan:

     modal        -> saldo akun brokernya, sudah terbaca
     jenis akun   -> dari mata uang terminal (USC/cent), sudah terbaca
     kontrak      -> dari simbol yang dipakai analisnya
     jarak SL     -> dari sinyalnya sendiri, saat ia terbit
     lot          -> HASIL, bukan masukan

   Yang tersisa satu: berapa paling banyak boleh rugi per trade. Itu
   satu-satunya angka yang cuma orangnya sendiri tahu.

   Menanyakan hal yang sudah dipegang aplikasi bukan cuma merepotkan — ia
   membuka jalan untuk jawaban yang SALAH. Salah pilih jenis akun menggeser
   ukuran posisi seratus kali lipat, dan itu kesalahan yang tidak bisa
   ditarik kembali sesudah ordernya masuk.
   ════════════════════════════════════════════════════════════════════════ */

const ISIAN = 'w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-[13px] text-zinc-200 outline-none transition-colors focus:border-zinc-600';

/** Contoh jarak SL — untuk memperlihatkan akibat angka yang baru diketik.
 *  Panel ini dibuka saat belum ada sinyal, jadi tanpa contoh kolom lotnya
 *  cuma bisa bertuliskan "—", dan panel yang tidak bisa menunjukkan akibat
 *  dari masukannya tidak menolong siapa pun memutuskan. */
const CONTOH_JARAK = [
  { label: 'SL 20 poin', harga: 2 },
  { label: 'SL 50 poin', harga: 5 },
  { label: 'SL 100 poin', harga: 10 },
];

/* ── TUJUAN SALINAN ───────────────────────────────────────────────────
   Dulu panel ini cuma tahu satu tujuan: terminal MT5. Sekarang sinyal
   kripto bisa disalin ke Binance atau Hyperliquid, dan pilihannya milik
   orangnya — BTC ada di keduanya, dan bursa mana yang ia pakai cuma ia
   yang tahu.

   Yang ditawarkan mengikuti PASAR analisnya, bukan semua tujuan sekaligus:
   analis Trade-Fi cuma bisa disalin ke MT5 (XAUUSD tidak ada di Binance),
   analis kripto cuma ke Binance/Hyperliquid (BTCUSDT tidak ada di terminal
   forex). Menawarkan pilihan yang pasti gagal cuma menambah satu cara
   untuk salah. */
type Tujuan = 'mt5' | 'binance' | 'hyperliquid';
const NAMA_TUJUAN: Record<Tujuan, string> = { mt5: 'MT5', binance: 'Binance', hyperliquid: 'Hyperliquid' };

/** Contoh jarak SL untuk kripto — dalam PERSEN harga, karena di sana tidak
 *  ada "poin" yang berarti sama untuk BTC dan untuk koin sen. */
const CONTOH_JARAK_KRIPTO = [
  { label: 'SL 0,5%', persen: 0.5 },
  { label: 'SL 1%', persen: 1 },
  { label: 'SL 2%', persen: 2 },
];

export function PanelCopyAnalis({ analisUid, analisNama, contohPasangan, pasar, tutup }: {
  analisUid: string;
  analisNama: string;
  contohPasangan?: string;
  /** Pasar analisnya — menentukan tujuan mana yang ditawarkan. Kosong =
   *  ditebak dari `contohPasangan`. */
  pasar?: 'kripto' | 'tradefi';
  tutup: () => void;
}) {
  const { pengguna } = useAuth();
  const akun = useAkunMt5();
  const bursa = useAkunBinance();

  const kripto = pasar ? pasar === 'kripto' : /USDT$/i.test(contohPasangan || '');
  const pilihan: Tujuan[] = kripto ? ['binance', 'hyperliquid'] : ['mt5'];
  const [tujuan, setTujuan] = useState<Tujuan>(pilihan[0]);
  const [leverage, setLeverage] = useState(1);

  /* Saldo per bursa dari /api/account — `rincian` memuat keduanya kalau
     backendnya sudah mengirimnya; backend lama cuma tahu Binance. */
  const saldoBursa = (id: Tujuan) => {
    const r = bursa.rincian?.find((b) => b.id === id);
    if (r) return r.saldo;
    return id === 'binance' ? bursa.saldo : null;
  };
  const koneksiAda = koneksiLengkap(bacaKoneksi());

  /* DOLAR atau PERSEN — satu angka, dua satuan. Yang dirasakan orang saat
     posisinya merah adalah dolar; yang dipakai orang menyusun aturan
     biasanya persen. Memaksa salah satunya berarti separuh orang harus
     mengalikan di kepalanya sebelum bisa menjawab. */
  const [satuan, setSatuan] = useState<'usd' | 'persen'>('usd');
  const [nilai, setNilai] = useState(1);
  const [langganan, setLangganan] = useState<LanggananCopy | null>(null);
  const [kabar, setKabar] = useState('');

  const jenisAkun = deteksiJenisAkun(akun.mataUang);
  /* SALDO MENGIKUTI TUJUAN. Persen dari saldo MT5 untuk salinan Binance
     adalah angka yang tidak berarti apa pun. */
  const saldo = tujuan === 'mt5' ? (akun.saldo ?? 0) : (saldoBursa(tujuan) ?? 0);
  const kontrak = kontrakBawaan(contohPasangan || 'XAUUSD');
  const kontrakEfektif = kontrakBerlaku(kontrak, jenisAkun);

  /* Persen SELALU dari saldo yang benar-benar ada, bukan modal karangan.
     Itu yang membuat kolom modal bisa dicabut sama sekali. */
  const rugiMaks = satuan === 'usd'
    ? nilai
    : Math.round(saldo * (nilai / 100) * 100) / 100;

  useEffect(() => {
    const l = bacaLangganan(pengguna?.uid, analisUid);
    setLangganan(l);
    if (l && l.rugiMaks > 0) { setSatuan('usd'); setNilai(l.rugiMaks); }
    /* Tujuan yang tersimpan menang — tapi hanya kalau ia masih masuk akal
       untuk pasar analis ini. Langganan lama tanpa medan tujuan berarti MT5. */
    if (l) {
      const t = (l.tujuan ?? 'mt5') as Tujuan;
      if (pilihan.includes(t)) setTujuan(t);
      if (l.leverage) setLeverage(Math.max(1, Math.min(10, Math.round(l.leverage))));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pengguna?.uid, analisUid]);

  /* Contoh ukuran untuk kripto: nilai posisi = rugi / jarak SL. Leverage
     tidak mengubah nilai posisinya, cuma margin yang dikunci — dan itu
     ditulis apa adanya di baris contohnya supaya terlihat. */
  const contohKripto = useMemo(() => CONTOH_JARAK_KRIPTO.map((c) => {
    const nilaiPosisi = rugiMaks / (c.persen / 100);
    return { ...c, nilaiPosisi, margin: nilaiPosisi / Math.max(1, leverage) };
  }), [rugiMaks, leverage]);

  const contoh = useMemo(() => CONTOH_JARAK.map((c) => ({
    ...c,
    ...lotUntukCopy({ lotDiminta: 0, rugiMaks, kontrak: kontrakEfektif, jarakHarga: c.harga }),
  })), [rugiMaks, kontrakEfektif]);

  const belumLogin = !pengguna;
  /* "Belum tersambung" punya arti berbeda per tujuan: MT5 = EA belum
     melapor; Binance/Hyperliquid = Backend URL & App Token belum diisi. */
  const belumTerhubung = tujuan === 'mt5' ? akun.terhubung === false : !koneksiAda;

  function simpan() {
    if (belumLogin || !(rugiMaks > 0)) return;
    const isi: LanggananCopy = {
      analisUid, analisNama,
      mode: 'risiko', lotTetap: 0.01,
      rugiMaks,
      modal: saldo, risiko: saldo > 0 ? (rugiMaks / saldo) * 100 : 0,
      kontrak, jenisAkun,
      sejak: langganan?.sejak ?? Date.now(),
      tujuan,
      leverage: tujuan === 'mt5' ? undefined : Math.max(1, Math.min(10, Math.round(leverage))),
    };
    simpanLangganan(pengguna!.uid, isi);
    /* Ikut dikirim ke pengikut server — HANYA untuk MT5. Pengikut VPS
       memang cuma mengurus Trade-Fi; langganan kripto dikerjakan pengikut
       peramban, dan mengirimnya ke server cuma menambah baris yang ia
       saring lagi. Fire-and-forget: gagal jaringan tidak boleh membatalkan
       penyimpanan lokal yang sudah berhasil. */
    if (tujuan === 'mt5') void simpanLanggananVps({ analisUid, analisNama, rugiMaks: isi.rugiMaks });
    /* Dicatat sebagai PENYALIN pada detik ini juga — bukan menunggu sinyal
       pertama terbit. Orang yang menekan ini sudah menyalin seluruh isi
       analisnya: market order, pending, dan pembatalan. */
    void kirimIkuti(analisUid, true);
    setLangganan(isi);
    setKabar(`Tersimpan. Tiap sinyal ${analisNama} disalin ke ${NAMA_TUJUAN[tujuan]} dengan rugi dibatasi ${uang(rugiMaks)}.`);
  }

  function batal() {
    if (!pengguna) return;
    hapusLangganan(pengguna.uid, analisUid);
    void hapusLanggananVps(analisUid);
    void kirimIkuti(analisUid, false);
    setLangganan(null);
    setKabar('Berhenti mengikuti. Tidak ada sinyal analis ini yang akan disalin.');
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={tutup}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div onClick={(e) => e.stopPropagation()}
           className="relative flex max-h-[88vh] w-full max-w-[380px] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
          <Copy className="size-4 text-zinc-400" strokeWidth={1.8} />
          <span className="text-[13px] font-medium text-zinc-100">Copy Signal</span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-zinc-400">
            {kripto ? 'Kripto' : 'Trade-Fi'}
          </span>
          <button onClick={tutup} aria-label="Tutup"
            className="ml-auto cursor-pointer rounded p-0.5 text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-zinc-200">
            <X className="size-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {/* AKUN BROKER paling atas — ukuran posisi tanpa saldo yang
              terlihat adalah tebakan, dan orang yang tidak melihat saldonya
              cenderung memakai angka yang lebih besar dari kenyataan. */}
          {/* ── PILIH TUJUAN — hanya kalau memang ada yang bisa dipilih ── */}
          {pilihan.length > 1 && (
            <div className="mb-3">
              <span className="mb-1.5 block text-[11.5px] text-zinc-300">Salin ke</span>
              <div className="grid grid-cols-2 gap-1.5">
                {pilihan.map((t) => {
                  const s = saldoBursa(t);
                  return (
                    <button key={t} onClick={() => setTujuan(t)}
                      className={cn('cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors',
                        tujuan === t ? 'border-zinc-500 bg-zinc-800/70' : 'border-zinc-800 hover:border-zinc-700')}>
                      <div className={cn('text-[12.5px] font-medium', tujuan === t ? 'text-zinc-100' : 'text-zinc-300')}>
                        {NAMA_TUJUAN[t]}
                      </div>
                      <div className="angka mt-0.5 text-[10.5px] text-zinc-500">
                        {s != null ? uang(s) : koneksiAda ? 'saldo belum terbaca' : 'belum tersambung'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              <Plug className="size-3" strokeWidth={2} /> {tujuan === 'mt5' ? 'Akun broker' : `Akun ${NAMA_TUJUAN[tujuan]}`}
            </div>
            {belumTerhubung ? (
              <div className="mt-1.5 text-[11.5px] leading-relaxed text-amber-200">
                {tujuan === 'mt5' ? 'Terminal MT5 belum tersambung.' : 'Backend URL & App Token belum diisi.'}{' '}
                <Link to="/integrations" onClick={tutup} className="underline underline-offset-2">
                  {tujuan === 'mt5' ? 'Pasang EA di Integrations' : 'Isi di Integrations'}
                </Link>{' '}
                dulu — tanpa itu tidak ada order yang bisa dikirim ke mana pun.
              </div>
            ) : tujuan !== 'mt5' ? (
              <>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  <Kolom k="Saldo" v={saldoBursa(tujuan) != null ? uang(saldoBursa(tujuan)!) : '—'} />
                  <Kolom k="Bursa" v={NAMA_TUJUAN[tujuan]} />
                  <Kolom k="Leverage" v={`${leverage}×`} />
                </div>
                {/* LEVERAGE DITANYAKAN, bukan ditebak — dan ditulis apa
                    adanya bahwa ia tidak mengubah risikonya. Yang sering
                    dikira orang: leverage besar = rugi besar. Di sini bukan:
                    batas ruginya tetap, yang berubah cuma margin yang
                    dikunci bursa. */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10.5px] text-zinc-500">Leverage</span>
                  <input type="range" min={1} max={10} step={1} value={leverage}
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="grow accent-zinc-300" />
                  <span className="angka w-7 text-right text-[11px] text-zinc-300">{leverage}×</span>
                </div>
                <div className="mt-1 text-[10px] leading-relaxed text-zinc-600">
                  Leverage tidak mengubah batas rugi — cuma margin yang dikunci bursa.
                </div>
              </>
            ) : (
              <>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  <Kolom k="Saldo" v={akun.saldo != null ? uang(akun.saldo) : '—'} />
                  <Kolom k="Ekuitas" v={akun.ekuitas != null ? uang(akun.ekuitas) : '—'} />
                  <Kolom k="Akun" v={akun.loginAktif || '—'} />
                </div>
                {/* DIBACA, bukan ditanyakan. Ditulis apa adanya supaya bisa
                    diperiksa — deteksi yang salah menggeser ukuran posisi
                    seratus kali, dan itu harus bisa ketahuan sebelum
                    ordernya masuk, bukan sesudah. */}
                <div className="mt-1.5 text-[10.5px] text-zinc-500">
                  Terbaca sebagai{' '}
                  <span className={jenisAkun === 'cent' ? 'text-amber-300' : 'text-zinc-300'}>
                    akun {jenisAkun}
                  </span>
                  {jenisAkun === 'cent' && ' — 1 lot = 1/100 standar'}
                  {akun.mataUang && <span className="text-zinc-600"> · {akun.mataUang}</span>}
                </div>
              </>
            )}
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[11px] text-zinc-500">Mengikuti</span>
            <span className="truncate text-[13px] font-semibold text-zinc-100">{analisNama}</span>
          </div>

          {/* ── SATU-SATUNYA PERTANYAAN ──────────────────────────────── */}
          <div className="mt-3">
            <span className="mb-1.5 block text-[11.5px] text-zinc-300">
              Paling banyak rugi per trade
            </span>
            <div className="flex items-stretch gap-2">
              <input value={nilai} inputMode="decimal"
                onChange={(e) => setNilai(Math.max(0, Number(e.target.value) || 0))}
                className={cn(ISIAN, 'angka')} />
              <div className="flex shrink-0 overflow-hidden rounded-md border border-zinc-800">
                {([['usd', '$'], ['persen', '%']] as const).map(([v, t]) => (
                  <button key={v} onClick={() => setSatuan(v)}
                    className={cn('cursor-pointer px-3 text-[12px] transition-colors',
                      satuan === v ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-1.5 text-[10.5px] text-zinc-500">
              {satuan === 'persen'
                ? <>= <span className="angka text-amber-300">{uang(rugiMaks)}</span> dari saldo {uang(saldo)}</>
                : saldo > 0
                  ? <>= <span className="angka text-zinc-300">{((rugiMaks / saldo) * 100).toFixed(2)}%</span> dari saldo {uang(saldo)}</>
                  : 'Saldo belum terbaca — persennya tidak bisa dihitung.'}
            </div>
          </div>

          {/* Akibatnya, dalam lot. Ini yang membuktikan angkanya masuk akal
              sebelum sinyal pertama datang. */}
          {tujuan !== 'mt5' ? (
          <div className="mt-3 rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Nilai posisi yang akan dipakai · contoh jarak SL
            </div>
            <div className="mt-1.5 space-y-1">
              {contohKripto.map((c) => (
                <div key={c.label} className="flex items-baseline gap-2 text-[11.5px]">
                  <span className="text-zinc-500">{c.label}</span>
                  <span className="angka ml-auto text-zinc-300">{uang(c.nilaiPosisi)}</span>
                  <span className="angka w-20 text-right text-[10.5px] text-zinc-600">margin {uang(c.margin)}</span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
              Nilai posisi dihitung dari jarak SL tiap sinyal saat ia terbit. Yang tetap:
              ruginya tidak pernah melewati{' '}
              <span className="angka text-amber-300/90">{uang(rugiMaks)}</span>. Di bawah $10
              bursa menolak — batas rugi yang terlalu kecil untuk SL yang lebar akan dilewati.
            </div>
          </div>
          ) : (
          <div className="mt-3 rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Lot yang akan dipakai · contoh jarak SL
            </div>
            <div className="mt-1.5 space-y-1">
              {contoh.map((c) => (
                <div key={c.label} className="flex items-baseline gap-2 text-[11.5px]">
                  <span className="text-zinc-500">{c.label}</span>
                  <span className="angka ml-auto text-zinc-300">
                    {c.lot > 0 ? c.lot.toFixed(2) + ' lot' : '—'}
                  </span>
                  <span className={cn('angka w-16 text-right', c.rugi > 0 ? 'text-red-400' : 'text-zinc-600')}>
                    {c.rugi > 0 ? '−' + uang(c.rugi) : '—'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
              Lot sebenarnya dihitung dari jarak SL tiap sinyal saat ia terbit. Yang
              tetap: ruginya tidak pernah melewati{' '}
              <span className="angka text-amber-300/90">{uang(rugiMaks)}</span>, seberapa
              lebar pun analis memasang stopnya.
            </div>
          </div>
          )}

          <div className={cn('mt-3 flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed',
            langganan ? 'border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-200'
                      : 'border-zinc-800 bg-zinc-900/30 text-zinc-500')}>
            {langganan ? <CircleCheck className="mt-px size-3.5 shrink-0" />
                       : <TriangleAlert className="mt-px size-3.5 shrink-0" />}
            {langganan
              ? `Terdaftar mengikuti ${analisNama} ke ${NAMA_TUJUAN[(langganan.tujuan ?? 'mt5') as Tujuan]}, rugi dibatasi ${uang(langganan.rugiMaks)} per trade.`
              : 'Belum mengikuti analis ini.'}
          </div>

          {/* KALIMAT INI PERNAH BERBOHONG. Sampai 26 Agu 2026 ia berbunyi
              "penyalinan otomatis masih dibangun" — dan tetap berbunyi begitu
              berminggu-minggu SESUDAH penyalinnya benar-benar berjalan.
              Akibatnya bukan sekadar keterangan basi: pemiliknya sendiri
              mengira fiturnya belum ada dan menyalin satu per satu dengan
              tangan. Janji yang tertinggal lebih berbahaya daripada panel
              yang belum sempat dibuat. */}
          {tujuan === 'mt5' ? (
          <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-600">
            Begitu disimpan, sinyal <span className="text-zinc-400">baru</span> dari analis ini
            masuk sendiri ke terminalmu — tidak perlu menekan apa pun lagi. Sinyal yang
            terbit sebelum ini tidak ikut. Kalau analisnya menarik sinyalnya, salinanmu
            ikut ditarik: order yang menunggu dibatalkan, posisi yang terlanjur terisi
            ditutup di harga pasar. Berjalan selama aplikasi ini terbuka, dipindai tiap
            menit — statusnya bisa dilihat di sub-halaman Signal Diikuti.
          </p>
          ) : (
          /* DUA BATAS DITULIS TERANG-TERANGAN. Yang pertama (tanpa SL/TP tidak
             disalin) menjaga uangnya; yang kedua (penarikan tidak ditutup
             otomatis) adalah keterbatasan yang nyata, dan orang harus tahu
             SEBELUM mengandalkannya — bukan saat posisinya sudah yatim. */
          <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-600">
            Begitu disimpan, sinyal <span className="text-zinc-400">baru</span> dari analis ini
            dikirim sendiri ke {NAMA_TUJUAN[tujuan]} lewat backend-mu, lengkap dengan SL dan TP-nya.
            Sinyal yang terbit sebelum ini tidak ikut, dan sinyal <span className="text-zinc-400">tanpa
            SL/TP</span> (cermin dompet) tidak disalin — ikuti dompetnya lewat Wallet Tracking.
            Kalau analisnya menarik sinyalnya, salinanmu <span className="text-amber-300/90">tidak ditutup
            otomatis</span> — kamu diberi tahu di Signal Diikuti dan menutupnya sendiri.
            Berjalan selama aplikasi ini terbuka, dipindai tiap menit.
          </p>
          )}

          {kabar && <div className="mt-2 text-[11px] text-zinc-400">{kabar}</div>}
        </div>

        <div className="flex gap-2 border-t border-zinc-800 px-4 py-3">
          <button onClick={simpan} disabled={belumLogin || !(rugiMaks > 0)}
            className="flex-1 cursor-pointer rounded-lg bg-zinc-100 px-3 py-2 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
            {langganan ? 'Simpan perubahan' : 'Ikuti analis ini'}
          </button>
          {langganan && (
            <button onClick={batal}
              className="cursor-pointer rounded-lg border border-red-500/40 px-3 py-2 text-[12px] font-medium text-red-300 transition-colors hover:bg-red-500/10">
              Batalkan Copy
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Kolom({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wide text-zinc-600">{k}</div>
      <div className="angka truncate text-[12px] text-zinc-200">{v}</div>
    </div>
  );
}
