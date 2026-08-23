import { HARGA_PERINTIS_TEKS } from '@/lib/harga-akses';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Clock, Eye, KeyRound, Loader2, LogOut, ShieldCheck, XCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  useKuota, mintaAkses, permintaanSaya, masukDiscord, aktifkanKode, LINK_BAYAR,
  type Permintaan,
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
  const { pengguna, memuat: memuatAuth, masuk, keluar, langganan, pemilik, galat } = useAuth();
  const { kuota, memuat: memuatKuota, muatUlang } = useKuota();
  const [params] = useSearchParams();
  const tujuan = params.get('dari') || '/dashboard';

  const [punyaku, setPunyaku] = useState<Permintaan[] | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState('');
  const [catatan, setCatatan] = useState('');
  /* Sengaja TIDAK disimpan di localStorage. Persetujuan risiko harus
     diberikan sadar setiap kali orang meminta akses — centang yang sudah
     terisi sendiri saat halaman dibuka bukan persetujuan, cuma hiasan. */
  const [pahamRisiko, setPahamRisiko] = useState(false);
  const [kode, setKode] = useState('');
  const [sibukKode, setSibukKode] = useState(false);
  const [kabarKode, setKabarKode] = useState('');

  async function tukarKode() {
    setSibukKode(true); setKabarKode('');
    try {
      const h = await aktifkanKode(kode);
      setKabarKode(
        h.firestoreOk === false
          ? 'Kode diterima, tapi masa berlakunya gagal disimpan. Hubungi admin sebelum mencoba lagi.'
          : `Akses aktif sampai ${h.berakhir ? new Date(h.berakhir).toLocaleDateString('id-ID') : '—'}. Muat ulang halaman.`,
      );
      if (h.ok && h.firestoreOk !== false) setTimeout(() => window.location.reload(), 1400);
    } catch (e) {
      setKabarKode(e instanceof Error ? e.message : 'Gagal menukar kode');
    } finally { setSibukKode(false); }
  }

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
        ? 'Permintaan sebelumnya masih dalam antrean — tidak perlu dikirim ulang.'
        : 'Permintaan terkirim dan masuk antrean peninjauan.');
      muatUlang();
    } catch (e) {
      setKabar(e instanceof Error ? e.message : 'Gagal mengirim permintaan');
    } finally { setSibuk(false); }
  }

  return (
    /* ── Tata letak dua panel ────────────────────────────────────────────
       Gambar penuh di kiri, isi di kanan — pola halaman masuk yang dipilih
       pemiliknya. Yang TIDAK diambil dari contohnya: kolom email + kata
       sandi. Situs ini tidak punya login kata sandi sama sekali, hanya
       Google, Discord, dan kode lisensi. Memasang kolom sandi yang tidak
       menuju ke mana-mana berarti mengundang orang mengetik sandinya ke
       formulir palsu — kebiasaan yang merugikan mereka di tempat lain.

       Paletnya tetap gelap, bukan panel putih seperti contohnya: halaman ini
       pintu masuk ke terminal yang seluruhnya gelap, dan panel putih di
       tengah alur itu terbaca seperti situs yang berbeda. */
    <div className="flex min-h-screen w-full bg-zinc-950">
      {/* Definisi animasi DISALIN PERSIS dari hero halaman depan. Kelas itu
          hidup di blok <style> milik hero, jadi ia lenyap begitu hero tidak
          terpasang — halaman ini butuh salinannya sendiri supaya gerakannya
          benar-benar sama, bukan sekadar mirip. */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeSlideIn 0.8s ease-out forwards; opacity: 0; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
        .delay-500 { animation-delay: 0.5s; }
      `}</style>

      {/* Kiri: gambar merek. Disembunyikan di layar sempit — di HP, gambar
          setinggi separuh layar cuma mendorong isinya turun. */}
      <div className="relative hidden flex-1 overflow-hidden lg:block">
        <img
          src={`${import.meta.env.BASE_URL}hero-bg.webp`}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/40 via-zinc-950/20 to-zinc-950" />
        <div className="absolute bottom-10 left-10 right-10">
          <div className="text-[15px] font-medium tracking-tight text-zinc-100">
            Jadi Trader <span className="text-zinc-400">Tools</span>
          </div>
          <p className="mt-1.5 max-w-[34ch] text-[12.5px] leading-relaxed text-zinc-400">
            Chart, screener, jurnal, dan eksekusi Pasar Kripto &amp; Forex di satu layar.
          </p>
        </div>
      </div>

      {/* Kanan: isi */}
      <div className="flex w-full flex-col overflow-y-auto lg:w-[560px] lg:shrink-0 lg:border-l lg:border-zinc-900">
      <div className="mx-auto flex w-full max-w-[460px] flex-col gap-7 px-6 py-12 md:py-16">

        {/* Pintu keluar WAJIB ada di halaman gerbang.
            ────────────────────────────────────────────────────────────────
            Tanpa ini, orang yang masuk dengan akun keliru terkunci: halaman
            ini tidak menampilkan aplikasi, dan tidak ada satu pun tombol
            untuk berganti akun. Sudah terjadi — pemiliknya sendiri terkunci
            di luar setelah menguji alur permintaan dengan email lain. */}
        <div className="animate-fade-in flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-1.5 text-[12.5px] text-zinc-500 transition-colors hover:text-zinc-300">
            <ArrowLeft className="size-3.5" /> Kembali ke beranda
          </Link>
          {pengguna && (
            <div className="flex items-center gap-2.5 text-[12px]">
              <span className="max-w-[22ch] truncate text-zinc-500">
                {pengguna.email || pengguna.displayName || 'akun tanpa nama'}
              </span>
              <button
                onClick={() => void keluar()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
              >
                <LogOut className="size-3.5" /> Ganti akun
              </button>
            </div>
          )}
        </div>

        {/* Hierarki dibawa SKALA dan BOBOT, bukan dengan menambah keluarga
            huruf. Halaman ini memakai IBM Plex Sans yang sama dengan seluruh
            aplikasi — yang membedakannya ukuran, jarak, dan keheningan di
            sekitarnya.

            KENAPA UKURANNYA DINAIKKAN. Sebelumnya judul di sini 38px di atas
            teks 14,5px — rasio 2,6:1. Judul display baru terbaca sebagai
            JUDUL kalau jaraknya dari teks tubuh mendekati 4:1; di bawah itu
            ia terbaca sebagai label formulir yang kebesaran. Hero halaman
            depan memakai 72px di atas 18px (4:1), dan halaman ini terasa
            janggal justru karena setengah-setengah menirunya.

            Leading ikut turun ke 0.95 seperti hero. Pada ukuran sebesar ini
            leading 1.15 membuat dua baris judul tampak seperti dua kalimat
            yang tidak berhubungan. */}
        <div className="animate-fade-in delay-100 flex flex-col gap-4">
          {/* Lencana pil, bukan teks polos — bentuk yang sama dengan hero. */}
          <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300 sm:text-xs">
              Akses terbatas
            </span>
          </div>
          <h1 className="text-4xl font-medium leading-[0.95] tracking-tighter text-zinc-50 sm:text-5xl lg:text-[56px]">
            Masuk ke<br />
            {/* Gradien emas hanya di SATU baris, persis aturan hero: kalau
                seluruh judul diberi gradien, tidak ada lagi yang ditonjolkan. */}
            <span className="bg-gradient-to-br from-white via-white to-[#ffcd75] bg-clip-text text-transparent">
              Jadi Trader Tools
            </span>
          </h1>
          <p className="max-w-[46ch] text-[15.5px] leading-relaxed text-zinc-400">
            Akses dibuka bertahap agar setiap pengguna baru mendapat pendampingan.
            Pilih cara masuk, kirim permintaan, lalu{' '}
            <span className="text-zinc-200">akses dibuka setelah ditinjau</span>.
          </p>

          {/* Orang yang sampai di sini SESUDAH pratinjaunya habis pantas
              diberi tahu apa yang barusan terjadi. Tanpa kalimat ini
              layarnya cuma "tiba-tiba terkunci", dan yang paling sering
              menyusul bukan pembelian melainkan kesimpulan bahwa
              aplikasinya rusak. */}
          {pengguna && !sudahAktif && langganan.status === 'habis' && (
            <div className="flex w-fit items-start gap-2.5 rounded-lg border border-sky-500/25 bg-sky-500/[0.06] px-3.5 py-2.5">
              <Eye className="mt-0.5 size-4 shrink-0 text-sky-300" strokeWidth={2} />
              <p className="max-w-[44ch] text-[12.5px] leading-relaxed text-zinc-300">
                Pratinjau 24 jam kamu sudah selesai. Yang sudah kamu simpan tidak
                hilang — ia menunggu di akun yang sama begitu akses dibuka.
              </p>
            </div>
          )}
        </div>

        {/* ── Kuota ─────────────────────────────────────────────────── */}
        {kuota.bukaPermintaan && (
        <div className="animate-fade-in delay-200 grid gap-3 sm:grid-cols-2">
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
                          catatan={`${HARGA_PERINTIS_TEKS} · ${kuota.hari} hari`} />
            </>
          )}
        </div>
        )}

        {/* ── Sudah punya akses ─────────────────────────────────────── */}
        {sudahAktif ? (
          <div className="animate-fade-in delay-300 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5">
            <div className="flex items-center gap-2 text-[14px] font-medium text-emerald-400">
              <CheckCircle2 className="size-4" /> Akses aktif
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-400">
              {pemilik
                ? 'Akun pemilik — seluruh halaman terbuka.'
                : <>Berlaku sampai {langganan.berakhir?.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                   {langganan.sisaHari !== null && <> · sisa {langganan.sisaHari} hari</>}.</>}
            </p>
            {/* CATATAN PEMILIK PADA PERSETUJUAN.
                Dulu hanya penolakan yang menampilkannya: rantai kondisi di
                bawah berbunyi baru -> ditolak -> null, dan yang disetujui
                tidak pernah sampai ke sana karena kartu "Akses aktif" inilah
                yang menang lebih dulu. Jadi pesan persetujuan tersimpan di
                server dan terkirim lewat surel, tapi tidak pernah terlihat
                di halaman orangnya — separuh janji fiturnya diam-diam tidak
                ditepati.

                `pemilik` sengaja tidak disaring keluar: kalau suatu saat
                pemilik menyetujui permintaannya sendiri untuk menguji, ia
                justru harus melihat hasilnya persis seperti pembeli. */}
            {terakhir?.status === 'disetujui' && terakhir.pesan ? (
              <div className="mt-3 rounded-lg border-l-2 border-emerald-500/50 bg-zinc-950/40 px-3 py-2">
                <div className="text-[10.5px] font-medium uppercase tracking-wider text-zinc-500">
                  Catatan dari pemilik
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-zinc-200">
                  {terakhir.pesan}
                </p>
              </div>
            ) : null}
            <Link to={tujuan}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-100 px-5 py-2.5 text-[13px] font-semibold text-zinc-950 transition-colors hover:bg-white">
              Buka aplikasi
            </Link>
          </div>
        ) : !pengguna ? (
          /* ── Belum masuk ─────────────────────────────────────────── */
          <div className="animate-fade-in delay-300 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="text-[13.5px] font-medium text-zinc-200">Masuk untuk melanjutkan</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
              Akun dipakai untuk menandai permintaan dan mengirim kabar saat akses dibuka.
            </p>
            {/* Sejajar dua kolom: keduanya jalan masuk yang setara, dan
                menumpuknya membuat yang atas terbaca sebagai yang utama. */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                onClick={() => void masuk()}
                disabled={memuatAuth}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-3 text-[12.5px] font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900 disabled:opacity-60"
              >
                <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>
              <button
                onClick={masukDiscord}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-3 text-[12.5px] font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
              >
                <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true">
                  <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.65 12.65 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127c-.598.35-1.22.645-1.873.891a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419z" />
                </svg>
                Discord
              </button>
            </div>
            {/* Galat login WAJIB tampak di sini. Halaman ini sempat menelan
                semua kegagalan masuk: `masuk()` menyimpan pesannya ke context,
                tapi tidak ada satu baris pun yang menampilkannya — orang yang
                loginnya gagal cuma melihat tombol yang seolah tidak bereaksi,
                lalu menyimpulkan dirinya ditolak. */}
            {galat && (
              <p className="mt-3 text-[11.5px] leading-relaxed text-red-400">{galat}</p>
            )}
          </div>
        ) : terakhir?.status === 'baru' ? (
          /* ── Menunggu tinjauan ───────────────────────────────────── */
          <div className="animate-fade-in delay-300 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-5">
            <div className="flex items-center gap-2 text-[14px] font-medium text-amber-300">
              <Clock className="size-4" /> Permintaan sedang ditinjau
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-400">
              Dikirim {new Date(terakhir.waktu).toLocaleString('id-ID')}. Halaman ini berubah
              sendiri begitu akses dibuka — tidak perlu mengirim ulang.
            </p>
          </div>
        ) : terakhir?.status === 'ditolak' ? (
          <div className="animate-fade-in delay-300 rounded-xl border border-red-500/25 bg-red-500/[0.05] p-5">
            <div className="flex items-center gap-2 text-[14px] font-medium text-red-400">
              <XCircle className="size-4" /> Permintaan sebelumnya tidak disetujui
            </div>
            {/* ALASANNYA DITAMPILKAN, bukan cuma kata "tidak disetujui".
                Kata itu sendirian tidak memberi tahu apa yang harus
                dilakukan berikutnya, dan orang yang tidak tahu apa yang
                kurang akan mengirim ulang permintaan yang sama persis. */}
            {terakhir.pesan ? (
              <div className="mt-3 rounded-lg border-l-2 border-red-500/50 bg-zinc-950/50 px-3 py-2">
                <div className="text-[10.5px] font-medium uppercase tracking-wider text-zinc-500">
                  Catatan dari pemilik
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-zinc-200">
                  {terakhir.pesan}
                </p>
              </div>
            ) : null}
            <p className="mt-3 text-[12.5px] leading-relaxed text-zinc-400">
              {terakhir.pesan
                ? 'Penuhi dulu yang disebut di atas, lalu kirim ulang lewat kolom di bawah.'
                : 'Tambahkan keterangan di kolom bawah, lalu kirim ulang.'}
            </p>
          </div>
        ) : null}

        {/* ── Tukar kode lisensi ────────────────────────────────────────
            Ditaruh SEBELUM tombol minta: orang yang sudah memegang kode tidak
            perlu membaca cara meminta sesuatu yang sudah ada di tangannya. */}
        {pengguna && !sudahAktif && (
          <div className="animate-fade-in delay-400 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div>
              <div className="text-[13.5px] font-medium text-zinc-200">Sudah punya kode akses?</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
                Kode dikirim ke email setelah permintaan disetujui. Satu kode berlaku untuk
                satu akun.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <input
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase().slice(0, 19))}
                placeholder="JT3-XXXX-XXXX-XXXX"
                spellCheck={false}
                className="angka h-10 min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-[13px] tracking-wider text-zinc-100 outline-none placeholder:text-zinc-700 focus-visible:border-zinc-600"
              />
              <button
                onClick={() => void tukarKode()}
                disabled={sibukKode || kode.trim().length < 19}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-5 text-[13px] font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sibukKode ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                Aktifkan
              </button>
            </div>
            {kabarKode && <div className="text-[12px] leading-relaxed text-zinc-400">{kabarKode}</div>}
          </div>
        )}

        {/* ── Tombol minta ──────────────────────────────────────────── */}
        {pengguna && !sudahAktif && kuota.bukaPermintaan && terakhir?.status !== 'baru' && (
          <div className="animate-fade-in delay-500 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="text-[13.5px] font-medium text-zinc-200">Minta akses</div>

            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="Ceritakan singkat gaya trading kamu (opsional)"
              className="w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-[12.5px] text-zinc-200 outline-none placeholder:text-zinc-600 focus-visible:border-zinc-600"
            />

            {/* Persetujuan risiko DI SINI, bukan cuma tautan di footer.
                Disclaimer melindungi sejauh penggunanya benar-benar melihatnya
                saat mengambil keputusan — dan titik keputusannya adalah detik
                sebelum ia meminta atau membayar akses, bukan halaman yang
                mungkin tidak pernah ia buka.

                Mengunci KEDUA tombol, bukan hanya yang berbayar: yang gratis
                pun membuka alat yang sama dan risiko yang sama. */}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3.5 py-3">
              <input
                type="checkbox"
                checked={pahamRisiko}
                onChange={(e) => setPahamRisiko(e.target.checked)}
                className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-emerald-500"
              />
              <span className="text-[12px] leading-relaxed text-zinc-400">
                Saya paham trading berisiko kehilangan seluruh modal, dan Jadi Trader Tools adalah{' '}
                <span className="text-zinc-200">alat bantu analisa — bukan nasihat investasi</span>.
                Saya sudah membaca{' '}
                <Link to="/legal" className="text-zinc-300 underline decoration-zinc-700 underline-offset-2 hover:decoration-zinc-400">
                  Disclaimer &amp; Ketentuan
                </Link>.
              </span>
            </label>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => void kirim('gratis')}
                disabled={sibuk || kuota.gratisHabis || !pahamRisiko}
                title={
                  kuota.gratisHabis ? 'Kuota gratis sudah habis'
                    : !pahamRisiko ? 'Centang persetujuan risiko dulu'
                    : undefined
                }
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-semibold transition-colors',
                  kuota.gratisHabis || !pahamRisiko
                    ? 'cursor-not-allowed bg-zinc-800 text-zinc-600'
                    : 'cursor-pointer bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-60',
                )}
              >
                {sibuk ? <Loader2 className="size-4 animate-spin" /> : null}
                {kuota.gratisHabis ? 'Kuota gratis habis' : `Minta akses gratis · ${kuota.hari} hari`}
              </button>

              {/* Tombol bayar SELALU ada, tapi jadi pilihan utama begitu yang
                  gratis habis — orang yang datang terlambat tetap punya jalan
                  masuk, bukan jalan buntu. */}
              {/* Tautan tidak bisa di-`disabled` seperti tombol, jadi
                  klik-nya ditahan di onClick DAN pointer-events dimatikan.
                  Dua-duanya perlu: pointer-events saja masih bisa ditembus
                  lewat keyboard, dan onClick saja masih memberi kesan tombol
                  hidup padahal tidak. */}
              <a
                href={LINK_BAYAR}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!pahamRisiko}
                title={!pahamRisiko ? 'Centang persetujuan risiko dulu' : undefined}
                onClick={(e) => { if (!pahamRisiko) e.preventDefault(); }}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-semibold transition-colors',
                  !pahamRisiko
                    ? 'pointer-events-none cursor-not-allowed bg-zinc-800 text-zinc-600'
                    : kuota.gratisHabis
                      ? 'bg-[#ffcd75] text-zinc-950 hover:bg-[#ffd98f]'
                      : 'border border-zinc-800 text-zinc-300 hover:bg-zinc-900',
                )}
              >
                Bayar {HARGA_PERINTIS_TEKS} · {kuota.hari} hari
              </a>
            </div>

            {kuota.gratisHabis && (
              <p className="text-[11.5px] leading-relaxed text-zinc-500">
                Setelah pembayaran lunas, Lynk mengirim link aktivasi otomatis — buka link itu
                dan permintaanmu tercatat sendiri. Tombol di bawah hanya untuk berjaga kalau
                link-nya tidak sampai.
              </p>
            )}
            {kuota.gratisHabis && (
              <button
                onClick={() => void kirim('bayar')}
                disabled={sibuk}
                className="w-fit cursor-pointer rounded-md border border-zinc-800 px-4 py-2 text-[12.5px] text-zinc-300 transition-colors hover:bg-zinc-900 disabled:opacity-60"
              >
                Sudah bayar — kirim permintaan
              </button>
            )}

            {kabar && <div className="text-[12px] leading-relaxed text-zinc-400">{kabar}</div>}

            <p className="text-[11.5px] leading-relaxed text-zinc-600">
              Harga perintis untuk 100 pengguna pertama. Setelah kuota ini habis, harga kembali
              ke daftar normal.
            </p>
          </div>
        )}

        <div className="animate-fade-in delay-500 flex items-start gap-2 text-[11.5px] leading-relaxed text-zinc-600">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Yang disimpan hanya email, nama akun, dan keterangan yang ditulis. Kunci API dan data
            broker tidak diminta di halaman ini.
          </span>
        </div>
      </div>
      </div>
    </div>
  );
}
