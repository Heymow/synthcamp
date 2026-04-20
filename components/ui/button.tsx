'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'ghost' | 'glass' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
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
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'rounded-2xl font-black uppercase tracking-widest transition-all',
        'focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-2',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
