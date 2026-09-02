import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw, Send, MailWarning } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { DaftarLipat, NomorBaris } from '@/components/daftar-lipat';
import { cn, tanggalPendek } from '@/lib/utils';
import {
  daftarPengingat, kirimPengingat,
  type BarisPengingat, type RingkasPengingat, type HasilKirim,
} from '@/lib/akses';

/* ════════════════════════════════════════════════════════════════════════
   PENGINGAT MASA AKSES — surat massal ke pemegang akses gratis
   ════════════════════════════════════════════════════════════════════════
   Panel ini punya satu sifat yang membedakannya dari panel lain di halaman
   ini: PEKERJAANNYA TIDAK BISA DIBATALKAN. Produk yang salah dihapus bisa
   dipulihkan dari tempat sampah, lisensi yang salah dicabut bisa
   diaktifkan lagi — surat yang sudah keluar tidak bisa ditarik kembali,
   dan surat ke daftar yang keliru merusak kepercayaan puluhan orang
   sekaligus.

   Jadi susunannya dibalik dari kebiasaan: DAFTARNYA DULU, tombolnya
   belakangan. Tidak ada "kirim ke semua" yang bisa ditekan tanpa melihat
   siapa saja. Yang dikirim adalah yang dicentang, dan yang dicentang
   adalah yang terlihat.

   ── TIGA KEADAAN YANG SENGAJA DIBEDAKAN ─────────────────────────────────
   Siap            punya alamat, belum dikirimi dalam 3 hari terakhir
   Tanpa alamat    lisensinya aktif tapi tidak ada surel sama sekali
   Baru dikirimi   dikirimi < 3 hari lalu; dicentang manual kalau memang mau

   Yang "tanpa alamat" TIDAK disembunyikan. Menyembunyikannya membuat panel
   melaporkan "22 terkirim, semua berhasil" padahal dua orang tidak pernah
   dikabari — laporan benar yang menyesatkan. Mereka ditampilkan, dimatikan,
   dan diberi alasannya.
   ════════════════════════════════════════════════════════════════════════ */

const JENDELA = [7, 14, 30, 60] as const;

function Chip({ label, nilai, nada }: {
  label: string; nilai: number; nada?: 'baik' | 'jaga' | 'diam';
}) {
  return (
    <div className="rounded-lg border border-zinc-800/60 px-3 py-2">
      <div className={cn('angka text-[17px] leading-none',
        nada === 'baik' ? 'text-emerald-300' : nada === 'jaga' ? 'text-amber-300' : 'text-zinc-300')}>
        {nilai}
      </div>
      <div className="mt-1 text-[11px] text-zinc-500">{label}</div>
    </div>
  );
}

