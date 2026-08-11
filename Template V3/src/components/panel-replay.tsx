import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play, Pause, SkipForward, RotateCcw, TrendingUp, TrendingDown, X, Save, Loader2, Trash2,
} from 'lucide-react';
import { Panel, PanelHead, TabelBungkus, Tabel, Th, Td, Tr } from '@/components/efferd-ui';
import { cn, uang, persen, harga as fHarga, tanggalPendek } from '@/lib/utils';
import type { Lilin } from '@/lib/pasar';
import {
  KECEPATAN, usulSlTp, periksaKena, hitungPnl, ringkasReplay,
  bacaSesi, simpanSesi, hapusSesi,
  type PosisiReplay, type TradeReplay,
} from '@/lib/replay';
import { simpanTrade } from '@/lib/tulis-jurnal';
import type { GarisHarga } from '@/components/chart-lilin';

export interface AksiOrder {
  posisi: { arah: 'BUY' | 'SELL'; masuk: number; sl: number; tp: number; pnl: number } | null;
  hargaKini?: number;
  buka: (arah: 'BUY' | 'SELL') => void;
  tutup: () => void;
  mati: boolean;
}
import { KotakOrderNyata } from '@/components/kotak-order-nyata';

/* ════════════════════════════════════════════════════════════════════════
   PANEL REPLAY
   ════════════════════════════════════════════════════════════════════════
   Kendali putar-ulang dan eksekusi manual. Seluruh keadaannya diangkat ke
   sini, dan halaman Chart cuma menerima `idx` untuk memotong grafiknya —
   pemisahan itu membuat chart tidak perlu tahu apa pun tentang posisi,
   dan panel ini tidak perlu tahu apa pun tentang cara menggambar.
   ════════════════════════════════════════════════════════════════════════ */

const KELAS_ISIAN =
  'h-8 w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-[12px] text-zinc-200 ' +
  'outline-none transition-colors hover:border-zinc-700 focus-visible:border-zinc-600';

