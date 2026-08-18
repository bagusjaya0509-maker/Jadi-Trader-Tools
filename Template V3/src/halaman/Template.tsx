import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRightIcon, EyeIcon,
  GlobeIcon, LayersIcon, UserPlusIcon, Users, Star,
  FileText, Shield, RotateCcw, Handshake, HelpCircle, BarChart, PlugIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ParallaxComponent } from '@/components/ui/parallax-scrolling';
import { Footerdemo } from '@/components/ui/footer-section';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { cn } from '@/lib/utils';
import { LogoJT } from '@/components/logo-jt';
import { Component as FeaturesGrid } from '@/components/ui/featuresgrid';
import StoryScrollDemo from '@/components/ui/story-scroll-demo';

/* ════════════════════════════════════════════════════════════════════════
   TEMPLATE — header-3 + hero-3 APA ADANYA
   ════════════════════════════════════════════════════════════════════════
   Kerangkanya salinan utuh template aslinya — copy bahasa Inggris, menu
   Website Builder / Cloud Platform, tata letak header + hero apa adanya.

   SATU bagian sekarang berisi milik kita: kotak gambar di hero, yang
   tadinya tangkapan layar dashboard dari CDN efferd, diganti tur lima
   layar aplikasi sendiri (lihat story-scroll-demo.tsx). Itu memang yang
   diminta pemilik — kotak itu bagian yang paling masuk akal diganti,
   karena di sanalah template menaruh "produknya".

   Sisanya tetap tidak tahu apa-apa tentang kita: tidak ada tautan ke
   halaman kami, dan tidak satu pun angka kami di dalam copy-nya.

   Kenapa berdiri sendiri: mencampur template dengan isi sungguhan membuat
   dua hal yang berbeda sifat sulit dibedakan. Kalau template ini kelak
   diperbarui dari sumbernya, yang perlu diganti cuma berkas ini — tidak ada
   satu pun kalimat milik kami yang ikut hilang di dalamnya.

   Seluruh isinya milik pembuat template (efferd / sshahaider) dan dipakai
   sebagai acuan tampilan, bukan sebagai halaman jualan kami.

   Alamat: #/template — tidak ditautkan dari mana pun.
   ════════════════════════════════════════════════════════════════════════ */

type LinkItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

/* ── Hero ──────────────────────────────────────────────────────────────
   Satu-satunya penyimpangan dari salinan mentah: `--theme(...)` dan
   `mask-b-from-60%` menuntut Tailwind 4.1 sementara proyek ini mematok
   ^4.0.0. Diganti nilai yang setara persis secara visual, supaya
   tampilannya tidak bergantung pada versi minor pustaka. */
