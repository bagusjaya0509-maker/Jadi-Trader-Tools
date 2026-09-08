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
import { Mail, MessageCircle, Send, Instagram, Loader2, Check } from 'lucide-react';
import { BADAN, WA_LINK, SOSMED } from '@/lib/badan';
import { PROXY_BAWAAN, bacaKoneksi } from '@/lib/koneksi';
import { cn } from '@/lib/utils';

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

/* TikTok tidak ada di lucide, dan itu bukan kelalaian: lucide menolak
   lambang merek karena lisensinya milik pemiliknya masing-masing. Jalur di
   bawah bentuk resmi yang disederhanakan, memakai `currentColor` supaya ia
   ikut warna tombol persis seperti ikon lucide di sebelahnya — memasang PNG
   hitam di sini akan lenyap di tema gelap. */
function IkonTikTok({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6c0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z" />
    </svg>
  );
}

const TAUTAN = [
  { ke: '/', teks: 'Beranda' },
  { ke: '/preview', teks: 'Lihat produk' },
  { ke: '/tour', teks: 'Coba tur' },
  { ke: '/legal', teks: 'Disclaimer & privasi' },
] as const;

function Footerdemo() {
  const [pesan, setPesan] = React.useState('');
  const [surelBalas, setSurelBalas] = React.useState('');
  const [sibuk, setSibuk] = React.useState(false);
  const [kabar, setKabar] = React.useState('');
  const [terkirim, setTerkirim] = React.useState(false);
  /* Pilihan saluran BARU MUNCUL sesudah tombol kirim ditekan. Diminta
     pemilik 8 Sep 2026: dua tombol yang berdiri terus di kaki halaman
     membuat kolom ini memanjang ke bawah untuk pilihan yang belum tentu
     dipakai. Satu tombol dulu — pilihannya menyusul setelah orangnya
     menyatakan memang mau mengirim. */
  const [pilihBuka, setPilihBuka] = React.useState(false);
  /* ── ALAMAT SUREL YANG SELALU BERBUAT SESUATU ────────────────────────
     Dilaporkan pemilik 8 Sep 2026: mengklik alamat di kolom "Badan usaha"
     tidak melakukan apa-apa. Tautannya sendiri benar — `mailto:` memang
     ada di sana — tapi `mailto:` hanya bekerja kalau mesin itu punya
     aplikasi surel bawaan yang terdaftar. Di komputer yang surelnya cuma
     dibuka lewat tab Gmail, mengkliknya memang tidak menghasilkan apa pun,
     dan yang mengklik tidak punya cara tahu kenapa.

     Jadi kliknya mengerjakan DUA hal sekaligus: `href` tetap mencoba
     membuka penyusun surat, dan penanganan kliknya menyalin alamatnya ke
     papan klip lalu mengatakannya. Yang punya aplikasi surel mendapat
     penyusun surat seperti biasa; yang tidak, tetap mendapat sesuatu yang
     terlihat dan alamat yang siap ditempel. */
  const [disalin, setDisalin] = React.useState(false);
  const salinSurel = () => {
    /* Dua jalur, karena yang pertama tidak selalu diizinkan. API papan klip
       modern menolak di konteks tanpa gestur yang ia akui dan di beberapa
       peramban lama; `execCommand` yang usang justru lolos di sana. Yang
       dipakai mana pun yang berhasil.

       Tandanya baru dinyalakan kalau penyalinannya BENAR-BENAR berhasil.
       Mengatakan "disalin" untuk sesuatu yang tidak tersalin membuat orang
       menempelkan papan klip lamanya ke kolom penerima. */
    const tandai = () => {
      setDisalin(true);
      window.setTimeout(() => setDisalin(false), 2200);
    };
    const cadangan = () => {
      try {
        const kotak = document.createElement('textarea');
        kotak.value = BADAN.email;
        kotak.setAttribute('readonly', '');
        kotak.style.cssText = 'position:fixed;top:-9999px;opacity:0';
        document.body.appendChild(kotak);
        kotak.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(kotak);
        if (ok) tandai();
      } catch { /* menyerah — mailto tetap jalan */ }
    };
    try {
      const p = navigator.clipboard?.writeText(BADAN.email);
      if (p) p.then(tandai).catch(cadangan);
      else cadangan();
    } catch { cadangan(); }
  };

  /* Kotak isian ini BUKAN pendaftaran buletin seperti di sumbernya —
     tidak ada layanan buletin di belakangnya, dan kotak yang tidak
     tersambung ke mana-mana cuma menampung pertanyaan yang tidak pernah
     terbaca.

     DUA JALAN KELUAR, diminta pemilik 8 Sep 2026. Sebelumnya cuma
     WhatsApp, dan itu memaksa orang membuka aplikasi lain — atau, di
     desktop tanpa WhatsApp terpasang, tidak ke mana-mana sama sekali. */
  const keWhatsApp = () => {
    const isi = pesan.trim();
    window.open(isi ? `${WA_LINK}?text=${encodeURIComponent(isi)}` : WA_LINK, '_blank', 'noopener');
  };

  /* Lewat backend sendiri (Resend), BUKAN FormSubmit. Jalur surelnya sudah
     ada dan sudah terbukti jalan; menambah pihak ketiga berarti satu
     pendaftaran lagi dan satu layanan lagi yang bisa mati tanpa kabar.

     Pesannya juga DISIMPAN di sisi server, bukan cuma dikirim. Kalau
     suratnya tersendat, pertanyaannya tetap terbaca di panel Maintenance —
     jadi tidak ada pertanyaan yang hilang karena satu layanan luar sedang
     turun. */
  const keSurel = async () => {
    const isi = pesan.trim();
    if (isi.length < 3) { setKabar('Tulis pertanyaanmu dulu.'); return; }
    setSibuk(true); setKabar('');
    try {
      const dasar = (bacaKoneksi().url.trim() || PROXY_BAWAAN).replace(/\/+$/, '');
      const r = await fetch(`${dasar}/api/tanya`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pesan: isi,
          dari: surelBalas.trim(),
          halaman: window.location.pathname + window.location.search,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `Server menjawab ${r.status}`);
      setPesan(''); setSurelBalas(''); setTerkirim(true); setPilihBuka(false);
      setKabar(surelBalas.trim()
        ? 'Terkirim. Balasannya akan masuk ke alamat itu.'
        : 'Terkirim. Tulis alamat surelmu lain kali kalau mau dibalas.');
    } catch (err) {
      setKabar(err instanceof Error ? err.message : 'Gagal mengirim.');
    } finally { setSibuk(false); }
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
            <form
              className="space-y-2.5"
              onSubmit={(e) => { e.preventDefault(); if (pesan.trim().length >= 3) setPilihBuka(true); else setKabar('Tulis pertanyaanmu dulu.'); }}
            >
              <div className="relative">
                <label htmlFor="tanya" className="sr-only">
                  Tulis pertanyaanmu
                </label>
                <Input
                  id="tanya"
                  type="text"
                  value={pesan}
                  onChange={(e) => { setPesan(e.target.value); setTerkirim(false); setKabar(''); }}
                  placeholder="Tulis pertanyaanmu di sini"
                  className="pr-12 backdrop-blur-sm"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="absolute right-1 top-1 h-8 w-8 rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
                >
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Pilih cara mengirim</span>
                </Button>
              </div>

              {/* ── PILIHAN SALURAN ────────────────────────────────────────
                  Muncul hanya sesudah tombol kirim ditekan, dan hilang lagi
                  begitu pesannya benar-benar terkirim. Alamat balasan ikut
                  di sini, bukan berdiri sendiri di atas: ia cuma berguna
                  untuk jalur surel, dan isian yang tidak berguna untuk
                  jalur yang sedang dipilih hanya menambah yang harus
                  dilewati. */}
              {pilihBuka && !terkirim && (
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-2.5">
                  <label htmlFor="tanya-surel" className="sr-only">
                    Alamat surelmu, opsional
                  </label>
                  <Input
                    id="tanya-surel"
                    type="email"
                    value={surelBalas}
                    onChange={(e) => setSurelBalas(e.target.value)}
                    placeholder="Email kamu (opsional, agar bisa dibalas)"
                    className="h-9 backdrop-blur-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={keSurel} disabled={sibuk} className="flex-1 gap-2">
                      {sibuk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      Email
                    </Button>
                    <Button type="button" variant="outline" onClick={keWhatsApp} className="flex-1 gap-2">
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </Button>
                  </div>
                </div>
              )}

              {kabar && (
                <p className={cn('flex items-start gap-1.5 text-xs leading-relaxed',
                  terkirim ? 'text-emerald-500' : 'text-muted-foreground')}>
                  {terkirim && <Check className="mt-px h-3.5 w-3.5 shrink-0" />}
                  {kabar}
                </p>
              )}
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
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <a
                  href={`mailto:${BADAN.email}?subject=${encodeURIComponent('Pertanyaan untuk Jadi Trader Tools')}`}
                  onClick={salinSurel}
                  className="transition-colors hover:text-foreground"
                >
                  {BADAN.email}
                </a>
                {disalin && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                    <Check className="h-3 w-3" /> alamat disalin
                  </span>
                )}
              </p>
            </address>
          </div>

          <div className="relative">
            {/* "Hubungi & ikuti", bukan "Hubungi kami" saja. Dua tombol
                pertama memang saluran bantuan; dua yang baru bukan — dan
                judul yang menjanjikan bantuan lalu menyodorkan Instagram
                membuat orang mengira DM di sana dijawab secepat WhatsApp. */}
            <h3 className="mb-4 text-lg font-semibold">Hubungi &amp; ikuti</h3>
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
                      {/* Perihal diisikan supaya penyusun suratnya terbuka
                          dengan konteks, bukan halaman kosong yang harus
                          dijudulinya sendiri.

                          Kalau tidak ada yang terbuka sama sekali, itu
                          bukan tautannya: mesin itu belum punya aplikasi
                          surel bawaan. Untuk keadaan itu ada kotak tanya di
                          kolom pertama kaki halaman ini — ia mengirim tanpa
                          aplikasi apa pun. */}
                      <a href={`mailto:${BADAN.email}?subject=${encodeURIComponent('Pertanyaan untuk Jadi Trader Tools')}`}>
                        <Mail className="h-4 w-4" />
                        <span className="sr-only">Surel</span>
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{BADAN.email}</p>
                  </TooltipContent>
                </Tooltip>

                {/* Sosial ditaruh SESUDAH saluran bantuan, bukan sebelumnya.
                    Yang datang ke footer dengan pertanyaan mendesak mencari
                    WhatsApp; yang penasaran akan tetap menemukan Instagram
                    walau ia nomor tiga. */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className={SASARAN} asChild>
                      <a href={SOSMED.instagram} target="_blank" rel="noopener noreferrer">
                        <Instagram className="h-4 w-4" />
                        <span className="sr-only">Instagram</span>
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Instagram {SOSMED.igTampil}</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className={SASARAN} asChild>
                      <a href={SOSMED.tiktok} target="_blank" rel="noopener noreferrer">
                        <IkonTikTok className="h-4 w-4" />
                        <span className="sr-only">TikTok</span>
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>TikTok {SOSMED.tiktokTampil}</p>
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
              {/* <a> polos, BUKAN <Link>: /artikel/ berkas HTML statis di luar
                  router React. <Link> akan menanganinya di sisi klien, router
                  tidak punya rute itu, dan pengunjung mendarat di halaman
                  kosong — padahal alamatnya benar. */}
              <a href="/artikel/" className="text-muted-foreground transition-colors hover:text-foreground">
                Artikel
              </a>
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
