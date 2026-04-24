import type { CreditCategory } from '@/lib/database.types';

const CATEGORY_META: Record<
  CreditCategory,
  { label: string; emoji: string; description: string; accent: string }
> = {
  acoustic: {
    label: 'Acoustic',
    emoji: '🌱',
    description: 'Crafted without generative AI.',
    accent: 'text-white/90 border-white/15 bg-white/[0.04]',
  },
  hybrid: {
    label: 'Hybrid',
    emoji: '✨',
    description: 'Human craft woven with AI assistance.',
    accent: 'text-indigo-100 border-indigo-200/20 bg-indigo-400/[0.07]',
  },
  ai_crafted: {
    label: 'AI-Crafted',
    emoji: '🎨',
    description: 'Built with generative AI tools, curated by the artist.',
    accent: 'text-indigo-200 border-indigo-300/40 bg-indigo-500/15',
  },
};

interface CreativeCreditsProps {
  category: CreditCategory;
  tags: string[];
  narrative: string | null;
}

/**
 * Public-facing "Creative Credits" block: celebrates what the artist did
 * (category + tags + optional narrative) rather than listing what AI did.
 * This is the positive-framing version the project memory calls out.
 */
export function CreativeCredits({ category, tags, narrative }: CreativeCreditsProps) {
  const meta = CATEGORY_META[category];
  const hasTags = tags.length > 0;

  return (
    <div className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/60">
          Creative Credits
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${meta.accent}`}
        >
          <span aria-hidden="true">{meta.emoji}</span>
          <span>{meta.label}</span>
        </span>
      </div>

      <p className="text-[11px] italic text-white/50">{meta.description}</p>

      {hasTags && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white/80"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {narrative && (
        <p className="border-t border-white/5 pt-3 text-[12px] italic leading-relaxed text-white/80">
          « {narrative} »
        </p>
      )}
    </div>
  );
}
