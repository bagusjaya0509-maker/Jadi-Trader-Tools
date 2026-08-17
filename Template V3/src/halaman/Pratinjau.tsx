import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, Eye, Loader2, TriangleAlert } from 'lucide-react';
import { useAuth, mulaiPratinjau } from '@/lib/auth';
import { TombolMasuk } from '@/components/gerbang';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   PRATINJAU — pintu masuk sehari, terpisah dari antrean akses
   ════════════════════════════════════════════════════════════════════════
   Dituju dari tombol "Preview tools" di /template. Alurnya tiga langkah
   dan tidak lebih: masuk → pratinjau dimulai → langsung ke Dashboard.

   KENAPA HALAMAN SENDIRI, bukan sekadar tombol yang langsung melempar
   masuk. Pratinjau punya batas yang harus diketahui SEBELUM orangnya
   memakai waktunya: sehari, sekali per akun, tidak bisa diulang. Kalimat
   itu kehilangan seluruh gunanya kalau baru muncul sesudah jamnya jalan.

   KENAPA TERPISAH DARI /akses. Halaman itu menawarkan kuota event 30
   hari — gratis (terbatas) atau perintis. Kalau login di sana juga
   memberi pratinjau, tidak ada yang punya alasan mengambil kuotanya:
   ia sudah masuk. Dua pintu, dua janji, dan yang satu tidak boleh
   diam-diam membuka yang lain.
   ════════════════════════════════════════════════════════════════════════ */

type Fase = 'diam' | 'jalan' | 'gagal';

