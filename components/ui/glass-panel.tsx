import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type GlassPanelTag = 'div' | 'section' | 'article' | 'aside' | 'main';

export interface GlassPanelProps extends HTMLAttributes<HTMLElement> {
  /** Semantic tag to render. Defaults to `div`. */
  as?: GlassPanelTag;
}

export const GlassPanel = forwardRef<HTMLElement, GlassPanelProps>(
  ({ as: Tag = 'div', className, ...props }, ref) => {
    return (
      <Tag
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn('glass-panel', className)}
        {...props}
      />
    );
  },
);
GlassPanel.displayName = 'GlassPanel';
