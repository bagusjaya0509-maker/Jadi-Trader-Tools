import { useEffect, useRef, useState } from 'react';
import { Code2, Play, Trash2, TriangleAlert, CheckCircle2, RotateCcw, Settings2 } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import { jalankanPine, CONTOH_PINE, type HasilPine, type InputPine } from '@/lib/pine';
import type { Lilin } from '@/lib/pasar';

/* ════════════════════════════════════════════════════════════════════════
   PANEL PINE SCRIPT
   ════════════════════════════════════════════════════════════════════════
   Tempel indikator Pine, jalankan, dan hasil `plot()`-nya digambar di chart
   yang sama dengan harga.

   Skripnya disimpan per perangkat: indikator yang sedang dikembangkan tidak
   seharusnya hilang karena tab tertutup.

   SETELAN INPUT — dialog ala TradingView, bukan menyunting skrip.
   ──────────────────────────────────────────────────────────────────────
   Setiap input.* yang ditemukan mesin didaftar berikut judul, grup, jenis,
   dan nilai bawaannya, lalu digambar di sini sebagai centang / angka /
   pemilih warna. Alasannya praktis: skrip yang ditulis untuk latar terang
   TradingView sering memakai garis hitam — di chart gelap kita garis itu
   ADA tapi tak terlihat, dan satu-satunya obat yang wajar adalah mengganti
   warnanya tanpa menyentuh kodenya.
   ════════════════════════════════════════════════════════════════════════ */

const KUNCI = 'jt.pineKode';
const KUNCI_INPUT = 'jt.pineInput';

type NilaiSetelan = number | boolean | string;

function KontrolInput({ inp, nilai, atur }: {
  inp: InputPine;
  nilai: NilaiSetelan | undefined;
  atur: (v: NilaiSetelan) => void;
}) {
  const v = nilai !== undefined ? nilai : inp.bawaan;

  if (inp.jenis === 'bool') {
    return (
      <label className="flex cursor-pointer items-center gap-2 py-0.5 text-[12px] text-zinc-300">
        <input type="checkbox" checked={!!v} onChange={(e) => atur(e.target.checked)}
               className="size-3.5 shrink-0 cursor-pointer accent-emerald-500" />
        <span className="truncate" title={inp.judul}>{inp.judul}</span>
      </label>
    );
  }

  if (inp.jenis === 'color') {
    const s = typeof v === 'string' ? v : '#a1a1aa';
    const dasar = /^#[0-9a-fA-F]{6}/.test(s) ? s.slice(0, 7) : '#a1a1aa';
    /* Transparansi bawaan skrip DIPERTAHANKAN saat warnanya diganti — zona
       yang 70% tembus pandang harus tetap tembus dengan warna barunya;
       pemilih warna browser hanya tahu warna pekat. */
    const alfa = s.length === 9 ? s.slice(7)
      : typeof inp.bawaan === 'string' && inp.bawaan.length === 9 ? inp.bawaan.slice(7) : '';
    return (
      <label className="flex cursor-pointer items-center gap-2 py-0.5 text-[12px] text-zinc-300">
        <input type="color" value={dasar} onChange={(e) => atur(e.target.value + alfa)}
               className="h-5 w-8 shrink-0 cursor-pointer rounded border border-zinc-700 bg-transparent p-0" />
        <span className="truncate" title={inp.judul}>{inp.judul}</span>
      </label>
    );
  }

  if (inp.jenis === 'string' && inp.pilihan?.length) {
    return (
      <label className="flex items-center justify-between gap-2 py-0.5 text-[12px] text-zinc-300">
        <span className="truncate" title={inp.judul}>{inp.judul}</span>
        <select value={String(v ?? '')} onChange={(e) => atur(e.target.value)}
                className="h-6 shrink-0 cursor-pointer rounded border border-zinc-700 bg-zinc-900 px-1 text-[11px] text-zinc-200 outline-none">
          {inp.pilihan.map((p) => <option key={p}>{p}</option>)}
        </select>
      </label>
    );
  }

  if (inp.jenis === 'int' || inp.jenis === 'float') {
    return (
      <label className="flex items-center justify-between gap-2 py-0.5 text-[12px] text-zinc-300">
        <span className="truncate" title={inp.judul}>{inp.judul}</span>
        <input type="number" value={typeof v === 'number' ? v : Number(v) || 0}
               step={inp.jenis === 'int' ? 1 : 'any'}
               onChange={(e) => {
                 const x = Number(e.target.value);
                 if (isFinite(x)) atur(inp.jenis === 'int' ? Math.round(x) : x);
               }}
               className="angka h-6 w-[76px] shrink-0 rounded border border-zinc-700 bg-zinc-900 px-1.5 text-right text-[11px] text-zinc-200 outline-none focus-visible:border-zinc-500" />
      </label>
    );
  }

  if (inp.jenis === 'string') {
    return (
      <label className="flex items-center justify-between gap-2 py-0.5 text-[12px] text-zinc-300">
        <span className="truncate" title={inp.judul}>{inp.judul}</span>
        <input value={String(v ?? '')} onChange={(e) => atur(e.target.value)}
               className="h-6 w-[110px] shrink-0 rounded border border-zinc-700 bg-zinc-900 px-1.5 text-[11px] text-zinc-200 outline-none focus-visible:border-zinc-500" />
      </label>
    );
  }

  /* 'lain' (input.source / input.timeframe) — tidak disunting dari sini. */
  return null;
}

