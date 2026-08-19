import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRightIcon, NotebookPenIcon } from 'lucide-react';

/* ════════════════════════════════════════════════════════════════════════
   HERO halaman Pendaratan — struktur mengikuti hero-3 (efferd)
   ════════════════════════════════════════════════════════════════════════
   Yang dipertahankan 100% dari sumbernya: urutan animasi masuk bertingkat
   (chip → judul → kalimat → tombol → layar), radial shade di kepala,
   bingkai layar dengan glow dan mask yang melarut ke bawah.

   Dua penyimpangan sadar dari salinan mentah, dua-duanya karena salinan
   mentahnya akan RUSAK di sini:

   · `--theme(--color-foreground/.1)` dan `mask-b-from-60%` butuh Tailwind
     4.1; proyek ini mematok ^4.0.0 dan lockfile-nya bisa saja menahan di
     4.0.x. Diganti nilai yang setara persis secara visual (white/10 pada
     situs yang memang gelap-selamanya, mask lewat style inline) supaya
     tampilannya tidak bergantung pada versi minor pustaka.

   · Layar contohnya BUKAN tangkapan layar dashboard orang lain dari CDN
     efferd. Halaman jualan yang memajang produk orang lain sebagai
     produknya sendiri bukan sekadar salah gambar. Area layarnya menerima
     `children` — peraga terminal kami sendiri masuk ke bingkai yang sama.
   ════════════════════════════════════════════════════════════════════════ */

export function HeroSection({ children }: { children?: React.ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-5xl overflow-hidden pt-16">
      {/* Shades */}
      <div aria-hidden="true" className="absolute inset-0 size-full overflow-hidden">
        <div
          className={cn(
            'absolute inset-0 isolate -z-10',
            'bg-[radial-gradient(20%_80%_at_20%_0%,rgba(255,255,255,0.1),transparent)]',
          )}
        />
      </div>
      <div className="relative z-10 flex max-w-2xl flex-col gap-5 px-4">
        <a
          className={cn(
            'group flex w-fit items-center gap-3 rounded-sm border bg-card p-1 shadow-xs',
            'fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards transition-all delay-500 duration-500 ease-out',
          )}
          href="/akses"
        >
          <div className="rounded-xs border bg-card px-1.5 py-0.5 shadow-sm">
            <p className="font-mono text-xs">BARU</p>
          </div>

          <span className="text-xs">pendaftaran akses perintis dibuka</span>
          <span className="block h-5 border-l" />

          <div className="pr-1">
            <ArrowRightIcon className="size-3 -translate-x-0.5 duration-150 ease-out group-hover:translate-x-0.5" />
          </div>
        </a>

        <h1
          className={cn(
            'text-balance font-medium text-4xl text-foreground leading-tight md:text-5xl',
            'fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-100 duration-500 ease-out',
          )}
        >
          Analisa, kirim order, dan catat alasannya di satu layar
        </h1>

        <p
          className={cn(
            'text-muted-foreground text-sm tracking-wider sm:text-lg md:text-xl',
            'fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-200 duration-500 ease-out',
          )}
        >
          Chart, screener, jurnal, dan eksekusi ke Binance Futures serta MetaTrader 5 —{' '}
          <br className="hidden sm:block" />
          tanpa pindah aplikasi untuk mengubah stop loss.
        </p>

        <div className="fade-in slide-in-from-bottom-10 flex w-fit animate-in items-center justify-center gap-3 fill-mode-backwards pt-2 delay-300 duration-500 ease-out">
          <Button variant="outline" asChild>
            <a href="/jurnal">
              <NotebookPenIcon className="size-4 mr-2" data-icon="inline-start" /> Mulai dari jurnal — gratis
            </a>
          </Button>
          <Button asChild>
            <a href="https://lynk.id/jaditrader_payment">
              Lihat paket <ArrowRightIcon className="size-4 ml-2" data-icon="inline-end" />
            </a>
          </Button>
        </div>
      </div>
      <div className="relative">
        <div
          className={cn(
            'absolute -inset-x-20 inset-y-0 -translate-y-1/3 scale-120 rounded-full',
            'bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1),transparent,transparent)]',
            'blur-[50px]',
          )}
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
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
