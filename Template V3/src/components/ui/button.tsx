import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/* Tombol ala shadcn — dipakai halaman Pendaratan.
   ────────────────────────────────────────────────────────────────────────
   Sisa aplikasi memakai tombol dari efferd-ui; yang ini TIDAK
   menggantikannya. Ia ada karena blok hero yang dipakai halaman depan
   ditulis di atas API shadcn (`asChild`, varian, ukuran), dan menuliskan
   ulang blok itu ke API lain berarti tiap pembaruan dari sumbernya harus
   diterjemahkan tangan. Dua tombol yang hidup di dua dunia lebih murah
   daripada satu tombol yang harus melayani keduanya. */

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-zinc-100 text-zinc-950 hover:bg-white',
        destructive: 'bg-red-500 text-[#fff] hover:bg-red-500/90',
        outline: 'border border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-zinc-100',
        secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
        ghost: 'hover:bg-zinc-900 hover:text-zinc-100',
        link: 'text-zinc-100 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
