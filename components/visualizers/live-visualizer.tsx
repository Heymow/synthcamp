// The `wave` keyframe is defined in `app/globals.css`. We use inline
// `style` for the animation instead of Tailwind's bracketed arbitrary
// values because the v4 parser sometimes drops multi-token delays.
const BASE_STYLE = {
  animationName: 'wave',
  animationDuration: '1s',
  animationTimingFunction: 'ease-in-out',
  animationIterationCount: 'infinite',
} as const;

export function LiveVisualizer() {
  return (
    <div className="flex h-4 items-center gap-[2px]" aria-hidden="true">
      <div
        className="w-[2px] rounded-[1px] bg-white"
        style={{ ...BASE_STYLE, animationDelay: '0.1s' }}
      />
      <div
        className="w-[2px] rounded-[1px] bg-white"
        style={{ ...BASE_STYLE, animationDelay: '0.3s' }}
      />
      <div
        className="w-[2px] rounded-[1px] bg-white"
        style={{ ...BASE_STYLE, animationDelay: '0.2s' }}
      />
      <div
        className="w-[2px] rounded-[1px] bg-white"
        style={{ ...BASE_STYLE, animationDelay: '0.4s' }}
      />
    </div>
  );
}
