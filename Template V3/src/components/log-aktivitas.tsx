import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, SkipForward, XCircle, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { bukaIsi, type RingkasAnalisa, type IsiAnalisa } from '@/lib/analisa';
import { bacaLogCopy } from '@/lib/pengikut-copy';
import { bacaLangganan } from '@/lib/copy-langganan';

/* ════════════════════════════════════════════════════════════════════════
   LOG AKTIVITAS — apa yang dilakukan analis ini, urut waktu
   ════════════════════════════════════════════════════════════════════════
   Rak-rak di bawahnya menjawab "apa KEADAAN tiap sinyal sekarang". Log ini
   menjawab pertanyaan yang berbeda: "apa yang TERJADI, kapan" — posting
   market order, memasang pending, menarik rencana. Keadaan bisa dibaca
   kapan saja; kejadian hilang begitu lewat kalau tidak ada yang
   mencatatnya urut.

   INI BUKAN DATA BARU. Setiap barisnya diturunkan dari sinyal yang sama
   yang dibaca pengikut otomatis tiap menit — dibuat, jenisEntry, hasil,
   waktuHasil. Sengaja begitu: log yang punya sumber sendiri bisa
   menyimpang dari yang benar-benar dieksekusi, dan log yang menyimpang
   lebih buruk daripada tidak ada log. Yang tampil di sini dan yang ditiru
   sistem adalah SATU hal.

   Karena itu pula, untuk yang MENGIKUTI analisnya, tiap kejadian membawa
   nasib salinannya sendiri di bawahnya — terkirim, dilewati, atau gagal,
   dengan alasannya. Dua kolom yang sama-sama urut waktu: yang dilakukan
   analisnya, dan yang dilakukan sistem atas namamu.
   ════════════════════════════════════════════════════════════════════════ */

interface Kejadian {
  kunci: string;
  waktu: number;
  jenis: 'posting' | 'batal' | 'selesai';
  s: RingkasAnalisa;
}

