import { useEffect, useMemo, useState } from 'react';
import { EyeOff, Eye, Loader2, RefreshCw } from 'lucide-react';
import { Panel, PanelHead } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';
import {
  daftarAnalisa, daftarAgenHadir, daftarSembunyiAnalis, simpanSembunyiAnalis,
} from '@/lib/analisa';

/* ════════════════════════════════════════════════════════════════════════
   SEMBUNYIKAN KARTU COPY SIGNAL
   ════════════════════════════════════════════════════════════════════════
   Papan Copy Signal menumbuhkan kartunya sendiri: siapa pun yang pernah
   memposting satu sinyal punya satu, selamanya, dan tiap agen yang berdenyut
   punya satu bahkan sebelum sinyal pertamanya. Itu perilaku yang benar —
   papan yang menyembunyikan analis yang sedang sepi adalah papan yang
   memilih-milih. Tapi akibatnya kartu percobaan, akun uji, dan agen yang
   sudah dipensiunkan ikut menempati baris pertama yang dilihat orang baru.

   ── SEMBUNYI, BUKAN HAPUS ──────────────────────────────────────────────
   Yang disimpan cuma daftar uid. Sinyalnya tetap ada, papan peringkat tetap
   menghitungnya, dan menampilkannya kembali cuma mencabut satu centang.
   Menghapus kartu berarti menghapus rekam jejak — dan rekam jejak yang bisa
   dihapus pemiliknya sendiri tidak berarti apa-apa bagi yang membacanya.

   ── DAFTARNYA DI SERVER ────────────────────────────────────────────────
   Bukan di localStorage. Yang disembunyikan harus hilang untuk SEMUA
   pembaca; daftar per peramban cuma merapikan layar satu orang sambil
   membiarkan pengunjung melihat papan yang sama berantakannya.
   ════════════════════════════════════════════════════════════════════════ */

interface Kartu {
  uid: string;
  nama: string;
  /** Berapa sinyal yang pernah diposting. 0 = kartu agen yang baru berdenyut. */
  sinyal: number;
  /** Sinyal terakhir; 0 kalau belum pernah. */
  terakhir: number;
  agen: boolean;
}

function kapan(ms: number) {
  if (!ms) return 'belum pernah';
  const hari = Math.floor((Date.now() - ms) / 86_400_000);
  if (hari < 1) return 'hari ini';
  if (hari === 1) return 'kemarin';
  if (hari < 30) return `${hari} hari lalu`;
  const bulan = Math.floor(hari / 30);
  return `${bulan} bulan lalu`;
}

