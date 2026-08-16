import React from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LineChart, NotebookPen, Radar, Copy, Plug, LayoutDashboard,
  FileText, Shield, HelpCircle, ScrollText, Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

/* ════════════════════════════════════════════════════════════════════════
   HEADER halaman Pendaratan — struktur mengikuti header-3 (sshahaider)
   ════════════════════════════════════════════════════════════════════════
   Tata letak, animasi, dan perilakunya dipertahankan 100%: sticky yang
   membeku-kaca saat digulir, dua menu jatuh, tombol hamburger yang melebur
   jadi ×, menu HP lewat portal. Yang diganti HANYA isinya — tautan menuju
   halaman kami sendiri, wordmark memakai logo kami.

   Tautan pakai <a href="#/..."> polos, bukan <Link>: router situs ini
   HashRouter, jadi href hash adalah bentuk aslinya — dan komponen
   NavigationMenuLink milik Radix memang mengoper props ke <a>.
   ════════════════════════════════════════════════════════════════════════ */

type LinkItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

const produkLinks: LinkItem[] = [
  { title: 'Dashboard',     href: '#/dashboard',   icon: LayoutDashboard, description: 'Ringkasan akun & posisi terbuka' },
  { title: 'Chart & Entry', href: '#/chart',       icon: LineChart,       description: 'Chart yang bisa mengeksekusi order' },
  { title: 'Screener Area', href: '#/screener',    icon: Radar,           description: 'Pindai SMI + SNR seluruh watchlist' },
  { title: 'Journal',       href: '#/jurnal',      icon: NotebookPen,     description: 'Jurnal yang terisi sendiri dari broker' },
  { title: 'Copy Signal',   href: '#/copy',        icon: Copy,            description: 'Sinyal komunitas dengan rekam jejak' },
  { title: 'Integrations',  href: '#/integrasi',   icon: Plug,            description: 'Binance Futures & MetaTrader 5' },
];

const perusahaanLinks: LinkItem[] = [
  { title: 'Marketplace',  href: '#/marketplace',  icon: Store,      description: 'EA, indikator, dan lisensi' },
  { title: 'Dokumentasi',  href: '#/dokumentasi',  icon: FileText,   description: 'Panduan pemasangan & pemakaian' },
  { title: 'Changelog',    href: '#/changelog',    icon: ScrollText, description: 'Apa yang baru di tiap rilis' },
];

const perusahaanLinks2: LinkItem[] = [
  { title: 'Disclaimer & Privasi', href: '#/legal',       icon: Shield },
  { title: 'Help Center',          href: '#/dokumentasi', icon: HelpCircle },
];

export function Header() {
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
          <a href="#/pendaratan" className="hover:bg-accent flex items-center gap-2 rounded-md p-2">
            <img src="brand/logo-ikon-256.png" alt="" className="size-5 rounded" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Jadi Trader <span className="text-muted-foreground font-normal">Tools</span>
            </span>
          </a>
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent">Produk</NavigationMenuTrigger>
                <NavigationMenuContent className="bg-background p-1 pr-1.5">
                  <ul className="bg-popover grid w-lg grid-cols-2 gap-2 rounded-md border p-2 shadow">
                    {produkLinks.map((item, i) => (
                      <li key={i}><ListItem {...item} /></li>
                    ))}
                  </ul>
                  <div className="p-2">
                    <p className="text-muted-foreground text-sm">
                      Belum punya akses?{' '}
                      <a href="#/akses" className="text-foreground font-medium hover:underline">
                        Minta akses
                      </a>
                    </p>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent">Perusahaan</NavigationMenuTrigger>
                <NavigationMenuContent className="bg-background p-1 pr-1.5 pb-1.5">
                  <div className="grid w-lg grid-cols-2 gap-2">
                    <ul className="bg-popover space-y-2 rounded-md border p-2 shadow">
                      {perusahaanLinks.map((item, i) => (
                        <li key={i}><ListItem {...item} /></li>
                      ))}
                    </ul>
                    <ul className="space-y-2 p-3">
                      {perusahaanLinks2.map((item, i) => (
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
                <a href="https://lynk.id/jaditrader_payment" className="hover:bg-accent rounded-md p-2">
                  Harga
                </a>
              </NavigationMenuLink>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="outline" asChild>
            <a href="#/akses">Masuk</a>
          </Button>
          <Button asChild>
            <a href="#/jurnal">Mulai gratis</a>
          </Button>
        </div>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setOpen(!open)}
          className="md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label="Buka menu"
        >
          <MenuToggleIcon open={open} className="size-5" duration={300} />
        </Button>
      </nav>
      <MobileMenu open={open} className="flex flex-col justify-between gap-2 overflow-y-auto">
        <NavigationMenu className="max-w-full">
          <div className="flex w-full flex-col gap-y-2">
            <span className="text-sm">Produk</span>
            {produkLinks.map((link) => (
              <ListItem key={link.title} {...link} onClick={() => setOpen(false)} />
            ))}
            <span className="text-sm">Perusahaan</span>
            {perusahaanLinks.map((link) => (
              <ListItem key={link.title} {...link} onClick={() => setOpen(false)} />
            ))}
            {perusahaanLinks2.map((link) => (
              <ListItem key={link.title} {...link} onClick={() => setOpen(false)} />
            ))}
          </div>
        </NavigationMenu>
        <div className="flex flex-col gap-2">
          <Button variant="outline" className="w-full bg-transparent" asChild>
            <a href="#/akses" onClick={() => setOpen(false)}>Masuk</a>
          </Button>
          <Button className="w-full" asChild>
            <a href="#/jurnal" onClick={() => setOpen(false)}>Mulai gratis</a>
          </Button>
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