export function PanelReplay({ lilin, simbol, tf, idx, setIdx, aturGaris, aturAksi, aturKendali, usulSl, usulTp, tanpaBingkai = false, tampil = true }: {
  lilin: Lilin;
  simbol: string;
  tf: string;
  idx: number | null;
  setIdx: (n: number | null) => void;
  aturGaris: (g: GarisHarga[]) => void;
  /* Aksi BUY/SELL diangkat ke halaman supaya tombolnya bisa dipasang di
     POJOK CHART. Saat mengambil keputusan mata sedang di grafik, dan
     memindahkan pandangan ke bawah layar adalah tempat paling sering orang
     salah tekan arah. */
  aturAksi?: (a: AksiOrder | null) => void;
  /* SL & TP usulan dari kartu screener — mengisi kotak sekali, saat pertama
     kali halaman dibuka dari sana. */
  usulSl?: number;
  usulTp?: number;
  /* Dipakai saat panel ini berada DI DALAM panel grafik: tanpa border dan
     tanpa margin sendiri, karena pembungkusnya sudah menyediakan keduanya. */
  tanpaBingkai?: boolean;
  /* Kendali putar dikirim ke halaman untuk ditumpangkan DI ATAS grafik. */
  aturKendali?: (k: React.ReactNode | null) => void;
  /* false = komponennya tetap TERPASANG tapi tidak menggambar apa pun.
     Dipasang terus supaya tombol BUY/SELL di pojok chart tersedia sejak
     halaman dibuka — menyembunyikannya sampai tombol Replay ditekan berarti
     dua perbuatan untuk satu maksud. */
  tampil?: boolean;
}) {
  const [main, setMain] = useState(false);
  const [cepat, setCepat] = useState(4);
  const [modal, setModal] = useState(1000);
  const [risikoPersen, setRisikoPersen] = useState(1);
  const [kaliAtr, setKaliAtr] = useState(1.5);
  const [rr, setRr] = useState(2);

  const [posisi, setPosisi] = useState<PosisiReplay | null>(null);
  const [trade, setTrade] = useState<TradeReplay[]>([]);
  const [pesan, setPesan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  /* 'demo' = latihan di atas bar replay. 'real' = order sungguhan ke Binance
     lewat VPS sendiri. Dipisah tegas, dan bawaannya demo — halaman latihan
     yang diam-diam bisa mengirim uang sungguhan adalah rancangan yang salah. */
  const [mode, setMode] = useState<'demo' | 'real'>('demo');

  /* ── Pulihkan sesi ──────────────────────────────────────────────────
     Dijalankan saat simbol/timeframe berganti, bukan sekali di awal:
     tiap pasangan simbol+TF punya sesinya sendiri, dan berpindah ke BTC 4
     jam harus memunculkan posisi BTC 4 jam, bukan sisa dari ETH 5 menit. */
  const dimuat = useRef('');
  useEffect(() => {
    const kunci = `${simbol}|${tf}`;
    if (dimuat.current === kunci) return;
    dimuat.current = kunci;
    const s = bacaSesi(simbol, tf);
    setPosisi(s?.posisi ?? null);
    setTrade(s?.trade ?? []);
    setModal(s?.modal ?? 1000);
    setMain(false);
    if (s?.idx != null) setIdx(s.idx);
  }, [simbol, tf, setIdx]);

  /* Simpan tiap kali ada yang berubah. Sesi replay kecil (puluhan baris),
     jadi menulisnya utuh lebih sederhana dan lebih aman daripada menambal
     sebagian — dan tidak ada jalur yang bisa lupa ikut menyimpan. */
  useEffect(() => {
    if (dimuat.current !== `${simbol}|${tf}`) return;
    simpanSesi(simbol, tf, { idx, posisi, trade, modal });
  }, [simbol, tf, idx, posisi, trade, modal]);

  const ringkas = ringkasReplay(trade, modal);
  const hidup = idx !== null;
  const hargaKini = hidup ? lilin.closes[idx] : undefined;

  /* ── Jalan otomatis ─────────────────────────────────────────────────
     Interval, bukan requestAnimationFrame: yang diinginkan adalah satu bar
     per satuan waktu yang bisa diprediksi, bukan sehalus mungkin. */
  useEffect(() => {
    if (!main || idx === null) return;
    const ms = KECEPATAN.find((k) => k.x === cepat)?.ms ?? 250;
    const jam = setInterval(() => {
      setIdx(idx + 1 >= lilin.closes.length ? lilin.closes.length - 1 : idx + 1);
      if (idx + 1 >= lilin.closes.length - 1) setMain(false);
    }, ms);
    return () => clearInterval(jam);
  }, [main, cepat, idx, lilin.closes.length, setIdx]);

  /* ── Periksa SL/TP tiap bar maju ────────────────────────────────────
     Dijalankan sebagai efek pada perubahan `idx`, bukan di dalam pemutar:
     dengan begitu melangkah manual dan melompat lewat klik pun ikut
     diperiksa, bukan cuma saat diputar otomatis. */
  useEffect(() => {
    if (!posisi || idx === null) return;
    const kena = periksaKena(posisi, lilin, idx);
    if (!kena) return;
    const pnl = hitungPnl(posisi, kena.harga);
    setTrade((d) => [...d, {
      ...posisi, no: d.length + 1,
      keluarIdx: idx, keluar: kena.harga, sebab: kena.kena, pnl,
      masukWaktu: lilin.times[posisi.masukIdx], keluarWaktu: lilin.times[idx],
    }]);
    setPosisi(null);
    setPesan(`${kena.kena} kena di ${fHarga(kena.harga)} — ${uang(pnl, true)}`);
  }, [idx, posisi, lilin]);

  /* Aksi dikirim ke halaman tiap kali keadaannya berubah. */
  /* Tombol BUY/SELL SELALU tersedia, bahkan sebelum replay dimulai.
     ────────────────────────────────────────────────────────────────────
     Menyembunyikannya sampai tombol replay ditekan berarti dua perbuatan
     untuk satu maksud, dan yang kedua tidak menambah apa pun: entry di harga
     terakhir sama sahnya dengan entry di bar replay. Kalau replay belum
     jalan, posisinya dibuka di bar TERAKHIR — dan itu memang keadaan pasar
     yang sedang berlangsung.

     Mode `real` tidak mengirim aksi: order sungguhan punya kotaknya sendiri
     dengan konfirmasi yang menyebut angka, dan tombol satu-klik di pojok
     chart bukan tempat untuk uang sungguhan. */
  const idxAktif = idx ?? Math.max(0, lilin.closes.length - 1);
  const hargaAktif = lilin.closes[idxAktif];

  useEffect(() => {
    if (!aturAksi) return;
    if (mode !== 'demo' || !lilin.closes.length) { aturAksi(null); return; }
    aturAksi({
      posisi: posisi
        ? { arah: posisi.arah, masuk: posisi.masuk, sl: posisi.sl, tp: posisi.tp,
            pnl: hargaAktif === undefined ? 0 : hitungPnl(posisi, hargaAktif) }
        : null,
      hargaKini: hargaAktif,
      buka, tutup: tutupManual, mati: false,
    });
    return () => aturAksi(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, idx, posisi, hargaAktif, lilin.closes.length, aturAksi]);

  /* Garis entry/SL/TP dikirim ke chart. */
  useEffect(() => {
    aturGaris(posisi ? [
      { harga: posisi.masuk, warna: '#a1a1aa', label: 'Entry' },
      { harga: posisi.sl, warna: '#f87171', label: 'SL' },
      { harga: posisi.tp, warna: '#10b981', label: 'TP' },
    ] : []);
  }, [posisi, aturGaris]);

  /* Mulai di 60% data: cukup bar di belakang untuk indikator matang, dan
     masih menyisakan 40% untuk dijalankan.

     Trade yang sudah tercatat TIDAK dihapus di sini. Memulai ulang putarannya
     bukan alasan untuk membuang catatan latihan — itu perbuatan terpisah,
     dan tombolnya ada sendiri. */
  const mulai = useCallback(() => {
    setIdx(Math.floor(lilin.closes.length * 0.6));
    setPosisi(null); setPesan(''); setMain(false);
  }, [lilin.closes.length, setIdx]);

  function bersihkan() {
    if (!confirm(`Hapus ${trade.length} catatan latihan untuk ${simbol} ${tf}?\n\nPosisi yang sedang terbuka ikut dibatalkan.`)) return;
    setTrade([]); setPosisi(null); setPesan('Catatan latihan dihapus.');
    hapusSesi(simbol, tf);
  }

  /* Keluar TIDAK membatalkan posisi. Menutup panelnya bukan pernyataan
     bahwa posisinya ditutup — posisi tetap terbuka dan menunggu, persis
     seperti kalau kamu menutup tab. */
  const keluar = useCallback(() => {
    setIdx(null); setMain(false); aturGaris([]);
  }, [setIdx, aturGaris]);

  function buka(arah: 'BUY' | 'SELL') {
    if (posisi || !lilin.closes.length) return;
    const h = lilin.closes[idxAktif];
    /* Level dari kartu screener dipakai kalau ada DAN masih masuk akal untuk
       arah yang dipilih — SL di atas harga untuk BUY berarti kartunya untuk
       arah sebaliknya, dan memakainya akan membuka posisi yang langsung
       salah. Kalau tidak dipakai, jatuh ke usulan ATR. */
    const sahUsul = usulSl && usulTp
      && (arah === 'BUY' ? usulSl < h && usulTp > h : usulSl > h && usulTp < h);
    const dariAtr = usulSlTp(lilin, idxAktif, arah, kaliAtr, rr);
    const sl = sahUsul ? usulSl! : dariAtr.sl;
    const tp = sahUsul ? usulTp! : dariAtr.tp;
    if (!sl || !tp) { setPesan('ATR belum matang di bar ini — maju beberapa bar dulu.'); return; }
    const risiko = (modal + ringkas.bersih) * (risikoPersen / 100);
    const unit = risiko / Math.abs(h - sl);
    setPosisi({ id: 'p' + Date.now(), arah, masukIdx: idxAktif, masuk: h, sl, tp, unit, risiko });
    setPesan(`${arah} di ${fHarga(h)} · SL ${fHarga(sl)} · TP ${fHarga(tp)}`);
  }

  function tutupManual() {
    if (!posisi || !lilin.closes.length) return;
    const h = lilin.closes[idxAktif];
    const pnl = hitungPnl(posisi, h);
    setTrade((d) => [...d, {
      ...posisi, no: d.length + 1,
      keluarIdx: idxAktif, keluar: h, sebab: 'Manual', pnl,
      masukWaktu: lilin.times[posisi.masukIdx], keluarWaktu: lilin.times[idxAktif],
    }]);
    setPosisi(null);
    setPesan(`Ditutup manual di ${fHarga(h)} — ${uang(pnl, true)}`);
  }

  /* ── Simpan hasil latihan ke jurnal ─────────────────────────────────
     Ditandai "Latihan replay" pada alasannya. Kalau tidak ditandai, hasil
     latihan bercampur dengan transaksi sungguhan di statistik jurnal — dan
     winrate yang dipakai menilai diri sendiri jadi tidak berarti apa-apa. */
  async function simpanKeJurnal() {
    if (!trade.length) return;
    setMenyimpan(true); setPesan('');
    try {
      for (const t of trade) {
        await simpanTrade({
          sumber: 'kripto', pair: simbol, arah: t.arah,
          lot: Number(t.unit.toFixed(6)),
          masukHarga: t.masuk, keluarHarga: t.keluar, pnl: t.pnl,
          waktu: t.keluarWaktu,
          emosiMasuk: 'Netral', emosiEvaluasi: 'Netral',
          alasan: `Latihan replay · keluar ${t.sebab}`,
          catatan: `Replay ${simbol} — bukan transaksi sungguhan.`,
        });
      }
      setPesan(`${trade.length} transaksi latihan tersimpan ke jurnal, bertanda "Latihan replay".`);
    } catch (e) {
      setPesan('Gagal menyimpan: ' + (e instanceof Error ? e.message : 'tidak diketahui'));
    } finally { setMenyimpan(false); }
  }

  const majuSatu = () => idx !== null && setIdx(Math.min(lilin.closes.length - 1, idx + 1));

  /* Spasi = main/jeda, panah kanan = maju satu bar. Kebiasaan yang sama
     dengan pemutar mana pun; tanpa itu latihan jadi urusan mouse. */
  const refMain = useRef(main);
  refMain.current = main;
  useEffect(() => {
    if (!hidup) return;
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); setMain(!refMain.current); }
      if (e.code === 'ArrowRight') { e.preventDefault(); majuSatu(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  /* Kendali putar dikirim ke halaman untuk ditumpangkan DI ATAS grafik.
     Latarnya tembus supaya menyatu — panel terpisah di bawah chart memaksa
     mata bolak-balik antara grafik dan tombol untuk satu perbuatan yang
     sama. */
  const kendali = idx === null ? null : (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-3 py-2 backdrop-blur-sm">
{/* Kendali putar */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setMain(!main)}
          className="flex size-9 cursor-pointer items-center justify-center rounded-md bg-zinc-100 text-zinc-950 transition-colors hover:bg-white">
          {main ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button onClick={majuSatu} title="Maju satu bar (→)"
          className="flex size-9 cursor-pointer items-center justify-center rounded-md border border-zinc-800 text-zinc-300 transition-colors hover:border-zinc-700">
          <SkipForward className="size-4" />
        </button>
        <button onClick={mulai} title="Ulang dari awal"
          className="flex size-9 cursor-pointer items-center justify-center rounded-md border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200">
          <RotateCcw className="size-4" />
        </button>
        <div className="flex overflow-hidden rounded-md border border-zinc-800">
          {KECEPATAN.map((k) => (
            <button key={k.x} onClick={() => setCepat(k.x)}
              className={cn('cursor-pointer px-2 py-1.5 text-[11.5px] transition-colors',
                cepat === k.x ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200')}>
              {k.x}×
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11.5px] text-zinc-600">spasi = main/jeda · → = maju</span>
      </div>

      {/* Bilah kemajuan — juga berfungsi sebagai penggeser */}
      <input type="range" min={20} max={lilin.closes.length - 1} value={idx}
             onChange={(e) => setIdx(Number(e.target.value))}
             aria-label="Posisi replay"
             className="mt-3 w-full cursor-pointer accent-zinc-200" />
    </div>
  );

  useEffect(() => {
    aturKendali?.(kendali);
    return () => aturKendali?.(null);
  });

  const Bungkus = ({ anak, kelas }: { anak: React.ReactNode; kelas?: string }) =>
    tanpaBingkai ? <div>{anak}</div> : <Panel className={kelas}>{anak}</Panel>;

  if (!tampil) return null;

  if (!hidup) {
    return (
      <Bungkus kelas="mt-4" anak={<>
        <PanelHead
          judul="Replay"
          sub="Putar ulang pasar bar demi bar, lalu latih entry-nya."
          kanan={
            <button onClick={mulai} disabled={lilin.closes.length < 80}
              className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
              <Play className="size-3.5" /> Mulai Replay
            </button>
          }
        />
        <p className="px-5 pb-5 text-[12px] leading-relaxed text-zinc-500">
          Chart berhenti di satu titik lalu berjalan maju satu bar per waktu — bar berikutnya
          <span className="text-zinc-400"> tidak terlihat</span>, persis seperti pasar berjalan.
          Buka BUY/SELL dengan SL &amp; TP, dan saat harga menyentuh salah satunya posisinya
          tercatat sendiri lengkap dengan hasilnya.
          <span className="mt-1.5 block text-zinc-600">
            Indikator digambar di TradingView; yang dilatih di sini eksekusinya.
            Klik bar mana pun di chart untuk melompat ke situ.
          </span>
        </p>
      </>} />
    );
  }

  return (
    <Bungkus kelas="mt-4 border-emerald-500/25" anak={<>
      <PanelHead
        judul="Replay berjalan"
        sub={`Bar ${idx + 1} dari ${lilin.closes.length} · ${tanggalPendek(lilin.times[idx])}`}
        kanan={
          <button onClick={keluar}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200">
            <X className="size-3.5" /> Keluar
          </button>
        }
      />

      {/* Eksekusi */}
      <div className="border-t border-zinc-800/80 px-5 py-4">
        {/* Pilihan mode. Order sungguhan TIDAK memakai bar replay: ia dikirim
            ke pasar sekarang, di harga sekarang. Menempatkan keduanya di
            saklar yang sama membuat perbedaan itu terlihat, bukan tersembunyi. */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-zinc-800">
            {([['demo', 'Demo order'], ['real', 'Real order']] as const).map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                className={cn('cursor-pointer px-3 py-1.5 text-[11.5px] transition-colors',
                  mode === m
                    ? (m === 'real' ? 'bg-red-500/20 text-red-300' : 'bg-zinc-100 text-zinc-950')
                    : 'text-zinc-400 hover:text-zinc-200')}>
                {label}
              </button>
            ))}
          </div>
          <span className="text-[11.5px] text-zinc-600">
            {mode === 'demo'
              ? 'Latihan di atas bar replay — tidak ada uang yang bergerak.'
              : 'Dikirim ke Binance lewat VPS-mu, di harga pasar sekarang.'}
          </span>
        </div>

        {mode === 'real' ? (
          <KotakOrderNyata simbol={simbol} hargaKini={lilin.closes[lilin.closes.length - 1]} />
        ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">Modal ($)</label>
            <input type="number" value={modal} onChange={(e) => setModal(Number(e.target.value) || 0)} className={cn(KELAS_ISIAN, 'angka')} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">Risiko (%)</label>
            <input type="number" step={0.25} value={risikoPersen} onChange={(e) => setRisikoPersen(Number(e.target.value) || 0)} className={cn(KELAS_ISIAN, 'angka')} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">SL (× ATR)</label>
            <input type="number" step={0.1} value={kaliAtr} onChange={(e) => setKaliAtr(Number(e.target.value) || 0)} className={cn(KELAS_ISIAN, 'angka')} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">R : R</label>
            <input type="number" step={0.5} value={rr} onChange={(e) => setRr(Number(e.target.value) || 0)} className={cn(KELAS_ISIAN, 'angka')} />
          </div>

          {posisi ? (
            <button onClick={tutupManual}
              className="mt-[18px] flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 text-[12px] font-medium text-zinc-100 transition-colors hover:bg-zinc-700 sm:col-span-2">
              Tutup posisi di {fHarga(hargaKini ?? 0)}
            </button>
          ) : (
            <>
              <button onClick={() => buka('BUY')}
                className="mt-[18px] flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-emerald-500/15 text-[12px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25">
                <TrendingUp className="size-3.5" /> BUY
              </button>
              <button onClick={() => buka('SELL')}
                className="mt-[18px] flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-red-500/15 text-[12px] font-semibold text-red-400 transition-colors hover:bg-red-500/25">
                <TrendingDown className="size-3.5" /> SELL
              </button>
            </>
          )}
        </div>
        )}

        {mode === 'demo' && posisi && (
          <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-zinc-800/60 p-3 text-[12px]">
            <span className={cn('rounded px-1.5 py-0.5 text-[10px]',
              posisi.arah === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400')}>
              {posisi.arah}
            </span>
            <span className="text-zinc-500">Entry <span className="angka text-zinc-300">{fHarga(posisi.masuk)}</span></span>
            <span className="text-zinc-500">SL <span className="angka text-red-400">{fHarga(posisi.sl)}</span></span>
            <span className="text-zinc-500">TP <span className="angka text-emerald-500">{fHarga(posisi.tp)}</span></span>
            <span className="text-zinc-500">Risiko <span className="angka text-zinc-300">{uang(posisi.risiko)}</span></span>
            {hargaKini !== undefined && (
              <span className="ml-auto text-zinc-500">
                Floating{' '}
                <span className={cn('angka', hitungPnl(posisi, hargaKini) >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                  {uang(hitungPnl(posisi, hargaKini), true)}
                </span>
              </span>
            )}
          </div>
        )}

        {pesan && <div className="mt-2 text-[12px] text-zinc-400">{pesan}</div>}
      </div>

      {/* Hasil latihan */}
      {trade.length > 0 && (
        <div className="border-t border-zinc-800/80 px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-4 text-[12.5px]">
            <span className="text-zinc-500">Trade <span className="angka text-zinc-200">{ringkas.jumlah}</span></span>
            <span className="text-zinc-500">Winrate <span className="angka text-zinc-200">{persen(ringkas.winrate)}</span></span>
            <span className="text-zinc-500">P/L{' '}
              <span className={cn('angka', ringkas.bersih >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {uang(ringkas.bersih, true)}
              </span>
            </span>
            <span className="text-zinc-500">Ekuitas <span className="angka text-zinc-200">{uang(ringkas.ekuitas)}</span></span>
            <span className="text-zinc-500">PF{' '}
              <span className="angka text-zinc-200">
                {ringkas.faktorProfit === null ? '—' : ringkas.faktorProfit === Infinity ? '∞' : ringkas.faktorProfit.toFixed(2)}
              </span>
            </span>
            <span className="ml-auto flex items-center gap-2">
              <button onClick={bersihkan}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-500 transition-colors hover:border-red-500/30 hover:text-red-400">
                <Trash2 className="size-3.5" /> Hapus catatan
              </button>
              <button onClick={() => void simpanKeJurnal()} disabled={menyimpan}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-50">
                {menyimpan ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Simpan ke jurnal
              </button>
            </span>
          </div>

          <TabelBungkus className="max-h-[220px] overflow-y-auto">
            <Tabel>
              <thead className="sticky top-0 bg-zinc-950">
                <tr>
                  <Th>#</Th><Th>Arah</Th><Th className="text-right">Entry</Th>
                  <Th className="text-right">Keluar</Th><Th>Sebab</Th><Th className="text-right">P/L</Th>
                </tr>
              </thead>
              <tbody>
                {[...trade].reverse().map((t) => (
                  <Tr key={t.id + t.no}>
                    <Td className="angka text-zinc-600">{t.no}</Td>
                    <Td><span className={cn('text-[11.5px]', t.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>{t.arah}</span></Td>
                    <Td className="angka text-right text-zinc-400">{fHarga(t.masuk)}</Td>
                    <Td className="angka text-right text-zinc-400">{fHarga(t.keluar)}</Td>
                    <Td><span className={cn('rounded px-1.5 py-0.5 text-[10px]',
                      t.sebab === 'TP' ? 'bg-emerald-500/10 text-emerald-500'
                        : t.sebab === 'SL' ? 'bg-red-500/10 text-red-400'
                        : 'bg-zinc-800 text-zinc-400')}>{t.sebab}</span></Td>
                    <Td className={cn('angka text-right', t.pnl >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                      {uang(t.pnl, true)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tabel>
          </TabelBungkus>
        </div>
      )}
    </>} />
  );
}
