import React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

/* Cahaya latar di belakang hero.
   ────────────────────────────────────────────────────────────────────────
   Sumber aslinya menulis warna sebagai `hsla(var(--brand)/.3)`, pola
   Tailwind v3 di mana token warna disimpan sebagai TIGA ANGKA HSL telanjang
   supaya opasitasnya bisa disisipkan. Proyek ini Tailwind v4: tokennya
   warna utuh (`--color-brand: #c9a24b`), jadi pola itu menghasilkan
   `hsla(#c9a24b/.3)` — bukan warna, dan gradiennya diam-diam tidak
   tergambar sama sekali.

   Diganti `color-mix`, yang bekerja pada warna utuh apa pun dan tidak
   memaksa token disimpan dalam bentuk yang cuma masuk akal bagi satu versi
   Tailwind. */

const glowVariants = cva('absolute w-full', {
  variants: {
    variant: {
      top: 'top-0',
      above: '-top-[128px]',
      bottom: 'bottom-0',
      below: '-bottom-[128px]',
      center: 'top-[50%]',
    },
  },
  defaultVariants: { variant: 'top' },
});

const Glow = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof glowVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(glowVariants({ variant }), className)} {...props}>
    <div
      className={cn(
        'absolute left-1/2 h-[256px] w-[60%] -translate-x-1/2 scale-[2.5] rounded-[50%] sm:h-[512px]',
        'bg-[radial-gradient(ellipse_at_center,_color-mix(in_oklab,#ffcd75_45%,transparent)_10%,_transparent_60%)]',
        variant === 'center' && '-translate-y-1/2',
      )}
    />
    <div
      className={cn(
        'absolute left-1/2 h-[128px] w-[40%] -translate-x-1/2 scale-[2] rounded-[50%] sm:h-[256px]',
        'bg-[radial-gradient(ellipse_at_center,_color-mix(in_oklab,#c9a24b_28%,transparent)_10%,_transparent_60%)]',
        variant === 'center' && '-translate-y-1/2',
      )}
    />
  </div>
));
Glow.displayName = 'Glow';

export { Glow };