export default function Pratinjau() {
  const { pengguna, memuat, langganan, pemilik } = useAuth();
  const arahkan = useNavigate();
  const [fase, setFase] = useState<Fase>('diam');
  const [kabar, setKabar] = useState('');

  const sudahBoleh = pemilik || langganan.status === 'aktif' || langganan.status === 'pratinjau';

  /* Sudah punya akses (pratinjau yang masih jalan, lisensi aktif, atau
     pemilik) → tidak ada yang perlu dimulai, langsung masuk saja.
     Menahannya di sini cuma membuat orang menekan tombol untuk sesuatu
     yang sudah ia punya. */
  useEffect(() => {
    if (!memuat && sudahBoleh) arahkan('/dashboard', { replace: true });
  }, [memuat, sudahBoleh, arahkan]);

  async function mulai() {
    if (!pengguna) return;
    setFase('jalan'); setKabar('');
    try {
      const hasil = await mulaiPratinjau(pengguna.uid);
      if (hasil === 'sudahPernah') {
        setFase('gagal');
        setKabar('Akun ini sudah pernah memakai pratinjaunya. Pratinjau berlaku sekali per akun — lanjutkan lewat halaman akses.');
        return;
      }
      /* TIDAK langsung arahkan: status datang dari pemantau Firestore, dan
         melompat ke Dashboard sebelum status barunya tiba akan ditolak
         gerbang lalu dilempar balik ke /akses. Efek di atas yang
         mengantar begitu statusnya benar-benar berubah. */
      setKabar('Pratinjau dimulai. Membuka…');
    } catch (e) {
      setFase('gagal');
      /* Galat aturan Firestore dilaporkan APA ADANYA, tidak ditelan.
         Menelannya berarti orangnya menunggu layar yang tidak akan
         pernah terbuka, tanpa tahu kenapa. */
      setKabar(e instanceof Error ? e.message : 'Pratinjau gagal dimulai.');
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-7 px-5 py-16">
        <Link to="/template" className="inline-flex w-fit items-center gap-1.5 text-[12.5px] text-zinc-500 transition-colors hover:text-zinc-300">
          <ArrowLeft className="size-3.5" /> Kembali
        </Link>

        <div className="flex flex-col gap-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-500/25 bg-sky-500/[0.07] px-3 py-1.5">
            <Eye className="size-3.5 text-sky-300" strokeWidth={2} />
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-sky-200">Pratinjau</span>
          </div>
          <h1 className="text-4xl font-medium leading-[1.02] tracking-tighter text-zinc-50 sm:text-[44px]">
            Lihat isinya dulu,<br />
            <span className="bg-gradient-to-br from-white via-white to-[#ffcd75] bg-clip-text text-transparent">
              sehari penuh
            </span>
          </h1>
          <p className="max-w-[44ch] text-[15px] leading-relaxed text-zinc-400">
            Masuk sekali, lalu seluruh isi alat terbuka — screener, chart &amp; entry,
            jurnal, dan copy signal — terisi data contoh.
          </p>
        </div>

        {/* Batasnya ditulis SEBELUM tombolnya, bukan sesudah. Orang berhak
            tahu apa yang ia belanjakan sebelum jamnya mulai berjalan. */}
        <ul className="flex flex-col gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          {[
            ['Berlaku 24 jam', 'Dihitung sejak kamu menekan Mulai pratinjau, bukan sejak mendaftar.'],
            ['Sekali per akun', 'Tidak bisa diulang atau di-reset. Jamnya berjalan di server.'],
            ['Isinya data contoh', 'Angka yang tampil bukan hasil trading siapa pun.'],
          ].map(([judul, ket]) => (
            <li key={judul} className="flex gap-2.5">
              <Clock className="mt-0.5 size-3.5 shrink-0 text-zinc-600" strokeWidth={2} />
              <div>
                <div className="text-[12.5px] font-medium text-zinc-200">{judul}</div>
                <div className="text-[11.5px] leading-relaxed text-zinc-500">{ket}</div>
              </div>
            </li>
          ))}
        </ul>

        {memuat ? (
          <div className="flex items-center gap-2 text-[12.5px] text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" /> Memeriksa sesi…
          </div>
        ) : !pengguna ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="text-[13.5px] font-medium text-zinc-200">Masuk untuk mulai</div>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
              Akun dipakai untuk menandai bahwa pratinjau ini sudah terpakai. Kunci API
              dan data broker tidak diminta di halaman ini.
            </p>
            <div className="mt-3"><TombolMasuk penuh /></div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              onClick={mulai}
              disabled={fase === 'jalan'}
              className={cn(
                'flex w-full cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-3',
                'text-[13.5px] font-medium transition-colors',
                fase === 'jalan'
                  ? 'bg-zinc-800 text-zinc-500'
                  : 'bg-zinc-100 text-zinc-950 hover:bg-white',
              )}
            >
              {fase === 'jalan'
                ? <><Loader2 className="size-4 animate-spin" /> Membuka…</>
                : <>Mulai pratinjau 24 jam <ArrowRight className="size-4" /></>}
            </button>
            <p className="text-center text-[11.5px] text-zinc-600">Masuk sebagai {pengguna.email}</p>
          </div>
        )}

        {kabar && (
          <div className={cn(
            'flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[12.5px] leading-relaxed',
            fase === 'gagal'
              ? 'border-red-500/25 bg-red-500/[0.06] text-red-200'
              : 'border-sky-500/25 bg-sky-500/[0.06] text-sky-100',
          )}>
            {fase === 'gagal' && <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-400" strokeWidth={2} />}
            <span>{kabar}</span>
          </div>
        )}

        {/* Jalur satunya SELALU terlihat, tidak disembunyikan di balik
            kegagalan: sebagian orang datang ke sini justru sudah siap
            mengambil kuota 30 hari, dan memaksa mereka lewat pratinjau
            dulu cuma menambah satu langkah yang tidak mereka butuhkan. */}
        <div className="border-t border-zinc-800 pt-5">
          <p className="text-[12.5px] leading-relaxed text-zinc-500">
            Sudah yakin, atau pratinjaunya sudah terpakai?{' '}
            <Link to="/akses" className="text-zinc-200 underline underline-offset-2 hover:text-white">
              Ambil akses 30 hari
            </Link>{' '}
            — kuota gratisnya terbatas.
          </p>
        </div>
      </div>
    </div>
  );
}
