import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Plus, Star } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { Memuat } from '@/components/memuat';
import { DaftarLipat, NomorBaris } from '@/components/daftar-lipat';
import { cn } from '@/lib/utils';
import { ambilJejak, tulisUsd, type BarisJejak } from '@/lib/coin-listing';

/* ════════════════════════════════════════════════════════════════════════
   LINTASAN — bukan potret
   ════════════════════════════════════════════════════════════════════════
   Panel ini mengurutkan dari ARAH, bukan dari ukuran. Alasannya satu contoh
   nyata yang terjadi saat alat ini dibangun, 2 Sep 2026:

     CATE/SOL lolos saringan potret dengan likuiditas TERBESAR di antara
     semua kandidat ($1,77 jt) dan rasio volume/likuiditas yang sehat.
     Riwayat hariannya: volume runtuh 93% dalam sepuluh hari.

   Daftar yang diurutkan dari besarnya likuiditas akan menaruh CATE di
   puncak. Daftar ini menaruhnya di dasar — dan itulah seluruh gunanya.

   ── DUA JENIS BARIS DATA, DAN KENAPA HARUS DIBEDAKAN ────────────────────
   Harga dan volume punya riwayat yang bisa ditarik surut dari GeckoTerminal,
   jadi tren volume sudah berarti sejak hari pertama.

   Likuiditas dan jumlah pemegang TIDAK punya riwayat di mana pun — keduanya
   baru menumpuk sejak pencatat harian mulai jalan. Panel menampilkan
   "butuh N hari lagi" alih-alih menggambar garis datar yang terlihat
   seperti data padahal cuma satu titik.

   ── YANG TIDAK DIKLAIM ──────────────────────────────────────────────────
   Ini bukan peramal listing CEX. Keputusan itu komersial dan tidak punya
   jejak publik. Yang bisa dilakukan daftar ini: menjaga daftar pendek koin
   yang lintasannya naik. Kalimat itu ada di kaki panel, bukan cuma di sini.
   ════════════════════════════════════════════════════════════════════════ */

function Tren({ nilai, label, cukup }: { nilai: number | null; label: string; cukup: boolean }) {
  if (!cukup) {
    return (
      <div className="min-w-[86px]">
        <div className="text-[11px] text-zinc-600">{label}</div>
        <div className="text-[12.5px] text-zinc-700">belum cukup</div>
      </div>
    );
  }
  if (nilai === null) {
    return (
      <div className="min-w-[86px]">
        <div className="text-[11px] text-zinc-600">{label}</div>
        <div className="text-[12.5px] text-zinc-700">—</div>
      </div>
    );
  }
  return (
    <div className="min-w-[86px]">
      <div className="text-[11px] text-zinc-600">{label}</div>
      <div className={cn('angka text-[13px]',
        nilai > 5 ? 'text-emerald-300' : nilai < -5 ? 'text-red-400/90' : 'text-zinc-400')}>
        {nilai > 0 ? '+' : ''}{nilai.toFixed(0)}%
      </div>
    </div>
  );
}

/** Garis volume harian. Skalanya per-koin — yang ditanya bentuknya, bukan
 *  besarnya, dan membandingkan volume antar koin lewat tinggi garis akan
 *  menyesatkan karena ukurannya berbeda ribuan kali. */
