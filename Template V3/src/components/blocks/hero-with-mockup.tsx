import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Mockup } from '@/components/ui/mockup';
import { Glow } from '@/components/ui/glow';

interface Cta {
  text: string;
  href: string;
  icon?: ReactNode;
}

interface HeroWithMockupProps {
  title: string;
  description: string;
  primaryCta?: Cta;
  secondaryCta?: Cta;
  /** Gambar diam di dalam bingkai mockup. */
  mockupImage?: { src: string; alt: string; width: number; height: number };
  /** Antarmuka SUNGGUHAN di dalam bingkai mockup — dipakai kalau tidak ada
   *  gambar. Tangkapan layar produk basi setiap kali produknya berubah, dan
   *  yang tampil di halaman depan lalu berbeda dari yang ditemukan orang
   *  begitu ia masuk. Yang dirender langsung tidak bisa basi. */
  children?: ReactNode;
  className?: string;
}

export function HeroWithMockup({
  title,
  description,
  primaryCta = { text: 'Mulai gratis', href: '#/jurnal' },
  secondaryCta = { text: 'Lihat harga', href: 'https://lynk.id/jaditrader_payment' },
  mockupImage,
  children,
  className,
}: HeroWithMockupProps) {
  return (
    <section
      className={cn(
        'relative bg-zinc-950 text-zinc-100',
        'py-12 px-4 md:py-24 lg:py-32',
        'overflow-hidden',
        className,
      )}
    >
      <div className="relative mx-auto max-w-[1280px] flex flex-col gap-12 lg:gap-24">
        <div className="relative z-10 flex flex-col items-center gap-6 pt-8 md:pt-16 text-center lg:gap-12">
          <h1
            className={cn(
              'inline-block animate-appear',
              'bg-gradient-to-b from-zinc-50 via-zinc-200 to-zinc-500',
              'bg-clip-text text-transparent',
              'font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl',
              'leading-[1.1] sm:leading-[1.1]',
              'max-w-[16ch]',
            )}
          >
            {title}
          </h1>

          <p
            className={cn(
              'max-w-[600px] animate-appear opacity-0 [animation-delay:150ms]',
              'text-base sm:text-lg md:text-xl',
              'text-zinc-400',
              'leading-relaxed',
            )}
          >
            {description}
          </p>

          <div className="relative z-10 flex flex-wrap justify-center gap-4 animate-appear opacity-0 [animation-delay:300ms]">
            <Button
              asChild
              size="lg"
              className={cn(
                'bg-gradient-to-b from-[#ffcd75] to-[#c9a24b]',
                'hover:from-[#ffcd75] hover:to-[#ffcd75]',
                'text-zinc-950 font-semibold shadow-lg',
                'transition-all duration-300',
              )}
            >
              <a href={primaryCta.href}>
                {primaryCta.icon}
                {primaryCta.text}
              </a>
            </Button>

            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-zinc-400 transition-all duration-300"
            >
              <a href={secondaryCta.href}>
                {secondaryCta.icon}
                {secondaryCta.text}
              </a>
            </Button>
          </div>

          <div className="relative w-full pt-12 px-0 sm:px-6 lg:px-8">
            <Mockup
              className={cn(
                'animate-appear opacity-0 [animation-delay:700ms]',
                'shadow-[0_0_50px_-12px_rgba(0,0,0,0.6)]',
                'w-full',
              )}
            >
              {mockupImage ? (
                <img {...mockupImage} className="w-full h-auto" loading="lazy" decoding="async" />
              ) : (
                children
              )}
            </Mockup>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Glow
          variant="above"
          className="animate-appear-zoom opacity-0 [animation-delay:1000ms]"
        />
      </div>
    </section>
  );
}
