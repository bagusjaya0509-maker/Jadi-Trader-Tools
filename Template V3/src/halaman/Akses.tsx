import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Clock, Loader2, LogIn, ShieldCheck, XCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  useKuota, mintaAkses, permintaanSaya, masukDiscord, LINK_BAYAR, type Permintaan,
} from '@/lib/akses';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   HALAMAN AKSES — pintu masuk yang dijaga
   ════════════════════════════════════════════════════════════════════════
   Orang yang menekan View Portfolio atau Open Chart tanpa akses mendarat di
   sini, bukan di layar kosong atau pesan galat. Halaman ini menjawab tiga
   hal berurutan: siapa kamu (masuk), berapa sisa tempatnya (kuota), dan apa
   langkah berikutnya (minta atau bayar).

   Kuotanya dibaca dari server — lihat lib/akses.ts. Angka yang dihitung di
   browser bisa dikarang siapa pun yang membuka DevTools.
   ════════════════════════════════════════════════════════════════════════ */

function Bilah({ pakai, total, warna }: { pakai: number; total: number; warna: string }) {
  const persen = total > 0 ? Math.min(100, Math.round((pakai / total) * 100)) : 0;
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
      <div className={cn('h-full rounded-full transition-[width] duration-500', warna)}
           style={{ width: `${persen}%` }} />
    </div>
  );
}

function KartuKuota({ judul, pakai, total, sisa, warna, catatan }: {
  judul: string; pakai: number; total: number; sisa: number; warna: string; catatan: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] text-zinc-300">{judul}</span>
        <span className="angka text-[12px] text-zinc-500">{pakai} / {total}</span>
      </div>
      <Bilah pakai={pakai} total={total} warna={warna} />
      <div className="mt-2 text-[11.5px] text-zinc-500">
        {sisa > 0 ? <>sisa <span className="angka text-zinc-300">{sisa}</span> tempat</> : 'sudah penuh'}
        {' · '}{catatan}
      </div>
    </div>
  );
}