function jamTanggal(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

const RUPA_COPY = {
  terkirim: { Ikon: CheckCircle2, warna: 'text-emerald-500' },
  dilewati: { Ikon: SkipForward, warna: 'text-zinc-500' },
  gagal: { Ikon: XCircle, warna: 'text-red-400' },
} as const;

export function LogAktivitas({ sinyal }: { sinyal: RingkasAnalisa[] }) {
  const { pengguna } = useAuth();
  const [buka, setBuka] = useState(false);
  const [bukaBaris, setBukaBaris] = useState<string | null>(null);
  /* Level per sinyal, diambil SAAT barisnya dibuka — bukan dimuka untuk
     semua. Log berisi puluhan sinyal dan tiap level satu permintaan ke
     server; memuat semuanya demi baris yang tidak pernah dibuka adalah
     harga yang dibayar semua orang untuk kebutuhan segelintir. Sinyal
     berbayar yang belum dibeli ditolak server — dan penolakan itu
     ditampilkan apa adanya. */
  const [level, setLevel] = useState<Record<string, IsiAnalisa | string>>({});

  const analisUid = sinyal[0]?.uid;
  const diikuti = !!pengguna && !!analisUid && !!bacaLangganan(pengguna.uid, analisUid);

  const kejadian = useMemo(() => {
    const k: Kejadian[] = [];
    for (const s of sinyal) {
      k.push({ kunci: s.id + '|posting', waktu: s.dibuat, jenis: 'posting', s });
      if (s.hasil === 'batal' && s.waktuHasil) {
        k.push({ kunci: s.id + '|batal', waktu: s.waktuHasil, jenis: 'batal', s });
      } else if ((s.hasil === 'tp' || s.hasil === 'sl') && s.waktuHasil) {
        k.push({ kunci: s.id + '|selesai', waktu: s.waktuHasil, jenis: 'selesai', s });
      }
    }
    return k.sort((a, b) => b.waktu - a.waktu);
  }, [sinyal]);

  /* Nasib salinan per sinyal, HANYA milik yang sedang masuk. Log pengikut
     dibatasi 40 kejadian terakhir, jadi sinyal lama tidak lagi punya
     catatan — barisnya cuma tidak diberi keterangan, bukan diberi tebakan. */
  const salinan = useMemo(() => {
    const m = new Map<string, { hasil: 'terkirim' | 'dilewati' | 'gagal'; sebab: string }>();
    for (const e of bacaLogCopy(pengguna?.uid)) {
      if (!m.has(e.sinyal)) m.set(e.sinyal, { hasil: e.hasil, sebab: e.sebab });
    }
    return m;
    /* kejadian sebagai kunci hitung ulang: daftar sinyal berubah = mungkin
       ada catatan baru juga. */
  }, [pengguna?.uid, kejadian]);

  if (kejadian.length === 0) return null;

  async function bukaLevel(id: string) {
    if (level[id] !== undefined) return;
    try {
      const { isi } = await bukaIsi(id);
      setLevel((l) => ({ ...l, [id]: isi }));
    } catch (e) {
      setLevel((l) => ({ ...l, [id]: e instanceof Error ? e.message : 'Level tidak bisa dibuka.' }));
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-zinc-800/60">
      <button type="button" onClick={() => setBuka((b) => !b)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-zinc-900/40">
        <ScrollText className="size-3.5 text-zinc-500" />
        <span className="text-[12.5px] font-medium text-zinc-200">Log Aktivitas</span>
        <span className="text-[11px] text-zinc-500">
          {kejadian.length} kejadian
          {diikuti && ' · ditiru otomatis ke akunmu'}
        </span>
        {buka ? <ChevronUp className="ml-auto size-3.5 text-zinc-500" />
              : <ChevronDown className="ml-auto size-3.5 text-zinc-500" />}
      </button>

      {buka && (
        <div className="border-t border-zinc-800/60 px-3 py-2">
          <p className="mb-2 text-[10.5px] leading-relaxed text-zinc-600">
            Log ini diturunkan dari data sinyal yang sama yang dibaca sistem penyalin
            tiap menit — yang tampil di sini dan yang ditiru ke akun pengikut adalah
            satu hal, bukan dua catatan yang bisa menyimpang.
          </p>
          <div className="gulir-senyap max-h-[340px] space-y-0.5 overflow-y-auto">
            {kejadian.map((k) => {
              const s = k.s;
              const nasib = k.jenis === 'posting' ? salinan.get(s.id) : undefined;
              const isi = level[s.id];
              const terbuka = bukaBaris === k.kunci;
              return (
                <div key={k.kunci} className="rounded-md px-1.5 py-1.5 transition-colors hover:bg-zinc-900/40">
                  <button type="button"
                    onClick={() => {
                      setBukaBaris(terbuka ? null : k.kunci);
                      if (!terbuka && k.jenis !== 'batal') void bukaLevel(s.id);
                    }}
                    className="flex w-full cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-0.5 text-left">
                    <span className="angka shrink-0 text-[10.5px] text-zinc-600">{jamTanggal(k.waktu)}</span>
                    <span className={cn('shrink-0 text-[11px] font-medium',
                      k.jenis === 'batal' ? 'text-amber-400/90'
                        : k.jenis === 'selesai' ? (s.hasil === 'tp' ? 'text-emerald-500' : 'text-red-400')
                        : 'text-zinc-300')}>
                      {k.jenis === 'batal' ? 'Cancel order'
                        : k.jenis === 'selesai' ? (s.hasil === 'tp' ? 'Kena TP' : 'Kena SL')
                        : !s.jenisEntry ? 'Posting order'
                        : /^market$/i.test(s.jenisEntry) ? 'Market order'
                        : `Pending order · ${s.jenisEntry}`}
                    </span>
                    <span className="text-[11.5px] text-zinc-200">{s.pasangan.replace(/^MT5:/i, '')}</span>
                    <span className={cn('text-[10.5px]', s.arah === 'BUY' ? 'text-emerald-500' : 'text-red-400')}>
                      {s.arah}
                    </span>
                    <span className="rounded bg-zinc-800/80 px-1 text-[9px] uppercase tracking-wide text-zinc-500">
                      {s.pasar === 'kripto' || /USDT$/i.test(s.pasangan) ? 'Kripto' : 'Trade-Fi'}
                    </span>
                    {k.jenis === 'posting' && s.harga > 0 && (
                      <span className="angka text-[10.5px] text-zinc-500">@ {s.harga}</span>
                    )}
                  </button>

                  {/* Nasib salinannya SENDIRI, di bawah kejadiannya — bukan
                      di halaman lain. Pertanyaan "sinyal itu masuk ke akunku
                      atau tidak" muncul di sini, saat membaca kejadiannya. */}
                  {nasib && (() => {
                    const { Ikon, warna } = RUPA_COPY[nasib.hasil];
                    return (
                      <div className="mt-0.5 flex items-start gap-1.5 pl-1">
                        <Ikon className={cn('mt-px size-3 shrink-0', warna)} />
                        <span className="text-[10.5px] leading-snug text-zinc-500">{nasib.sebab}</span>
                      </div>
                    );
                  })()}

                  {terbuka && k.jenis === 'batal' && s.alasanBatal && (
                    <p className="mt-1 pl-1 text-[10.5px] leading-snug text-zinc-500">
                      Alasan: {s.alasanBatal}
                    </p>
                  )}
                  {terbuka && k.jenis !== 'batal' && (
                    typeof isi === 'string'
                      ? <p className="mt-1 pl-1 text-[10.5px] text-zinc-600">{isi}</p>
                      : isi
                        ? <div className="angka mt-1 flex flex-wrap gap-x-4 pl-1 text-[10.5px]">
                            <span className="text-zinc-500">Entry <span className="text-zinc-300">{isi.entry}</span></span>
                            <span className="text-zinc-500">SL <span className="text-red-400/90">{isi.sl || '—'}</span></span>
                            <span className="text-zinc-500">TP <span className="text-emerald-500/90">{isi.tp || '—'}</span></span>
                          </div>
                        : <p className="mt-1 pl-1 text-[10.5px] text-zinc-600">Memuat level…</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
