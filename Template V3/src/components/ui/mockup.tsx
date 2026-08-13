import React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const mockupVariants = cva(
  'flex relative z-10 overflow-hidden shadow-2xl border border-white/5 border-t-white/15',
  {
    variants: {
      type: {
        mobile: 'rounded-[48px] max-w-[350px]',
        responsive: 'rounded-md',
      },
    },
    defaultVariants: { type: 'responsive' },
  },
);

export interface MockupProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof mockupVariants> {}

const Mockup = React.forwardRef<HTMLDivElement, MockupProps>(
  ({ className, type, ...props }, ref) => (
    <div ref={ref} className={cn(mockupVariants({ type, className }))} {...props} />
  ),
);
Mockup.displayName = 'Mockup';

const frameVariants = cva('bg-white/[0.03] flex relative z-10 overflow-hidden rounded-2xl', {
  variants: {
    size: {
      small: 'p-2',
      large: 'p-4',
    },
  },
  defaultVariants: { size: 'small' },
});

export interface MockupFrameProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof frameVariants> {}

const MockupFrame = React.forwardRef<HTMLDivElement, MockupFrameProps>(
  ({ className, size, ...props }, ref) => (
    <div ref={ref} className={cn(frameVariants({ size, className }))} {...props} />
  ),
);
MockupFrame.displayName = 'MockupFrame';

export { Mockup, MockupFrame };