function GarisVolume({ data }: { data: { t: string; v: number }[] }) {
  const p = data.filter((x) => Number.isFinite(x.v));
  if (p.length < 3) return null;
  const maks = Math.max(...p.map((x) => x.v)) || 1;
  const L = 200, T = 26;
  const d = p.map((x, i) => {
    const px = (i / (p.length - 1)) * L;
    const py = T - (x.v / maks) * T;
    return `${i ? 'L' : 'M'} ${px.toFixed(1)} ${py.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 -1 ${L} ${T + 2}`} preserveAspectRatio="none"
      className="h-6 w-full max-w-[220px]" aria-hidden>
      <path d={d} fill="none" stroke="#52525b" strokeWidth="1.5"
        strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function PanelJejakListing({ onPantau }: {
  /** Dipanggil saat pemilik menekan "Pantau" pada satu baris. */
  onPantau?: (jaringan: string, alamat: string) => void;
}) {
  const [koin, setKoin] = useState<BarisJejak[]>([]);
  const [muat, setMuat] = useState(true);
  const [pesan, setPesan] = useState('');
  const [diperbarui, setDiperbarui] = useState(0);

  const tarik = useCallback(async () => {
    setMuat(true); setPesan('');
    const j = await ambilJejak();
    setMuat(false);
    if (!j) { setPesan('Belum bisa membaca jejak. Coba lagi sebentar.'); return; }
    if (j.belumAda) {
      setPesan('Pencatat harian belum pernah jalan. Catatan pertamanya muncul besok pagi.');
      return;
    }
    setKoin(j.koin); setDiperbarui(j.diperbarui);
  }, []);

  useEffect(() => { void tarik(); }, [tarik]);

  return (
    <Panel className="mb-4">
      <PanelHead
        judul="Lintasan Koin DEX"
        sub="Diurutkan dari ARAH volume, bukan dari besarnya. Dicatat sekali sehari."
        kanan={
          <button onClick={() => void tarik()} aria-label="Segarkan"
            className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
            <RotateCcw className={cn('size-3.5', muat && 'animate-spin')} />
          </button>
        }
      />
      <div className="px-5 pb-5">
        {muat ? (
          <Memuat pesan="Membaca jejak…" />
        ) : pesan ? (
          <p className="py-6 text-center text-[12.5px] text-zinc-600">{pesan}</p>
        ) : !koin.length ? (
          <p className="py-6 text-center text-[12.5px] text-zinc-600">
            Belum ada koin yang tercatat.
          </p>
        ) : (
          <>
            <DaftarLipat
              data={koin}
              batasAwal={6}
              kosong={null}
              render={(k, no) => {
                /* Likuiditas & pemegang butuh baris yang KITA ukur sendiri.
                   Dua titik minimum untuk bicara soal arah. */
                const cukupLangsung = k.hariLangsung >= 2;
                return (
                  <div key={k.jaringan + k.alamat}
                    className={cn('rounded-lg border p-3',
                      k.milikPemilik ? 'border-zinc-700 bg-zinc-900/40' : 'border-zinc-800/60')}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <NomorBaris no={no} />
                          <span className="truncate text-[13px] text-zinc-200">
                            {k.simbol || k.nama || k.alamat.slice(0, 10)}
                          </span>
                          {k.milikPemilik && (
                            <span className="flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[10.5px] text-zinc-300">
                              <Star className="size-2.5" /> dipantau
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] text-zinc-500">
                          <span className="text-zinc-400">{k.jaringan}</span>
                          {k.dex && <span>· {k.dex}</span>}
                          {k.umurKolamHari != null && <span>· kolam {k.umurKolamHari} hari</span>}
                          <span>· likuiditas {tulisUsd(k.likuiditas || 0)}</span>
                          <span>· {k.hariTotal} hari data</span>
                        </div>
                        <div className="mt-2"><GarisVolume data={k.riwayat.map((r: { t: string; v: number }) => ({ t: r.t, v: r.v }))} /></div>
                      </div>

                      <div className="flex flex-wrap items-start gap-4">
                        <Tren label="Volume 7h" nilai={k.trenVolume} cukup />
                        <Tren label="Likuiditas 14h" nilai={k.trenLikuiditas} cukup={cukupLangsung} />
                        <Tren label="Pemegang 14h" nilai={k.trenPemegang} cukup={cukupLangsung} />
                        {!k.milikPemilik && onPantau && (
                          <button onClick={() => onPantau(k.jaringan, k.alamat)}
                            className="mt-3 flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11.5px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200">
                            <Plus className="size-3" /> Pantau
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <p className="mt-4 border-t border-zinc-800/60 pt-3 text-[11.5px] leading-relaxed text-zinc-600">
              Daftar ini <strong className="font-medium text-zinc-500">tidak meramalkan listing CEX</strong> —
              keputusan itu komersial dan tidak punya jejak publik. Yang bisa dilakukannya: menjaga daftar
              pendek koin yang lintasannya naik, supaya kalau listing terjadi peluangnya lebih besar datang
              dari sini. Tren likuiditas dan pemegang baru terisi setelah pencatat berjalan beberapa hari —
              keduanya tidak punya riwayat yang bisa ditarik surut.
              {diperbarui > 0 && (
                <> Terakhir dicatat {new Date(diperbarui).toLocaleString('id-ID',
                  { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.</>
              )}
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}
