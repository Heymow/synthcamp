import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const GlassPanel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('glass-panel', className)} {...props} />
  ),
);
GlassPanel.displayName = 'GlassPanel';
