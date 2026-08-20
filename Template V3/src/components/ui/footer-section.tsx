'use client';

import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Mail, MessageCircle, Send } from 'lucide-react';
import { BADAN, WA_LINK } from '@/lib/badan';

/* ════════════════════════════════════════════════════════════════════════
   FOOTER — kerangka tempelan, isi milik sendiri
   ════════════════════════════════════════════════════════════════════════
   Tata letaknya ditempel utuh dari komponen sumbernya: empat kolom, kolom
   pertama dengan kotak isian berpeluru kirim di dalamnya dan bulatan kabur
   di pojoknya, lalu bilah bawah yang dipisah garis. Itu yang diminta, dan
   itu yang dipertahankan.

   Yang TIDAK ikut ditempel, beserta alasannya — supaya siapa pun yang
   membandingkan dengan sumbernya tahu ini disengaja:

   1. SAKELAR MODE GELAP. Sumbernya menambah/mencabut kelas `dark` di
      <html>. Yang dipakai situs ini atribut `data-tema`, dipegang sakelar
      di kepala aplikasi — jadi sakelar kedua di kaki halaman cuma akan
      jadi tombol kedua untuk hal yang sama, di tempat yang paling jarang
      dilihat orang.

      KOREKSI 20 Agu 2026 untuk catatan lama di sini: dulu tertulis "situs
      ini dikunci gelap" dan "sakelarnya tidak mengerjakan apa pun". Dua
      duanya sudah tidak benar. Tema terang sungguhan ada sejak blok
      [data-tema='terang'] di index.css, dan class="dark" di index.html
      TIDAK PERNAH mengendalikan varian `dark:` — varian itu bawaannya
      mengikuti setelan sistem operasi, bukan kelas. Keyakinan bahwa
      keduanya sama itulah yang membuat judul halaman harga hilang di HP
      bertema terang. Sekarang `dark:` sudah diikatkan ke `data-tema`
      lewat @custom-variant; lihat catatannya di index.css.

   2. Textarea. Diimpor di sumbernya tapi tidak pernah dipakai. tsconfig
      menyalakan noUnusedLocals, jadi menempelnya apa adanya menggagalkan
      build — bukan peringatan, gagal.

   3. Facebook / Twitter / Instagram / LinkedIn. Belum ada satu pun akunnya.
      Tombol yang menuju href="#" terlihat seperti tautan rusak. Tinggal
      ditambahkan satu baris per akun begitu akunnya jadi.

   4. Alamat "123 Innovation Street" dan "© 2024 Your Company". Diganti
      data sungguhan dari lib/badan.ts.

   ── YANG WAJIB ADA DAN TIDAK BOLEH HILANG ──────────────────────────────
   Disclaimer OJK/Bappebti dan identitas badan usaha. Sebelum footer ini,
   keduanya HANYA ada di /landing — halaman yang tidak ditautkan dari mana
   pun. Halaman yang benar-benar tayang di "/" sama sekali tidak punya
   footer, jadi situs ini praktis tampil ke publik tanpa disclaimer dan
   tanpa identitas hukum. Itu yang ditutup di sini.
   ════════════════════════════════════════════════════════════════════════ */

/* Tautan cepat SENGAJA hanya yang bisa dibuka tanpa login. /docs dan
   /changelog ada di balik Kerangka; footer lama di /landing menautkannya
   dan siapa pun yang mengkliknya dipantulkan ke halaman minta-akses. */
/* Tombol ikon shadcn berukuran 40x40 (size="icon" = h-10 w-10), dan jari
   butuh 44. Diukur di lebar 375 px sebelum aturan ini ditambahkan: 40x40,
   kurang empat piksel di tiap sisi.

   Yang dilebarkan SASARANNYA, bukan tombolnya — lingkaran 44 px di footer
   terlihat gemuk di sebelah teksnya. Lapisan semunya tak terlihat, dan
   -inset-1 dihitung dari PADDING BOX: varian outline punya border 1 px, jadi
   40 - 2 = 38, lalu 38 + 8 = 46 px. Angka yang "kelihatan benar" (-inset-[2px]
   untuk mencapai 44) sebenarnya cuma menghasilkan 42. */
const SASARAN = "relative rounded-full after:absolute after:-inset-1 after:content-['']";

const TAUTAN = [
  { ke: '/', teks: 'Beranda' },
  { ke: '/preview', teks: 'Lihat produk' },
  { ke: '/tour', teks: 'Coba tur' },
  { ke: '/legal', teks: 'Disclaimer & privasi' },
] as const;