export function PanelSembunyiKartu() {
  const [kartu, setKartu] = useState<Kartu[] | null>(null);
  const [sembunyi, setSembunyi] = useState<Set<string>>(new Set());
  const [awal, setAwal] = useState<string>('');
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');
  const [putaran, setPutaran] = useState(0);

  useEffect(() => {
    let hidup = true;
    void Promise.all([daftarAnalisa(), daftarAgenHadir(), daftarSembunyiAnalis()])
      .then(([sinyal, agen, tersembunyi]) => {
        if (!hidup) return;
        /* Dua sumber digabung per uid. Kartu papan memang lahir dari
           keduanya: analis manusia cuma muncul lewat sinyal, agen muncul
           lewat denyut kehadiran bahkan saat belum memposting. Panel yang
           cuma membaca salah satunya akan kehilangan separuh kartu yang
           justru paling ingin disembunyikan — agen percobaan yang tidak
           pernah memposting apa pun. */
        const peta = new Map<string, Kartu>();
        for (const s of sinyal) {
          const k = peta.get(s.uid);
          if (k) { k.sinyal++; k.terakhir = Math.max(k.terakhir, s.dibuat); }
          else peta.set(s.uid, { uid: s.uid, nama: s.nama, sinyal: 1, terakhir: s.dibuat, agen: !!s.agen });
        }
        for (const a of agen) {
          const k = peta.get(a.uid);
          if (k) { k.agen = true; if (!k.nama) k.nama = a.nama; }
          else peta.set(a.uid, { uid: a.uid, nama: a.nama, sinyal: 0, terakhir: a.terakhirSinyal ?? 0, agen: true });
        }
        /* Kartu yang tersembunyi tapi TIDAK ADA lagi di kedua sumber tetap
           didaftarkan — kalau tidak, mencentang-ulang jadi mustahil dan
           daftarnya diam-diam terhapus pada penyimpanan berikutnya. */
        for (const uid of tersembunyi) {
          if (!peta.has(uid)) peta.set(uid, { uid, nama: uid, sinyal: 0, terakhir: 0, agen: false });
        }
        const daftar = [...peta.values()].sort((a, b) => b.terakhir - a.terakhir || a.nama.localeCompare(b.nama));
        setKartu(daftar);
        setSembunyi(new Set(tersembunyi));
        setAwal([...tersembunyi].sort().join(','));
      })
      .catch((e) => { if (hidup) setKabar(e instanceof Error ? e.message : 'Gagal memuat daftar kartu'); });
    return () => { hidup = false; };
  }, [putaran]);

  const berubah = useMemo(
    () => [...sembunyi].sort().join(',') !== awal,
    [sembunyi, awal]
  );

  function balik(uid: string) {
    setSembunyi((lama) => {
      const baru = new Set(lama);
      if (baru.has(uid)) baru.delete(uid); else baru.add(uid);
      return baru;
    });
    setKabar('');
  }

  async function simpan() {
    setSibuk(true); setKabar('');
    try {
      const hasil = await simpanSembunyiAnalis([...sembunyi]);
      setSembunyi(new Set(hasil));
      setAwal([...hasil].sort().join(','));
      setKabar(hasil.length
        ? `${hasil.length} kartu disembunyikan dari Copy Signal.`
        : 'Semua kartu kembali tampil di Copy Signal.');
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally { setSibuk(false); }
  }

  return (
    <Panel className="mt-4">
      <PanelHead
        judul="Kartu Copy Signal"
        sub="Sembunyikan kartu yang tidak terpakai. Sinyalnya tetap tersimpan dan papan peringkat tetap menghitungnya — yang berubah cuma apa yang tampil di papan."
        kanan={
          <button onClick={() => setPutaran((n) => n + 1)}
            className="cursor-pointer rounded border border-zinc-800 p-1 text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
            title="Muat ulang daftar">
            <RefreshCw className="size-3.5" />
          </button>
        }
      />

      <div className="px-5 pb-5">
        {kartu === null ? (
          <p className="flex items-center gap-2 py-4 text-[12.5px] text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" /> Memuat kartu papan…
          </p>
        ) : kartu.length === 0 ? (
          <p className="py-4 text-[12.5px] text-zinc-600">
            Belum ada satu pun kartu di papan Copy Signal.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-zinc-900">
              {kartu.map((k) => {
                const tutup = sembunyi.has(k.uid);
                return (
                  <li key={k.uid}>
                    {/* Satu tombol untuk seluruh baris. Centang kecil di
                        ujung kiri memaksa membidik target 14 px untuk
                        keputusan yang isinya cuma "ya/tidak" — dan baris ini
                        akan dipakai puluhan kali berturut-turut saat papannya
                        dirapikan pertama kali. */}
                    <button
                      onClick={() => balik(k.uid)}
                      className="flex w-full cursor-pointer items-center gap-3 py-2 text-left transition-colors hover:bg-zinc-900/40">
                      <span className={cn('flex size-6 shrink-0 items-center justify-center rounded',
                        tutup ? 'bg-zinc-800 text-zinc-400' : 'bg-emerald-500/10 text-emerald-400/80')}>
                        {tutup ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-[12.5px]',
                          tutup ? 'text-zinc-500 line-through' : 'text-zinc-200')}>
                          {k.nama}
                          {k.agen && <span className="ml-1.5 text-[10px] text-zinc-600">AI</span>}
                        </span>
                        <span className="block truncate text-[11px] text-zinc-600">
                          {k.sinyal ? `${k.sinyal} sinyal · ${kapan(k.terakhir)}` : 'belum ada sinyal'}
                        </span>
                      </span>
                      <span className={cn('shrink-0 text-[11px]', tutup ? 'text-zinc-600' : 'text-emerald-400/70')}>
                        {tutup ? 'disembunyikan' : 'tampil'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={() => void simpan()}
                disabled={sibuk || !berubah}
                className="cursor-pointer rounded-md bg-zinc-100 px-3.5 py-1.5 text-[12.5px] font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                {sibuk ? 'Menyimpan…' : 'Simpan'}
              </button>
              {/* Angka DI LUAR tombol. Di dalamnya ia berubah tiap centang
                  dan tombolnya ikut melebar-menyempit di bawah kursor yang
                  sedang membidiknya. */}
              <span className="text-[11.5px] text-zinc-600">
                {sembunyi.size} dari {kartu.length} disembunyikan
                {berubah && <span className="ml-1 text-amber-400/80">· belum disimpan</span>}
              </span>
              {kabar && <span className="text-[11.5px] text-zinc-400">{kabar}</span>}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
