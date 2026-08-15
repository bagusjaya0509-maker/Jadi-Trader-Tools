import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TriangleAlert, ShieldCheck, ScrollText, Receipt, Building2, type LucideIcon,
} from 'lucide-react';
import { Panel } from '@/components/efferd-ui';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════════════
   LEGAL — disclaimer, privasi, ketentuan, pengembalian dana
   ════════════════════════════════════════════════════════════════════════
   SEMUA BAGIAN DIRENDER SEKALIGUS, tidak disembunyikan di balik tab seperti
   halaman Documentation. Perbedaannya disengaja dan penting:

   Dokumen hukum harus bisa di-Ctrl+F, disalin utuh, dan dicetak jadi satu
   berkas. Kalau tiga dari empat bagiannya tidak ada di DOM, orang yang
   mencari kata "refund" tidak menemukan apa pun dan menyimpulkan kami tidak
   mengaturnya — padahal ada, cuma sedang tersembunyi. Untuk halaman bantuan
   itu cuma merepotkan; untuk halaman hukum itu merugikan kedua pihak.

   Navigasi kiri karena itu MELOMPAT (scrollIntoView), bukan mengganti isi.

   Kenapa tidak memakai anchor `#privasi`: aplikasi ini berjalan di
   HashRouter, jadi alamatnya sudah mengandung `#/legal`. Menambah anchor
   kedua menghasilkan `#/legal#privasi` yang ditafsirkan router sebagai rute
   lain dan halamannya melompat ke beranda.

   ── SOAL ISINYA ────────────────────────────────────────────────────────
   Ditulis dengan bahasa yang benar-benar bisa dibaca orang, bukan salinan
   template. Alasannya bukan gaya: disclaimer hanya melindungi kalau
   penggunanya benar-benar paham isinya. Kalimat berputar tujuh baris yang
   tidak dimengerti siapa pun justru melemahkan posisi kita sendiri kalau
   suatu saat dipersoalkan.

   Yang SENGAJA dinyatakan tegas dan berulang: kami menjual PERANGKAT LUNAK,
   bukan nasihat investasi, dan tidak pernah memegang dana siapa pun. Itu
   batas yang memisahkan usaha ini dari kegiatan yang memerlukan izin
   OJK/Bappebti — dan batas itu harus terbaca jelas oleh pengguna, bukan
   hanya tercatat di KBLI.
   ════════════════════════════════════════════════════════════════════════ */

const DIPERBARUI = '15 Agustus 2026';

/* Identitas badan usaha. Alamat SENGAJA hanya sampai tingkat kota — alamat
   lengkap di NIB adalah rumah pemilik, dan tidak ada gunanya diindeks mesin
   pencari. Yang membangun kepercayaan adalah nomor NIB yang bisa diperiksa
   siapa pun di OSS, bukan nama jalannya. */
const BADAN = {
  nama: 'PT Solusi Bursa Nusantara',
  nib: '1508260003215',
  kota: 'Kota Mataram, Nusa Tenggara Barat, Indonesia',
  email: 'business@jaditrader.co.id',
};

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-zinc-400">{children}</p>;
}

function Tegas({ children }: { children: React.ReactNode }) {
  return <span className="text-zinc-200">{children}</span>;
}