export function PanelPine({ lilin, tf = '4h', hingga, aturHasil }: {
  lilin: Lilin;
  tf?: string;
  /** Batas bar replay — skrip dihitung ulang HANYA sampai bar ini, jadi
   *  garis dan kotaknya mengikuti replay seperti indikator sungguhan,
   *  bukan gambar mati dari data penuh. */
  hingga?: number;
  aturHasil: (h: HasilPine | null) => void;
}) {
  const [kode, setKode] = useState(() => {
    try { return localStorage.getItem(KUNCI) ?? CONTOH_PINE; } catch { return CONTOH_PINE; }
  });
  const [hasil, setHasil] = useState<HasilPine | null>(null);
  const [buka, setBuka] = useState(false);
  const [bukaSetelan, setBukaSetelan] = useState(false);
  /* Setelan input tersimpan per perangkat, kuncinya judul input — indikator
     yang dipakai tiap hari tidak perlu diatur ulang tiap buka halaman. */
  const [setelan, setSetelan] = useState<Record<string, NilaiSetelan>>(() => {
    try { return JSON.parse(localStorage.getItem(KUNCI_INPUT) ?? '{}') as Record<string, NilaiSetelan>; }
    catch { return {}; }
  });

  function simpanKode(v: string) {
    setKode(v);
    try { localStorage.setItem(KUNCI, v); } catch { /* mode privat */ }
  }

  function taruhSetelan(kunci: string, v: NilaiSetelan) {
    setSetelan((s) => {
      const b = { ...s, [kunci]: v };
      try { localStorage.setItem(KUNCI_INPUT, JSON.stringify(b)); } catch { /* privat */ }
      return b;
    });
  }

  function kembaliBawaan(kunciDaftar: string[]) {
    setSetelan((s) => {
      const b = { ...s };
      kunciDaftar.forEach((k) => delete b[k]);
      try { localStorage.setItem(KUNCI_INPUT, JSON.stringify(b)); } catch { /* privat */ }
      return b;
    });
  }

  /* Lilin dipotong di batas replay SEBELUM skrip jalan — barstate.islast
     jatuh di bar replay, persis perilaku indikator saat bar itu "sekarang". */
  function potong(l: Lilin, batas?: number): Lilin {
    if (batas === undefined || batas >= l.closes.length - 1) return l;
    const n = batas + 1;
    return {
      opens: l.opens.slice(0, n), highs: l.highs.slice(0, n),
      lows: l.lows.slice(0, n), closes: l.closes.slice(0, n),
      times: l.times.slice(0, n),
    };
  }

  function adaKeluaran(h: HasilPine) {
    return h.plot.length || h.segmen?.length || h.penanda?.length || h.kotak?.length || h.isian?.length;
  }

  function jalankan() {
    if (!lilin.closes.length) return;
    const h = jalankanPine(kode, potong(lilin, hingga), tf, setelan);
    setHasil(h);
    /* Plot tetap dikirim ke chart meski ADA galat: skrip sepuluh baris yang
       satu barisnya salah masih menghasilkan sembilan garis yang benar, dan
       membuang semuanya membuat perbaikan jadi menebak dalam gelap. */
    aturHasil(adaKeluaran(h) ? h : null);
  }

  function bersihkan() {
    setHasil(null);
    aturHasil(null);
  }

  /* ── Ikut replay & ikut setelan ─────────────────────────────────────
     Selama skrip terpasang, bar replay yang maju ATAU setelan input yang
     diubah memicu hitung ulang — di-debounce 250 ms supaya kecepatan
     10×/30× dan seretan slider tidak menumpuk ratusan eksekusi skrip
     963 baris. */
  const hasilAktif = useRef(false);
  hasilAktif.current = hasil !== null && !!adaKeluaran(hasil);
  useEffect(() => {
    if (!hasilAktif.current || !lilin.closes.length) return;
    const jeda = setTimeout(() => {
      const h = jalankanPine(kode, potong(lilin, hingga), tf, setelan);
      setHasil(h);
      aturHasil(adaKeluaran(h) ? h : null);
    }, 250);
    return () => clearTimeout(jeda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hingga, lilin, setelan]);

  /* Input dikelompokkan menurut group= skripnya — urutan kemunculan
     dipertahankan, persis dialog setelan TradingView. */
  const kelompok: [string, InputPine[]][] = [];
  (hasil?.input ?? []).forEach((inp) => {
    if (inp.jenis === 'lain') return;
    const ada = kelompok.find(([g]) => g === inp.grup);
    if (ada) ada[1].push(inp);
    else kelompok.push([inp.grup, [inp]]);
  });

  return (
    <Panel className="mt-4">
      <PanelHead
        judul="Pine Script"
        sub="Tempel indikator, jalankan, garisnya muncul di chart di atas."
        kanan={
          <span className="flex items-center gap-2">
            {kelompok.length > 0 && (
              <button onClick={() => setBukaSetelan((v) => !v)}
                className={cn('flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors',
                  bukaSetelan ? 'border-zinc-600 text-zinc-100' : 'border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100')}>
                <Settings2 className="size-3.5" /> Input
              </button>
            )}
            <button onClick={() => setBuka((v) => !v)}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
              <Code2 className="size-3.5" /> {buka ? 'Sembunyikan' : 'Buka editor'}
            </button>
            {hasil && (
              <button onClick={bersihkan}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-500 transition-colors hover:border-red-500/30 hover:text-red-400">
                <Trash2 className="size-3.5" /> Hapus dari chart
              </button>
            )}
          </span>
        }
      />

      {/* ── Setelan input ala TradingView ── */}
      {bukaSetelan && kelompok.length > 0 && (
        <div className="border-t border-zinc-800/60 px-5 py-4">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-zinc-500">
              Setelan input skrip — perubahan langsung digambar ulang di chart, tanpa menyunting kodenya.
            </span>
            <button onClick={() => kembaliBawaan((hasil?.input ?? []).map((x) => x.kunci))}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200">
              <RotateCcw className="size-3" /> Kembalikan bawaan
            </button>
          </div>
          {kelompok.map(([grup, daftar]) => (
            <div key={grup || '(umum)'} className="mb-3 last:mb-0">
              {grup && (
                <div className="mb-1 border-b border-zinc-800/60 pb-1 text-[10.5px] font-medium uppercase tracking-wide text-zinc-600">
                  {grup}
                </div>
              )}
              <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2 xl:grid-cols-3">
                {daftar.map((inp) => (
                  <KontrolInput key={inp.kunci} inp={inp} nilai={setelan[inp.kunci]}
                                atur={(v) => taruhSetelan(inp.kunci, v)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {buka && (
        <div className="px-5 pb-5 pt-1">
          <textarea
            value={kode} onChange={(e) => simpanKode(e.target.value)} spellCheck={false} rows={14}
            className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/60 p-3 font-mono text-[11.5px] leading-relaxed text-zinc-200 outline-none focus-visible:border-zinc-600"
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={jalankan} disabled={!lilin.closes.length}
              className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50">
              <Play className="size-3.5" /> Jalankan di chart
            </button>
            <button onClick={() => simpanKode(CONTOH_PINE)}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200">
              <RotateCcw className="size-3.5" /> Contoh
            </button>
          </div>

          {hasil && (
            <div className="mt-3 space-y-2">
              {adaKeluaran(hasil) ? (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <div className="text-[12.5px] text-zinc-300">
                    {[
                      hasil.plot.length ? `${hasil.plot.length} garis` : '',
                      hasil.segmen?.length ? `${hasil.segmen.length} trendline` : '',
                      hasil.penanda?.length ? `${hasil.penanda.length} label` : '',
                      hasil.kotak?.length ? `${hasil.kotak.length} zona` : '',
                      hasil.isian?.length ? `${hasil.isian.length} isian` : '',
                    ].filter(Boolean).join(' · ')} digambar:{' '}
                    {hasil.plot.map((p) => (
                      <span key={p.judul} className="mr-2 inline-flex items-center gap-1">
                        <span className="size-2 rounded-sm" style={{ background: p.warna }} />
                        {p.judul}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {hasil.galat.length > 0 && (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-3">
                  <div className="mb-1 flex items-center gap-2 text-[12.5px] text-amber-300">
                    <TriangleAlert className="size-4" /> {hasil.galat.length} baris ditolak
                  </div>
                  <ul className="space-y-0.5 font-mono text-[11.5px] text-amber-200/80">
                    {hasil.galat.map((g) => <li key={g}>{g}</li>)}
                  </ul>
                </div>
              )}

              {hasil.dilewati.length > 0 && (
                <details className="rounded-lg border border-zinc-800/60 p-3">
                  <summary className="cursor-pointer text-[12px] text-zinc-500">
                    {hasil.dilewati.length} baris dilewati (bukan penetapan variabel atau plot)
                  </summary>
                  <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] text-zinc-600">
                    {hasil.dilewati.map((g) => <li key={g}>{g}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* Batasnya ditulis TERBUKA, bukan ditemukan sendiri saat gagal. */}
          <div className="mt-3 border-t border-zinc-800/60 pt-3 text-[11.5px] leading-relaxed text-zinc-600">
            <span className="text-zinc-400">Yang didukung:</span> model eksekusi per-bar (<span className="font-mono">var</span>,{' '}
            <span className="font-mono">if</span>/<span className="font-mono">for</span>/<span className="font-mono">while</span>,{' '}
            <span className="font-mono">:=</span>, <span className="font-mono">+=</span>, fungsi buatan, larik), riwayat{' '}
            <span className="font-mono">[n]</span>, <span className="font-mono">ta.*</span> inti,{' '}
            <span className="font-mono">math.*</span>, <span className="font-mono">input.*</span> (bisa diatur lewat tombol{' '}
            <span className="text-zinc-400">Input</span> di atas), gambar{' '}
            <span className="font-mono">line.new/copy, label.new, box.new</span> (terisi warnanya),{' '}
            <span className="font-mono">linefill.new</span> (isian antar garis — pewarna tengah channel),{' '}
            <span className="font-mono">plot</span> dengan warna bersyarat (<span className="font-mono">na</span> = sembunyi),{' '}
            <span className="font-mono">plotshape</span>, <span className="font-mono">hline</span>, plus{' '}
            <span className="font-mono">jt.smi() jt.smiSignal() jt.pivotHigh() jt.pivotLow()</span> dari perhitungan
            Screener Entry.
            <div className="mt-1.5">
              <span className="text-zinc-400">Yang belum:</span>{' '}
              <span className="font-mono">strategy.*</span>, <span className="font-mono">matrix.*</span>, tipe kustom;{' '}
              <span className="font-mono">request.security</span> dievaluasi di timeframe chart dengan catatan terbuka.
              Baris yang memakai hal di luar daftar ditolak dengan menyebut nomor barisnya — bukan diam-diam
              menghasilkan angka yang salah, karena indikator yang salah tanpa suara jauh lebih berbahaya
              daripada indikator yang menolak jalan.
            </div>
          </div>
        </div>
      )}

      {!buka && (
        <p className={cn('px-5 pb-5 text-[12px] leading-relaxed', hasil ? 'text-zinc-400' : 'text-zinc-500')}>
          {hasil
            ? `${[
                hasil.plot.length ? `${hasil.plot.length} garis` : '',
                hasil.segmen?.length ? `${hasil.segmen.length} trendline` : '',
                hasil.kotak?.length ? `${hasil.kotak.length} zona` : '',
                hasil.isian?.length ? `${hasil.isian.length} isian` : '',
              ].filter(Boolean).join(' · ') || 'Skrip'} dari skripmu sedang tergambar di chart.`
            : 'Indikator Pine milikmu bisa dijalankan langsung di chart ini — EMA, RSI, ATR, pivot, dan SMI dipakai dari perhitungan yang sama dengan Screener Entry.'}
        </p>
      )}
    </Panel>
  );
}