function Footerdemo() {
  const [pesan, setPesan] = React.useState('');

  /* Kotak isian ini BUKAN pendaftaran buletin seperti di sumbernya —
     tidak ada layanan buletin di belakangnya, dan kotak yang tidak
     tersambung ke mana-mana cuma menampung pertanyaan yang tidak pernah
     terbaca. Ia membuka WhatsApp dengan pesannya sudah terisi; yang
     menekan kirim tetap orangnya sendiri. */
  const kirim = (e: React.FormEvent) => {
    e.preventDefault();
    const isi = pesan.trim();
    window.open(isi ? `${WA_LINK}?text=${encodeURIComponent(isi)}` : WA_LINK, '_blank', 'noopener');
  };

  return (
    <footer className="relative border-t border-border bg-background text-foreground">
      {/* max-w-6xl, bukan angka bebas: diukur di browser, seksi tepat di
          atas footer ini (FeaturesGrid) memakai max-w-6xl dan tepi kirinya
          jatuh di 151 px. Footer dengan lebar sendiri membuat tepi kiri
          halaman patah persis di sambungannya — kelihatan sebagai kolom
          yang melenceng, bukan sebagai footer yang lebih lega. */}
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            {/* Kalimatnya sudah dua kali diganti; yang berlaku sekarang
                dipilih pemiliknya sendiri. Yang perlu diketahui pembaca kode
                berikutnya cuma satu hal, dan tidak terlihat dari kalimatnya:
                kotak ini TIDAK mengirim ke server mana pun. Ia membuka
                WhatsApp dengan pesannya sudah terisi, dan yang menekan kirim
                tetap orangnya sendiri.

                Jadi kalau kalimatnya suatu saat diubah lagi, jangan
                menjanjikan balasan otomatis, nomor tiket, atau jam operasi —
                tidak ada satu pun yang berdiri di belakangnya. */}
            <h2 className="mb-4 text-3xl font-bold tracking-tight">Ada yang mau ditanyakan?</h2>
            <p className="mb-6 text-muted-foreground">
              Tulis di sini, pesanmu akan diterima dan dibantu lebih responsif oleh customer service.
            </p>
            <form className="relative" onSubmit={kirim}>
              <label htmlFor="tanya" className="sr-only">
                Tulis pertanyaanmu
              </label>
              <Input
                id="tanya"
                type="text"
                value={pesan}
                onChange={(e) => setPesan(e.target.value)}
                placeholder="Tulis pertanyaanmu di sini"
                className="pr-12 backdrop-blur-sm"
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-1 top-1 h-8 w-8 rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Kirim lewat WhatsApp</span>
              </Button>
            </form>
            <div className="absolute -right-4 top-0 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold">Tautan cepat</h3>
            <nav className="space-y-2 text-sm">
              {TAUTAN.map((t) => (
                <Link
                  key={t.ke}
                  to={t.ke}
                  className="block text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t.teks}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold">Badan usaha</h3>
            {/* Nama badan, NOMOR NIB, dan WILAYAH — tanpa nama kota.
                Nomor NIB itu yang bisa diperiksa siapa pun di OSS, dan
                itulah gunanya dipajang.

                TDPSE dicabut atas permintaan pemiliknya; nilainya masih ada
                di lib/badan.ts dan tetap dipakai halaman Legal, karena di
                sana ia memang diperlukan untuk UU PDP. */}
            <address className="space-y-2 text-sm not-italic text-muted-foreground">
              <p className="text-foreground">{BADAN.nama}</p>
              <p>NIB {BADAN.nib}</p>
              <p>{BADAN.wilayah}</p>
              <p>
                <a
                  href={`mailto:${BADAN.email}`}
                  className="transition-colors hover:text-foreground"
                >
                  {BADAN.email}
                </a>
              </p>
            </address>
          </div>

          <div className="relative">
            <h3 className="mb-4 text-lg font-semibold">Hubungi kami</h3>
            <div className="flex space-x-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className={SASARAN} asChild>
                      <a href={WA_LINK} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4" />
                        <span className="sr-only">WhatsApp</span>
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>WhatsApp {BADAN.waTampil}</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className={SASARAN} asChild>
                      <a href={`mailto:${BADAN.email}`}>
                        <Mail className="h-4 w-4" />
                        <span className="sr-only">Surel</span>
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{BADAN.email}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Senin–Sabtu, 09.00–21.00 WITA.
            </p>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8">
          {/* Teks ini dipindahkan UTUH dari footer /landing. Ia bukan hiasan:
              tanpa kalimat "bukan nasihat investasi", alat analisa pasar
              yang dijual berlangganan mudah terbaca sebagai jasa penasihat
              — wilayah OJK/Bappebti, bukan wilayah kami. */}
          <p className="max-w-[720px] text-[12px] leading-relaxed text-zinc-500">
            Jadi Trader Tools menjual lisensi perangkat lunak alat bantu analisa pasar.{' '}
            <span className="text-zinc-400">
              Bukan nasihat investasi, dan kami tidak pernah mengelola dana siapa pun.
            </span>{' '}
            Trading berisiko kehilangan seluruh modal — hasil masa lalu bukan jaminan hasil
            di masa depan.
          </p>

          <div className="mt-6 flex flex-col items-center justify-between gap-4 text-center text-sm md:flex-row md:text-left">
            <p className="text-muted-foreground">© 2026 {BADAN.nama}. Semua hak dilindungi.</p>
            {/* "Harga & akses" dicabut di sini juga. Footer memuatnya DUA
                kali — sekali di tautan cepat, sekali di baris bawah — dan
                mencabut yang pertama saja meninggalkan yang kedua tetap
                tayang. */}
            <nav className="flex gap-4">
              <Link to="/legal" className="text-muted-foreground transition-colors hover:text-foreground">
                Disclaimer &amp; privasi
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}

export { Footerdemo };