export function PanelPengingat() {
  const [dalam, setDalam] = useState<number>(30);
  const [daftar, setDaftar] = useState<BarisPengingat[]>([]);
  const [ringkas, setRingkas] = useState<RingkasPengingat>(
    { total: 0, siap: 0, tanpaEmail: 0, baruSaja: 0, lewat: 0 });
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<HasilKirim[] | null>(null);

  const JEDA = 3 * 86400000;
  const bisaDikirimi = useCallback((b: BarisPengingat) => Boolean(b.email), []);
  const siap = useCallback(
    (b: BarisPengingat) => Boolean(b.email) && Date.now() - b.pengingatPada > JEDA,
    [JEDA]);

  /* setHasil(null) SENGAJA TIDAK ADA DI SINI.
     Ia pernah ada, dan akibatnya: kirim() memanggil muat() untuk menyegarkan
     stempel `pengingatPada`, muat() menghapus laporannya, dan laporan
     "3 terkirim, 1 ditolak" hilang dalam sepersekian detik — pemiliknya
     melihat tombol ditekan lalu tidak ada apa-apa. Padahal justru daftar
     siapa yang GAGAL itu satu-satunya keluaran yang penting di sini.
     Pengosongan dipindah ke tempat yang memang berarti "mulai dari awal":
     ganti jendela waktu, dan tombol segarkan. */
  const muat = useCallback(async (n: number) => {
    setMemuat(true); setGalat('');
    try {
      const j = await daftarPengingat(n);
      setDaftar(j.daftar);
      setRingkas(j.ringkas);
      /* Centang awal = yang SIAP saja. Bukan semua, dan bukan kosong.
         Kosong berarti pemiliknya harus mencentang 22 kotak satu per satu
         untuk pekerjaan yang memang ingin ia lakukan; semua berarti sekali
         salah tekan mengirimi orang yang baru dikirimi kemarin. */
      setPilih(new Set(j.daftar.filter((b) => Boolean(b.email)
        && Date.now() - b.pengingatPada > JEDA).map((b) => b.sidik)));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membaca daftar');
      setDaftar([]);
    } finally { setMemuat(false); }
  }, [JEDA]);

  useEffect(() => { setHasil(null); void muat(dalam); }, [dalam, muat]);

  /* Ringkasan per TANGGAL, bukan per orang. Pertanyaan yang sebenarnya ada
     di kepala pemilik saat membuka panel ini adalah "kapan gelombang
     pertamanya", dan itu tidak terjawab oleh daftar 24 baris. */
  const gelombang = useMemo(() => {
    const per = new Map<string, { n: number; sisa: number }>();
    for (const b of daftar) {
      const k = tanggalPendek(b.berakhir);
      const o = per.get(k) || { n: 0, sisa: b.sisaHari };
      o.n += 1;
      per.set(k, o);
    }
    return [...per.entries()];
  }, [daftar]);

  const terpilih = daftar.filter((b) => pilih.has(b.sidik));

  function balik(sidik: string) {
    setPilih((s) => {
      const n = new Set(s);
      if (n.has(sidik)) n.delete(sidik); else n.add(sidik);
      return n;
    });
  }

  async function kirim() {
    if (!terpilih.length) return;
    const contoh = terpilih.slice(0, 3).map((b) => b.email).join('\n');
    const lagi = terpilih.length > 3 ? `\n…dan ${terpilih.length - 3} lagi` : '';
    if (!confirm(
      `Kirim pengingat ke ${terpilih.length} orang?\n\n${contoh}${lagi}\n\n`
      + 'Surat yang sudah keluar tidak bisa ditarik kembali.'
    )) return;

    setSibuk(true); setGalat(''); setHasil(null);
    try {
      /* `ulangi` menyusul pilihan pemilik, bukan dipaksa true. Kalau ia
         sengaja mencentang orang yang baru dikirimi, itu keputusannya —
         tapi harus ia yang mencentang. */
      const adaYangDiulang = terpilih.some((b) => !siap(b));
      const j = await kirimPengingat(terpilih.map((b) => b.sidik), adaYangDiulang);
      setHasil(j.hasil);
      await muat(dalam);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal mengirim');
    } finally { setSibuk(false); }
  }

  const semuaSiap = daftar.filter(siap);
  const semuaSiapTercentang = semuaSiap.length > 0
    && semuaSiap.every((b) => pilih.has(b.sidik));

  return (
    <Panel>
      <PanelHead
        judul="Pengingat Masa Akses"
        sub="Surat ke pemegang akses gratis sebelum masa berlakunya habis. Daftarnya dibaca dulu — yang terkirim persis yang tercentang."
        kanan={
          <button onClick={() => { setHasil(null); void muat(dalam); }} aria-label="Segarkan"
            className="cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200">
            <RotateCcw className={cn('size-3.5', memuat && 'animate-spin')} />
          </button>
        }
      />
      <div className="px-5 pb-5">
        {/* Jendela waktu */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] text-zinc-500">Yang habis dalam</span>
          {JENDELA.map((n) => (
            <button key={n} onClick={() => setDalam(n)}
              className={cn(
                'cursor-pointer rounded-md border px-2.5 py-1 text-[12px] transition-colors',
                dalam === n
                  ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
                  : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300')}>
              {n} hari
            </button>
          ))}
        </div>

        {galat && <p className="mb-3 text-[12px] text-amber-300/90">{galat}</p>}

        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Chip label="Dalam jendela" nilai={ringkas.total} />
          <Chip label="Siap dikirimi" nilai={ringkas.siap} nada="baik" />
          <Chip label="Tanpa alamat" nilai={ringkas.tanpaEmail} nada={ringkas.tanpaEmail ? 'jaga' : 'diam'} />
          <Chip label="Sudah lewat" nilai={ringkas.lewat} nada={ringkas.lewat ? 'jaga' : 'diam'} />
        </div>

        {gelombang.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-800/60 px-3 py-2 text-[11.5px] text-zinc-500">
            {gelombang.map(([tgl, o]) => (
              <span key={tgl}>
                <span className="text-zinc-300">{tgl}</span> · {o.n} orang
              </span>
            ))}
          </div>
        )}

        {daftar.length === 0 && !memuat ? (
          <p className="py-4 text-center text-[12.5px] text-zinc-600">
            Tidak ada akses gratis yang habis dalam {dalam} hari ke depan.
          </p>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-zinc-400">
                <input type="checkbox" checked={semuaSiapTercentang}
                  onChange={() => setPilih(semuaSiapTercentang
                    ? new Set()
                    : new Set(semuaSiap.map((b) => b.sidik)))}
                  className="size-3.5 cursor-pointer accent-zinc-300" />
                Centang semua yang siap ({semuaSiap.length})
              </label>
              <span className="angka text-[11.5px] text-zinc-500">{terpilih.length} dipilih</span>
            </div>

            <DaftarLipat
              data={daftar}
              batasAwal={8}
              kosong={null}
              render={(b, no) => {
                const bisa = bisaDikirimi(b);
                const baru = bisa && !siap(b);
                const h = hasil?.find((x) => x.sidik === b.sidik);
                return (
                  <div key={b.sidik}
                    className={cn('rounded-lg border p-3',
                      bisa ? 'border-zinc-800/60' : 'border-amber-500/20 bg-amber-500/[0.03]')}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" disabled={!bisa}
                        checked={pilih.has(b.sidik)}
                        onChange={() => balik(b.sidik)}
                        className="mt-0.5 size-3.5 cursor-pointer accent-zinc-300 disabled:cursor-not-allowed disabled:opacity-30" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <NomorBaris no={no} />
                          {bisa ? (
                            <span className="truncate text-[13px] text-zinc-200">{b.email}</span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[13px] text-amber-300/90">
                              <MailWarning className="size-3.5 shrink-0" />
                              Tidak punya alamat surel
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] text-zinc-500">
                          <span className={cn(b.lewat ? 'text-amber-300/90' : 'text-zinc-400')}>
                            {b.lewat
                              ? `sudah lewat ${Math.abs(b.sisaHari)} hari`
                              : `${b.sisaHari} hari lagi`}
                          </span>
                          <span>· habis {tanggalPendek(b.berakhir)}</span>
                          {baru && (
                            <span className="text-zinc-600">
                              · baru dikirimi {tanggalPendek(b.pengingatPada)}
                            </span>
                          )}
                        </div>
                        {!bisa && (
                          <p className="mt-1.5 text-[11.5px] text-zinc-500">
                            Lisensinya aktif, tapi tidak ada permintaan beralamat yang cocok dengan
                            uid-nya — kemungkinan diaktifkan tangan lewat kode. Orang ini tidak bisa
                            dikabari dari sini.
                          </p>
                        )}
                        {h && (
                          <p className={cn('mt-1.5 text-[11.5px]',
                            h.terkirim ? 'text-emerald-300/90' : 'text-amber-300/90')}>
                            {h.terkirim ? 'Terkirim.' : `Tidak terkirim — ${h.alasan || 'sebab tidak diketahui'}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }}
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={() => void kirim()} disabled={sibuk || !terpilih.length}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-[12.5px] font-medium text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40">
                {sibuk ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                {sibuk ? 'Mengirim…' : `Kirim ke ${terpilih.length} orang`}
              </button>
              {hasil && (
                <span className="text-[12px] text-zinc-400">
                  {hasil.filter((x) => x.terkirim).length} terkirim dari {hasil.length} yang dicoba.
                </span>
              )}
            </div>
            <p className="mt-2 text-[11.5px] text-zinc-600">
              Dikirim satu per satu dengan jeda 0,7 detik — batas laju Resend. Dua puluh orang
              memakan sekitar 15 detik, jadi jangan tutup halamannya.
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}