function Daftar({ butir }: { butir: React.ReactNode[] }) {
  return (
    <ul className="space-y-1.5">
      {butir.map((b, i) => (
        <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-zinc-400">
          <span className="mt-[7px] size-1 shrink-0 rounded-full bg-zinc-600" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

/* Kotak penekanan untuk kalimat yang TIDAK boleh terlewat dibaca. Dipakai
   hemat — kalau semua ditekankan, tidak ada yang tertekan. */
function Sorot({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3">
      <p className="text-[13px] leading-relaxed text-amber-100/90">{children}</p>
    </div>
  );
}

function SubJudul({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-1 text-[13.5px] font-medium text-zinc-200">{children}</h3>;
}

interface Bagian {
  id: string;
  judul: string;
  ringkas: string;
  Ikon: LucideIcon;
  isi: React.ReactNode;
}

const BAGIAN: Bagian[] = [
  {
    id: 'risiko',
    judul: 'Disclaimer Risiko',
    ringkas: 'Apa yang kami jual, dan apa yang tidak.',
    Ikon: TriangleAlert,
    isi: (
      <>
        <Sorot>
          Trading berisiko kehilangan <Tegas>seluruh modal</Tegas>. Jangan pernah memakai uang
          yang kamu butuhkan untuk hidup, uang pinjaman, atau uang orang lain.
        </Sorot>

        <SubJudul>Kami menjual perangkat lunak, bukan nasihat investasi</SubJudul>
        <P>
          {BADAN.nama} mengembangkan dan menjual lisensi perangkat lunak alat bantu analisa pasar —
          indikator, screener, jurnal, dan Expert Advisor. Itu saja.
        </P>
        <Daftar butir={[
          <>Kami <Tegas>tidak</Tegas> memberikan nasihat atau rekomendasi investasi.</>,
          <>Kami <Tegas>tidak</Tegas> mengelola, menerima titipan, atau menyentuh dana siapa pun.</>,
          <>Kami <Tegas>bukan</Tegas> perusahaan pialang, penasihat berjangka, maupun manajer investasi.</>,
          <>Kami <Tegas>tidak</Tegas> menjanjikan keuntungan dalam bentuk apa pun.</>,
        ]} />
        <P>
          Uang, akun bursa, dan API key sepenuhnya tetap milik dan di bawah kendalimu. Order
          dikirim dari server dan akun brokermu sendiri — secara teknis kami memang tidak punya
          jalan untuk mengeksekusi apa pun atas namamu.
        </P>

        <SubJudul>Sinyal adalah keluaran algoritma, bukan rekomendasi</SubJudul>
        <P>
          Kartu sinyal, Area Pantau, Copy Signal, dan panel sejenisnya adalah hasil perhitungan
          otomatis atas data harga publik menurut aturan yang tertulis di{' '}
          <Link to="/dokumentasi" className="text-zinc-200 underline decoration-zinc-700 underline-offset-2 hover:decoration-zinc-400">
            Documentation
          </Link>. Sistem tidak mengetahui kondisi keuanganmu, toleransi risikomu, atau tujuanmu —
          jadi keluarannya tidak mungkin menjadi saran yang cocok untukmu secara pribadi.
        </P>
        <P>
          <Tegas>Setiap keputusan membuka, menahan, dan menutup posisi adalah keputusanmu,</Tegas>{' '}
          termasuk ketika kamu memilih mengikuti sinyal apa adanya.
        </P>

        <SubJudul>Hasil masa lalu bukan jaminan</SubJudul>
        <P>
          Angka winrate, backtest, statistik jurnal, dan riwayat performa menggambarkan apa yang
          sudah terjadi pada data historis. Pasar berubah, dan strategi yang bekerja tahun lalu
          bisa gagal total bulan depan. Backtest juga tidak menanggung slippage, spread melebar,
          gangguan koneksi, dan antrean eksekusi yang kamu hadapi di dunia nyata.
        </P>
        <P>
          Leverage memperbesar kerugian secepat ia memperbesar keuntungan. Pada produk berjangka,
          kerugian dapat melampaui setoran awalmu.
        </P>

        <SubJudul>Perangkat lunak bisa salah</SubJudul>
        <P>
          Data bisa terlambat, indikator bisa keliru menghitung, koneksi ke bursa bisa putus, dan
          server bisa mati di saat paling tidak menyenangkan. Perlakukan setiap keluaran sistem
          sebagai bahan pertimbangan yang <Tegas>wajib kamu periksa ulang</Tegas> — bukan sebagai
          kebenaran yang sudah final.
        </P>
      </>
    ),
  },
  {
    id: 'privasi',
    judul: 'Kebijakan Privasi',
    ringkas: 'Data apa yang kami simpan, dan yang sengaja tidak kami sentuh.',
    Ikon: ShieldCheck,
    isi: (
      <>
        <P>
          Kebijakan ini disusun mengikuti <Tegas>UU No. 27 Tahun 2022 tentang Pelindungan Data
          Pribadi</Tegas>. Pengendali data adalah {BADAN.nama}.
        </P>

        <SubJudul>Yang kami simpan</SubJudul>
        <Daftar butir={[
          <><Tegas>Identitas akun</Tegas> — nama, alamat email, dan foto profil, diambil dari akun Google atau Discord yang kamu pakai untuk masuk.</>,
          <><Tegas>Isi jurnal trading</Tegas> — catatan transaksi, ukuran posisi, catatan pribadi, dan emosi yang kamu tulis sendiri.</>,
          <><Tegas>Data lisensi</Tegas> — produk yang kamu miliki, tanggal aktivasi, dan masa berlakunya.</>,
          <><Tegas>Catatan teknis</Tegas> — waktu kunjungan dan halaman yang dibuka, dipakai untuk mengetahui bagian mana yang perlu diperbaiki.</>,
        ]} />

        <SubJudul>Yang TIDAK pernah sampai ke server kami</SubJudul>
        <Sorot>
          <Tegas>API key bursa dan token backend-mu disimpan di localStorage perambanmu sendiri.</Tegas>{' '}
          Keduanya tidak pernah dikirim ke server kami, tidak kami simpan, dan tidak bisa kami baca.
        </Sorot>
        <P>
          Konsekuensinya jujur kami sampaikan: kalau kamu berganti peramban atau perangkat, kamu
          harus mengisinya lagi — dan kalau kamu kehilangannya, kami tidak bisa memulihkannya untukmu.
          Itu harga dari rancangan ini, dan menurut kami sepadan. Kami juga tidak pernah meminta kata
          sandi akun bursamu, dan tidak akan pernah.
        </P>

        <SubJudul>Untuk apa data itu dipakai</SubJudul>
        <Daftar butir={[
          <>Memberi kamu akses ke fitur sesuai lisensi yang kamu miliki.</>,
          <>Menyimpan dan menampilkan kembali jurnal serta setelanmu.</>,
          <>Menghubungimu soal layanan — pembaruan penting, gangguan, dan urusan pembayaran.</>,
          <>Memperbaiki produk berdasarkan bagian mana yang benar-benar dipakai.</>,
        ]} />
        <P>
          Kami <Tegas>tidak menjual data pribadimu</Tegas> kepada siapa pun, dan tidak
          menukarkannya untuk iklan.
        </P>

        <SubJudul>Di mana data disimpan, dan siapa lagi yang terlibat</SubJudul>
        <Daftar butir={[
          <><Tegas>Google Firebase</Tegas> — autentikasi dan basis data jurnal.</>,
          <><Tegas>Server kami</Tegas> di Indonesia — lisensi, data pasar yang diteruskan, dan jembatan ke platform tradingmu.</>,
          <><Tegas>Discord</Tegas> — hanya bila kamu memilih masuk lewat Discord.</>,
          <><Tegas>Lynk.id</Tegas> — memproses pembayaran. Data kartu dan rekeningmu ditangani mereka, tidak pernah melewati kami.</>,
        ]} />

        <SubJudul>Hak kamu atas datamu</SubJudul>
        <P>
          Menurut UU PDP kamu berhak <Tegas>melihat</Tegas> data yang kami simpan tentangmu,{' '}
          <Tegas>membetulkannya</Tegas> bila keliru, <Tegas>meminta penghapusan</Tegas>, dan{' '}
          <Tegas>menarik persetujuan</Tegas> kapan saja. Kirim permintaan ke{' '}
          <Tegas>{BADAN.email}</Tegas> dari alamat email yang terdaftar di akunmu. Kami menjawab
          paling lambat 14 hari kerja.
        </P>
        <P>
          Jurnal dan data akun disimpan selama akunmu aktif. Bila kamu meminta penghapusan, data
          dihapus kecuali bagian yang wajib kami simpan untuk catatan pembayaran dan perpajakan.
        </P>

        <SubJudul>Penyimpanan lokal di perambanmu</SubJudul>
        <P>
          Kami memakai localStorage — bukan cookie pelacak — untuk menyimpan setelan tampilan,
          kurs, watchlist, serta API key dan token yang disebut di atas. Semuanya tinggal di
          perangkatmu dan hilang bila kamu membersihkan data situs ini.
        </P>
      </>
    ),
  },
  {
    id: 'ketentuan',
    judul: 'Syarat & Ketentuan',
    ringkas: 'Aturan pemakaian lisensi dan batas tanggung jawab.',
    Ikon: ScrollText,
    isi: (
      <>
        <P>
          Dengan membuat akun atau memakai layanan ini, kamu menyatakan telah membaca dan
          menyetujui ketentuan berikut beserta <Tegas>Disclaimer Risiko</Tegas> di bagian pertama
          halaman ini.
        </P>

        <SubJudul>Lisensi</SubJudul>
        <Daftar butir={[
          <>Lisensi diberikan untuk <Tegas>satu akun</Tegas> dan tidak dapat dipindahtangankan atau dijual kembali.</>,
          <>Kamu boleh memakainya di beberapa perangkat milikmu sendiri.</>,
          <>Berbagi akun dengan orang lain, menyebarkan berkas indikator atau EA, dan membongkar kode program tidak diperbolehkan.</>,
          <>Melanggar poin di atas mengakhiri lisensimu tanpa pengembalian dana.</>,
        ]} />

        <SubJudul>Layanan disediakan apa adanya</SubJudul>
        <P>
          Kami berusaha menjaga layanan tetap hidup dan benar, tetapi tidak menjanjikan layanan
          bebas gangguan atau bebas galat. Pemeliharaan, gangguan penyedia data, pembatasan dari
          bursa, dan masalah jaringan bisa membuat layanan tidak tersedia sementara.
        </P>

        <SubJudul>Batas tanggung jawab</SubJudul>
        <Sorot>
          Kami <Tegas>tidak bertanggung jawab atas kerugian trading</Tegas> yang kamu alami — baik
          yang timbul dari mengikuti keluaran sistem, dari galat perangkat lunak, dari data yang
          terlambat, maupun dari layanan yang sedang tidak tersedia.
        </Sorot>
        <P>
          Bila ada tanggung jawab yang secara hukum tidak dapat kami kesampingkan, nilainya
          dibatasi paling banyak sebesar biaya yang kamu bayarkan kepada kami dalam 12 bulan
          terakhir.
        </P>

        <SubJudul>Penghentian akses</SubJudul>
        <P>
          Kami dapat menghentikan akses bila terjadi pelanggaran ketentuan, penyalahgunaan sistem,
          atau upaya merusak layanan bagi pengguna lain. Kamu dapat berhenti kapan saja dengan
          meminta penghapusan akun.
        </P>

        <SubJudul>Perubahan dan hukum yang berlaku</SubJudul>
        <P>
          Ketentuan ini dapat berubah; perubahan berarti diumumkan lewat aplikasi. Ketentuan ini
          tunduk pada hukum Republik Indonesia.
        </P>
      </>
    ),
  },
  {
    id: 'refund',
    judul: 'Pengembalian Dana',
    ringkas: 'Kapan bisa, kapan tidak, dan cara mengajukannya.',
    Ikon: Receipt,
    isi: (
      <>
        <P>
          Produk kami berupa barang digital yang aksesnya terbuka segera setelah pembayaran
          terkonfirmasi. Karena itu ketentuannya berbeda dari barang fisik.
        </P>

        <SubJudul>Bisa dikembalikan</SubJudul>
        <Daftar butir={[
          <>Pembayaran berhasil tetapi akses <Tegas>tidak pernah aktif</Tegas> dan kami tidak dapat memperbaikinya dalam 3 hari kerja.</>,
          <>Terjadi pembayaran ganda untuk produk yang sama.</>,
          <>Produk yang kamu terima <Tegas>berbeda</Tegas> dari yang tertulis di halaman penjualan.</>,
        ]} />

        <SubJudul>Tidak bisa dikembalikan</SubJudul>
        <Daftar butir={[
          <>Berubah pikiran setelah lisensi aktif atau berkas sudah diunduh.</>,
          <>Hasil trading tidak sesuai harapan — ini bukan cacat produk, lihat <Tegas>Disclaimer Risiko</Tegas>.</>,
          <>Perangkat atau platformmu tidak memenuhi syarat yang sudah tertulis sebelum pembelian.</>,
          <>Lisensi dihentikan karena pelanggaran ketentuan.</>,
        ]} />

        <SubJudul>Cara mengajukan</SubJudul>
        <P>
          Kirim email ke <Tegas>{BADAN.email}</Tegas> paling lambat <Tegas>7 hari</Tegas> sejak
          pembayaran, sertakan bukti bayar dan penjelasan singkat. Kami menjawab dalam 3 hari kerja.
          Dana yang disetujui dikembalikan lewat jalur pembayaran yang sama, biasanya 7–14 hari
          kerja tergantung penyedia pembayaran.
        </P>
      </>
    ),
  },
];

export default function Legal() {
  const [aktif, setAktif] = useState(BAGIAN[0].id);
  const wadah = useRef<Record<string, HTMLDivElement | null>>({});

  /* Penanda bagian aktif mengikuti guliran, bukan hanya klik. Tanpa ini,
     orang yang menggulir sendiri melihat sorotan tertinggal di bagian yang
     sudah lama terlewat — dan mulai meragukan navigasinya. */
  useEffect(() => {
    const pengamat = new IntersectionObserver(
      (masuk) => {
        const terlihat = masuk
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (terlihat?.target.id) setAktif(terlihat.target.id);
      },
      { rootMargin: '-72px 0px -60% 0px' }
    );
    Object.values(wadah.current).forEach((el) => el && pengamat.observe(el));
    return () => pengamat.disconnect();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-50">Legal</h1>
        <p className="mt-1.5 text-[13px] text-zinc-500">
          Terakhir diperbarui {DIPERBARUI}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav className="lg:sticky lg:top-[72px] lg:self-start">
          {BAGIAN.map(({ id, judul, ringkas, Ikon }) => (
            <button
              key={id}
              onClick={() => wadah.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className={cn(
                'mb-1 flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors',
                aktif === id ? 'bg-zinc-800/70' : 'hover:bg-zinc-900'
              )}
            >
              <Ikon className={cn('mt-0.5 size-4 shrink-0', aktif === id ? 'text-zinc-100' : 'text-zinc-500')} strokeWidth={1.8} />
              <span className="min-w-0">
                <span className={cn('block text-[13px]', aktif === id ? 'text-zinc-100' : 'text-zinc-300')}>{judul}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-zinc-600">{ringkas}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-4">
          {BAGIAN.map(({ id, judul, ringkas, Ikon, isi }) => (
            <Panel key={id} className="min-w-0 p-6 sm:p-7">
              {/* id dan ref hidup di div INI saja, bukan juga di Panel.
                  Dua elemen dengan id sama membuat scrollIntoView dan
                  IntersectionObserver menunjuk simpul yang berbeda, dan
                  sorotan navigasi meleset satu bagian tanpa galat apa pun. */}
              <div ref={(el) => { wadah.current[id] = el; }} id={id} className="scroll-mt-[72px]">
                <div className="flex items-center gap-2.5">
                  <Ikon className="size-5 text-zinc-400" strokeWidth={1.8} />
                  <h2 className="text-[18px] font-semibold tracking-tight text-zinc-50">{judul}</h2>
                </div>
                <p className="mt-1.5 text-[13px] text-zinc-500">{ringkas}</p>
                <div className="mt-6 max-w-2xl space-y-4">{isi}</div>
              </div>
            </Panel>
          ))}

          {/* Identitas penyelenggara. Wajib ditampilkan untuk pedagang PMSE,
              dan sekaligus pembeda paling murah dari penjual anonim: nomor
              NIB bisa diperiksa siapa pun di OSS. */}
          <Panel className="p-6 sm:p-7">
            <div className="flex items-center gap-2.5">
              <Building2 className="size-5 text-zinc-400" strokeWidth={1.8} />
              <h2 className="text-[18px] font-semibold tracking-tight text-zinc-50">Penyelenggara</h2>
            </div>
            <div className="mt-5 max-w-2xl space-y-1.5 text-[13px] leading-relaxed text-zinc-400">
              <div className="text-zinc-200">{BADAN.nama}</div>
              <div>NIB {BADAN.nib}</div>
              <div>{BADAN.kota}</div>
              <div>
                <a href={`mailto:${BADAN.email}`} className="text-zinc-300 underline decoration-zinc-700 underline-offset-2 hover:decoration-zinc-400">
                  {BADAN.email}
                </a>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
