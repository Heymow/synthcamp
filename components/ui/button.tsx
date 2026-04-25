'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'ghost' | 'glass' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Render the button as the immediate child element (via Radix Slot).
   * Use this to compose with `<Link>` and avoid nested `<a><button>` markup.
   */
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-white text-black hover:bg-gray-200 active:scale-95',
  ghost: 'bg-white/5 text-white border border-white/10 hover:bg-white/10',
  glass: 'bg-white/10 backdrop-blur-md text-white border border-white/10 hover:bg-white/20',
  accent: 'bg-indigo-500 text-black hover:bg-indigo-400 active:scale-95',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-[10px] min-h-[44px]',
  md: 'px-6 py-3 text-xs min-h-[44px]',
  lg: 'px-8 py-4 text-xs min-h-[48px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', asChild = false, className, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-2xl font-black tracking-widest uppercase transition-all',
          'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