function HeroSection() {
  return (
    <section className="mx-auto w-full max-w-5xl overflow-hidden pt-16">
      {/* Shades */}
      <div aria-hidden="true" className="absolute inset-0 size-full overflow-hidden">
        {/* Cahaya DIPINDAH ke tengah atas (18% -> 50%): ditaruh di 18% ia
            jatuh di bahu kiri judul saja, dan sorotan yang tidak simetris
            pada latar zinc-950 terbaca sebagai layar yang bocor cahayanya,
            bukan sebagai sorotan yang disengaja.

            ── KENAPA BUKAN DUA WARNA LAGI ──────────────────────────────
            Dua stop memberi kenaikan alpha yang LURUS, dan mata menajamkan
            patahan di ujung ramp lurus (pita Mach). Stop berlapis di bawah
            ini melengkungkan peluruhannya sehingga tidak ada satu titik pun
            tempat lajunya berubah mendadak.

            CATATAN, supaya tidak "diperbaiki" balik nanti: ujung
            rgba(255,255,255,0) dipakai karena lebih jelas dibaca, BUKAN
            karena `transparent` menggeser warna ke abu-abu. Dugaan itu
            sudah diukur di peramban ini dan tidak terbukti — gradien CSS
            diinterpolasi dalam ruang premultiplied, dan kedua jalur
            berakhir di warna yang sama persis di atas zinc-950. Yang
            benar-benar menghaluskan sambungannya adalah stop berlapis,
            radius yang lebih lebar, dan hilangnya potongan kotak.

            Ditulis sebagai style, bukan kelas Tailwind: enam stop menjadi
            satu kelas arbitrer sepanjang baris yang tidak bisa dibaca lagi,
            dan satu spasi yang terlewat di sana membuatnya diam-diam tidak
            tergenerasi sama sekali. */}
        <div
          className="absolute inset-0 isolate -z-10"
          style={{
            backgroundImage:
              'radial-gradient(46% 55% at 50% 0%,'
              + 'rgba(255,255,255,0.10) 0%,'
              + 'rgba(255,255,255,0.088) 18%,'
              + 'rgba(255,255,255,0.060) 38%,'
              + 'rgba(255,255,255,0.032) 57%,'
              + 'rgba(255,255,255,0.013) 75%,'
              + 'rgba(255,255,255,0.004) 88%,'
              + 'rgba(255,255,255,0) 100%)',
          }}
        />
      </div>
      <div className="relative z-10 flex max-w-2xl flex-col gap-5 px-4">
        {/* Lencana "NOW · accepting new client projects" DIBUANG. Ia milik
            template agensi yang menjual jasa; kami menjual alat, tidak
            menerima proyek klien, dan tautannya pun menuju #link yang tidak
            ada. Kalimat yang tidak benar di baris pertama halaman depan
            merusak setiap kalimat sesudahnya. */}
        <h1
          className={cn(
            'text-balance font-medium text-4xl text-foreground leading-tight md:text-5xl',
            'fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-100 duration-500 ease-out',
          )}
        >
          Latih Psikologi &amp; Skill Trading Dalam 1 Halaman Tools
        </h1>

        <p
          className={cn(
            'text-muted-foreground text-sm tracking-wider sm:text-lg md:text-xl',
            'fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-200 duration-500 ease-out',
          )}
        >
          Jadi Trader Tools Membantu Traders disiplin jurnaling,{' '}
          <br className="hidden sm:block" />Latih Skill Lewat Chart Replay dan Screening
        </p>

        {/* Dua tombol template diganti dua pintu SUNGGUHAN — inilah satu-
            satunya bagian copy template yang menunjuk ke isi kami, dan ia
            ditaruh di sini karena di sinilah orang berhenti setelah
            melihat tur layarnya di kotak bawah.

            Urutannya disengaja: pratinjau dulu (murah, tanpa komitmen),
            baru akses 30 hari. Menaruh yang berbayar lebih dulu memaksa
            orang memutuskan sebelum ia melihat apa pun. */}
        <div className="fade-in slide-in-from-bottom-10 flex w-fit animate-in flex-wrap items-center gap-3 fill-mode-backwards pt-2 delay-300 duration-500 ease-out">
          {/* Corongnya berurut dari yang paling murah: lihat dulu tanpa
              mendaftar, baru coba dengan akun sendiri, baru ambil akses.
              Menaruh pendaftaran di langkah pertama memaksa orang
              memutuskan sebelum ia tahu barangnya apa. */}
          <Button asChild>
            <Link to="/preview">
              <EyeIcon className="size-4 mr-2" data-icon="inline-start" /> Lihat preview
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/akses">
              Ambil akses 30 hari <ArrowRightIcon className="size-4 ml-2" data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
      <div className="relative">
        {/* Dulu satu bulatan besar: -inset-x-20 menjulur 80px melewati kedua
            sisi dan scale-120 melebarkannya lagi, sehingga cahayanya keluar
            di kiri, kanan, dan bawah gambar — tiga tepi yang seharusnya
            gelap. Sekarang dipaku ke tepi ATAS saja.

            Tingginya TIDAK lagi dipotong h-1/2. Kotak yang dipotong memberi
            batas keras di tempat peluruhannya belum selesai, dan `blur`
            tidak menyembunyikannya — ia justru menegaskan garisnya. Yang
            membatasi sekarang gradiennya sendiri: ia sudah mencapai alpha
            nol jauh sebelum dasar kotak.

            Stop berlapis dengan alasan yang sama seperti cahaya hero di
            atas, dan blur dinaikkan 50 -> 60px karena radiusnya kini lebih
            lebar. */}
        <div
          className="absolute inset-0 blur-[60px]"
          style={{
            backgroundImage:
              'radial-gradient(58% 62% at 50% 0%,'
              + 'rgba(255,255,255,0.16) 0%,'
              + 'rgba(255,255,255,0.140) 18%,'
              + 'rgba(255,255,255,0.095) 38%,'
              + 'rgba(255,255,255,0.050) 57%,'
              + 'rgba(255,255,255,0.020) 75%,'
              + 'rgba(255,255,255,0.006) 88%,'
              + 'rgba(255,255,255,0) 100%)',
          }}
        />
        <div
          className={cn(
            'relative mt-8 -mr-56 overflow-hidden px-2 sm:mt-12 sm:mr-0 md:mt-20',
            'fade-in slide-in-from-bottom-5 animate-in fill-mode-backwards delay-100 duration-1000 ease-out',
          )}
          style={{
            maskImage: 'linear-gradient(to bottom, black 60%, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent)',
          }}
        >
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-lg border bg-background p-2 shadow-xl ring-1 ring-card">
            {/* Kotak gambar hero: dulu tangkapan layar dashboard dari CDN
                efferd, sekarang template story-scroll yang HIDUP — digulir
                di dalam kotaknya sendiri, seksi-seksinya berputar masuk dan
                menumpuk persis seperti demo aslinya. Rasio 16:9 dipertahankan
                supaya bingkai, mask peluruhan, dan sambungan ke featuresgrid
                di bawahnya tidak bergeser sedikit pun. */}
            <div className="aspect-video overflow-hidden rounded-lg border">
              <StoryScrollDemo />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Header ────────────────────────────────────────────────────────────── */
function Header() {
  const [open, setOpen] = React.useState(false);
  const scrolled = useScroll(10);

  React.useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <header
      className={cn('sticky top-0 z-50 w-full border-b border-transparent', {
        'bg-background/95 supports-[backdrop-filter]:bg-background/50 border-border backdrop-blur-lg': scrolled,
      })}
    >
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-5">
          <a href="#" className="hover:bg-accent rounded-md p-2">
            <WordmarkIcon />
          </a>
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent">Product</NavigationMenuTrigger>
                <NavigationMenuContent className="bg-background p-1 pr-1.5">
                  <ul className="bg-popover grid w-lg grid-cols-2 gap-2 rounded-md border p-2 shadow">
                    {productLinks.map((item, i) => (
                      <li key={i}><ListItem {...item} /></li>
                    ))}
                  </ul>
                  <div className="p-2">
                    <p className="text-muted-foreground text-sm">
                      Belum yakin?{' '}
                      <a href="#/preview" className="text-foreground font-medium hover:underline">
                        Lihat preview dulu
                      </a>
                    </p>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent">Company</NavigationMenuTrigger>
                <NavigationMenuContent className="bg-background p-1 pr-1.5 pb-1.5">
                  <div className="grid w-lg grid-cols-2 gap-2">
                    <ul className="bg-popover space-y-2 rounded-md border p-2 shadow">
                      {companyLinks.map((item, i) => (
                        <li key={i}><ListItem {...item} /></li>
                      ))}
                    </ul>
                    <ul className="space-y-2 p-3">
                      {companyLinks2.map((item, i) => (
                        <li key={i}>
                          <NavigationMenuLink
                            href={item.href}
                            className="flex p-2 hover:bg-accent flex-row rounded-md items-center gap-x-2"
                          >
                            <item.icon className="text-foreground size-4" />
                            <span className="font-medium">{item.title}</span>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuLink className="px-4" asChild>
                <a href="#/akses" className="hover:bg-accent rounded-md p-2">Harga &amp; Akses</a>
              </NavigationMenuLink>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {/* Dua tombol template ini dulu tidak menuju ke mana pun. Tombol
              mati di pojok kanan atas halaman depan adalah tempat pertama
              orang menekan saat sudah tertarik. */}
          <Button variant="outline" asChild><a href="#/preview">Lihat preview</a></Button>
          <Button asChild><a href="#/akses">Ambil akses</a></Button>
        </div>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setOpen(!open)}
          className="md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label="Toggle menu"
        >
          <MenuToggleIcon open={open} className="size-5" duration={300} />
        </Button>
      </nav>
      <MobileMenu open={open} className="flex flex-col justify-between gap-2 overflow-y-auto">
        <NavigationMenu className="max-w-full">
          <div className="flex w-full flex-col gap-y-2">
            <span className="text-sm">Product</span>
            {productLinks.map((link) => (<ListItem key={link.title} {...link} />))}
            <span className="text-sm">Company</span>
            {companyLinks.map((link) => (<ListItem key={link.title} {...link} />))}
            {companyLinks2.map((link) => (<ListItem key={link.title} {...link} />))}
          </div>
        </NavigationMenu>
        <div className="flex flex-col gap-2">
          <Button variant="outline" className="w-full bg-transparent">Sign In</Button>
          <Button className="w-full">Get Started</Button>
        </div>
      </MobileMenu>
    </header>
  );
}

type MobileMenuProps = React.ComponentProps<'div'> & { open: boolean };

function MobileMenu({ open, children, className, ...props }: MobileMenuProps) {
  if (!open || typeof window === 'undefined') return null;

  return createPortal(
    <div
      id="mobile-menu"
      className={cn(
        'bg-background/95 supports-[backdrop-filter]:bg-background/50 backdrop-blur-lg',
        'fixed top-14 right-0 bottom-0 left-0 z-40 flex flex-col overflow-hidden border-y md:hidden',
      )}
    >
      <div
        data-slot={open ? 'open' : 'closed'}
        className={cn('data-[slot=open]:animate-in data-[slot=open]:zoom-in-97 ease-out', 'size-full p-4', className)}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function ListItem({
  title, description, icon: Icon, className, href, ...props
}: React.ComponentProps<typeof NavigationMenuLink> & LinkItem) {
  return (
    <NavigationMenuLink
      className={cn(
        'w-full flex flex-row gap-x-2 data-[active=true]:focus:bg-accent data-[active=true]:hover:bg-accent data-[active=true]:bg-accent/50 data-[active=true]:text-accent-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground rounded-sm p-2',
        className,
      )}
      {...props}
      asChild
    >
      <a href={href}>
        <div className="bg-background/40 flex aspect-square size-12 items-center justify-center rounded-md border shadow-sm">
          <Icon className="text-foreground size-5" />
        </div>
        <div className="flex flex-col items-start justify-center">
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground text-xs">{description}</span>
        </div>
      </a>
    </NavigationMenuLink>
  );
}

const productLinks: LinkItem[] = [
  { title: 'Screener Area',  href: '#/screener',  description: 'Koin Hunter & Zona Pantau — pindai ratusan simbol Binance', icon: BarChart },
  { title: 'Chart & Entry',  href: '#/chart',     description: 'Chart, alat gambar, dan Replay untuk latihan eksekusi',    icon: LayersIcon },
  { title: 'Journal',        href: '#/jurnal',    description: 'Catat trade, emosi, dan alasan — dari MT5 & Binance',      icon: FileText },
  { title: 'Copy Signal',    href: '#/copy',      description: 'Sinyal analis lain, dinilai dari performa sinyalnya',      icon: UserPlusIcon },
  { title: 'Marketplace',    href: '#/marketplace', description: 'EA, indikator, dan alat bantu trading',                  icon: GlobeIcon },
  { title: 'Integrations',   href: '#/integrasi', description: 'Sambungkan MetaTrader 5 dan Binance Futures',              icon: PlugIcon },
];

const companyLinks: LinkItem[] = [
  { title: 'Personal Area',  href: '#/personal', description: 'Rekap performa dan evaluasi caramu berdagang', icon: Users },
  { title: 'Papan peringkat', href: '#/copy',    description: 'Rekam jejak analis, dihitung dari sinyal yang selesai', icon: Star },
  { title: 'Jadi analis',    href: '#/copy?sub=posting', description: 'Posting sinyalmu sendiri — semua orang boleh', icon: Handshake },
];

const companyLinks2: LinkItem[] = [
  { title: 'Disclaimer & Ketentuan', href: '#/legal',       icon: FileText },
  { title: 'Kebijakan Privasi',      href: '#/legal',       icon: Shield },
  { title: 'Changelog',              href: '#/changelog',   icon: RotateCcw },
  { title: 'Dokumentasi',            href: '#/dokumentasi', icon: HelpCircle },
];

function useScroll(threshold: number) {
  const [scrolled, setScrolled] = React.useState(false);

  const onScroll = React.useCallback(() => {
    setScrolled(window.scrollY > threshold);
  }, [threshold]);

  React.useEffect(() => {
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  React.useEffect(() => { onScroll(); }, [onScroll]);

  return scrolled;
}

/* Logotype "efferd" milik pembuat template diganti lambang + nama kita.
   Dipakai LogoJT yang sama dengan sidebar dan favicon — satu lambang untuk
   seluruh produk; halaman depan yang memakai lambang berbeda dari
   aplikasinya membuat orang mengira ia sampai di situs lain. */
const WordmarkIcon = ({ className }: { className?: string }) => (
  <span className={cn('flex items-center gap-2', className)}>
    <LogoJT className="size-[18px] shrink-0 text-foreground" />
    <span className="whitespace-nowrap font-semibold tracking-tight text-[15px]">
      Jadi Trader <span className="text-muted-foreground">Tools</span>
    </span>
  </span>
);

export default function Template() {
  /* ── HALAMAN DEPAN SELALU GELAP ──────────────────────────────────────
     Tema terang milik aplikasi setelah login, bukan halaman jualan ini:
     hero-nya foto gunung malam, featuresgrid-nya hitam pekat, dan
     keduanya memang dirancang gelap. Pengguna yang sudah memilih tema
     terang lalu membuka halaman ini akan melihat teks putih di atas
     putih — bukan karena temanya salah, tapi karena halaman ini tidak
     pernah ikut temanya.

     Pilihannya TIDAK dihapus, cuma dilepas selama halaman ini terpasang
     dan dipasang lagi saat ditinggalkan. Menghapusnya berarti orang
     kehilangan preferensinya cuma karena mampir ke halaman depan. */
  useEffect(() => {
    const akar = document.documentElement;
    const sebelumnya = akar.getAttribute('data-tema');
    if (sebelumnya) akar.removeAttribute('data-tema');
    return () => { if (sebelumnya) akar.setAttribute('data-tema', sebelumnya); };
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col overflow-y-auto bg-background text-foreground">
      <Header />
      <main className="grow">
        <ParallaxComponent />
        <HeroSection />
        {/* ── Sambungan hero → featuresgrid ─────────────────────────────
            Terukur sebelum diperbaiki: latar halaman rgb(9,9,11) bertemu
            latar featuresgrid rgb(0,0,0) pada satu garis, tanpa jarak sama
            sekali — dan bingkai layar hero MENJULUR 29px melewati batas
            seksinya, jadi bagian bawah gambar yang sedang melarut justru
            terpotong hitam pekat. Yang terlihat: pita gelap mendadak tepat
            di tempat mata sedang mengikuti gambar memudar.

            Jembatan ini menyelesaikan ketiganya sekaligus. Ia dimulai
            PERSIS pada warna halaman, jadi 29px julur bingkai itu jatuh di
            atas warna yang sama — tidak ada lagi potongan. Lalu ia meluruh
            ke hitam pekat sepanjang 10rem, sehingga perpindahan warnanya
            terjadi di ruang, bukan di garis.

            `-mt-8` menariknya naik supaya peluruhan gambar dan peluruhan
            warna saling menimpa, bukan berbaris satu demi satu.

            Ditaruh DI SINI, bukan di dalam featuresgrid.tsx: berkas itu
            salinan mentah yang sengaja tidak disentuh, supaya pembaruan
            berikutnya dari sumbernya tinggal ditimpa. */}
        <div
          aria-hidden="true"
          className="pointer-events-none -mt-8 h-40 w-full"
          style={{ background: 'linear-gradient(to bottom, var(--color-background) 0%, var(--color-background) 18%, #000 100%)' }}
        />

        {/* featuresgrid — ditempel apa adanya dari sumbernya, di bawah hero.
            Diimpor dengan alias karena namanya `Component`; berkasnya sendiri
            tidak disentuh sama sekali. */}
        <FeaturesGrid />
      </main>

      {/* Footer. Ditempel dari komponen sumbernya, isinya diganti data
          sungguhan — catatan lengkap soal apa yang tidak ikut ditempel ada
          di kepala footer-section.tsx.

          DI LUAR <main>, dan itu bukan selera: <main> menandai isi utama
          halaman untuk pembaca layar dan lompat-ke-isi. Identitas hukum dan
          disclaimer adalah pelengkap dokumen, bukan isi utamanya. */}
      <Footerdemo />
    </div>
  );
}