export default function Akses() {
  const { pengguna, memuat: memuatAuth, masuk, langganan, pemilik } = useAuth();
  const { kuota, memuat: memuatKuota, muatUlang } = useKuota();
  const [params] = useSearchParams();
  const tujuan = params.get('dari') || '/dashboard';

  const [punyaku, setPunyaku] = useState<Permintaan[] | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');
  const [catatan, setCatatan] = useState('');

  /* Permintaan sendiri dibaca ulang tiap kali orangnya berganti — bukan
     sekali saat modul dimuat. Orang yang keluar lalu masuk dengan akun lain
     tidak boleh melihat status milik akun sebelumnya. */
  useEffect(() => {
    if (!pengguna) { setPunyaku(null); return; }
    let hidup = true;
    permintaanSaya()
      .then((d) => { if (hidup) setPunyaku(d); })
      .catch(() => { if (hidup) setPunyaku([]); });
    return () => { hidup = false; };
  }, [pengguna?.uid, kabar]);

  const terakhir = punyaku?.find((p) => p.produk === 'jadi-trader-v3') ?? punyaku?.[0] ?? null;
  const sudahAktif = pemilik || langganan.status === 'aktif';

  async function kirim(jenis: 'gratis' | 'bayar') {
    setSibuk(true); setKabar('');
    try {
      const h = await mintaAkses({ jenis, catatan });
      setKabar(h.sudahAda
        ? 'Permintaanmu yang sebelumnya masih menunggu — tidak perlu dikirim lagi.'
        : 'Permintaan terkirim. Saya akan meninjaunya.');
      muatUlang();
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Gagal mengirim permintaan');
    } finally { setSibuk(false); }
  }

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-zinc-950">
      <div className="mx-auto flex max-w-[620px] flex-col gap-6 px-5 py-12 md:py-20">

        <Link to="/" className="inline-flex w-fit items-center gap-1.5 text-[12.5px] text-zinc-500 transition-colors hover:text-zinc-300">
          <ArrowLeft className="size-3.5" /> Kembali ke beranda
        </Link>

        <div>
          <h1 className="text-2xl font-medium tracking-tighter text-zinc-100 sm:text-3xl">
            Akses Jadi Trader Tools
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-zinc-400">
            Aksesnya masih dibuka terbatas supaya saya sempat menemani setiap orang yang masuk.
            Masuk dengan Google atau Discord, kirim permintaan, dan saya buka manual.
          </p>
        </div>

        {/* ── Kuota ─────────────────────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2">
          {memuatKuota ? (
            <div className="sm:col-span-2 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-[12.5px] text-zinc-500">
              <Loader2 className="size-3.5 animate-spin" /> Menghitung sisa tempat…
            </div>
          ) : (
            <>
              <KartuKuota judul="Akses gratis" pakai={kuota.gratisTerpakai} total={kuota.gratisTotal}
                          sisa={kuota.gratisSisa} warna="bg-emerald-500"
                          catatan={`${kuota.hari} hari`} />
              <KartuKuota judul="Akses perintis" pakai={kuota.bayarTerpakai} total={kuota.bayarTotal}
                          sisa={kuota.bayarSisa} warna="bg-[#ffcd75]"
                          catatan={`Rp 17.900 · ${kuota.hari} hari`} />
            </>
          )}
        </div>

        {/* ── Sudah punya akses ─────────────────────────────────────── */}
        {sudahAktif ? (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5">
            <div className="flex items-center gap-2 text-[14px] font-medium text-emerald-400">
              <CheckCircle2 className="size-4" /> Aksesmu aktif
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-400">
              {pemilik
                ? 'Kamu pemilik situs ini — semua halaman terbuka.'
                : <>Berlaku sampai {langganan.berakhir?.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                   {langganan.sisaHari !== null && <> · sisa {langganan.sisaHari} hari</>}.</>}
            </p>
            <Link to={tujuan}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-100 px-5 py-2.5 text-[13px] font-semibold text-zinc-950 transition-colors hover:bg-white">
              Lanjut ke aplikasi
            </Link>
          </div>
        ) : !pengguna ? (
          /* ── Belum masuk ─────────────────────────────────────────── */
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="text-[13.5px] font-medium text-zinc-200">Masuk dulu</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
              Dipakai untuk menandai permintaanmu dan mengirim kabar saat aksesnya dibuka.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                onClick={() => void masuk()}
                disabled={memuatAuth}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-5 py-2.5 text-[13px] font-semibold text-zinc-950 transition-colors hover:bg-white disabled:opacity-60"
              >
                <LogIn className="size-4" /> Masuk dengan Google
              </button>
              <button
                onClick={masukDiscord}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-800 px-5 py-2.5 text-[13px] font-medium text-zinc-300 transition-colors hover:bg-zinc-900"
              >
                <LogIn className="size-4" /> Masuk dengan Discord
              </button>
            </div>
          </div>
        ) : terakhir?.status === 'baru' ? (
          /* ── Menunggu tinjauan ───────────────────────────────────── */
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-5">
            <div className="flex items-center gap-2 text-[14px] font-medium text-amber-300">
              <Clock className="size-4" /> Permintaanmu sedang ditunggu
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-400">
              Dikirim {new Date(terakhir.waktu).toLocaleString('id-ID')}. Begitu saya setujui,
              halaman ini langsung berubah dan tombolnya kembali berfungsi seperti biasa —
              tidak perlu mengirim ulang.
            </p>
          </div>
        ) : terakhir?.status === 'ditolak' ? (
          <div className="rounded-xl border border-red-500/25 bg-red-500/[0.05] p-5">
            <div className="flex items-center gap-2 text-[14px] font-medium text-red-400">
              <XCircle className="size-4" /> Permintaan sebelumnya ditolak
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-400">
              Kalau menurutmu ini keliru, tulis alasannya di kolom di bawah lalu kirim lagi.
            </p>
          </div>
        ) : null}

        {/* ── Tombol minta ──────────────────────────────────────────── */}
        {pengguna && !sudahAktif && terakhir?.status !== 'baru' && (
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="text-[13.5px] font-medium text-zinc-200">Minta akses</div>

            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="Ceritakan singkat kamu trading apa (opsional)"
              className="w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-[12.5px] text-zinc-200 outline-none placeholder:text-zinc-600 focus-visible:border-zinc-600"
            />

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => void kirim('gratis')}
                disabled={sibuk || kuota.gratisHabis}
                title={kuota.gratisHabis ? 'Kuota gratis sudah habis' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-semibold transition-colors',
                  kuota.gratisHabis
                    ? 'cursor-not-allowed bg-zinc-800 text-zinc-600'
                    : 'cursor-pointer bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-60',
                )}
              >
                {sibuk ? <Loader2 className="size-4 animate-spin" /> : null}
                {kuota.gratisHabis ? 'Kuota gratis habis' : `Minta akses gratis ${kuota.hari} hari`}
              </button>

              {/* Tombol bayar SELALU ada, tapi jadi pilihan utama begitu yang
                  gratis habis — orang yang datang terlambat tetap punya jalan
                  masuk, bukan jalan buntu. */}
              <a
                href={LINK_BAYAR}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-semibold transition-colors',
                  kuota.gratisHabis
                    ? 'bg-[#ffcd75] text-zinc-950 hover:bg-[#ffd98f]'
                    : 'border border-zinc-800 text-zinc-300 hover:bg-zinc-900',
                )}
              >
                Bayar Rp 17.900 · {kuota.hari} hari
              </a>
            </div>

            {kuota.gratisHabis && (
              <p className="text-[11.5px] leading-relaxed text-zinc-500">
                Setelah membayar, kembali ke halaman ini dan tekan tombol di bawah supaya
                permintaanmu masuk ke antrean saya.
              </p>
            )}
            {kuota.gratisHabis && (
              <button
                onClick={() => void kirim('bayar')}
                disabled={sibuk}
                className="w-fit cursor-pointer rounded-md border border-zinc-800 px-4 py-2 text-[12.5px] text-zinc-300 transition-colors hover:bg-zinc-900 disabled:opacity-60"
              >
                Saya sudah bayar — kirim permintaan
              </button>
            )}

            {kabar && <div className="text-[12px] leading-relaxed text-zinc-400">{kabar}</div>}

            <p className="text-[11.5px] leading-relaxed text-zinc-600">
              Harga perintis untuk 100 orang pertama. Sesudah kuota ini habis, harganya kembali
              ke daftar normal di toko.
            </p>
          </div>
        )}

        <div className="flex items-start gap-2 text-[11.5px] leading-relaxed text-zinc-600">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Yang saya simpan cuma email, nama akun, dan catatanmu. Tidak ada kunci API atau data
            broker yang diminta di halaman ini.
          </span>
        </div>
      </div>
    </div>
  );
}
