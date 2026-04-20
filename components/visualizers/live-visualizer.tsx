export function LiveVisualizer() {
  return (
    <div className="flex h-4 items-center gap-[2px]" aria-hidden="true">
      <div className="w-[2px] animate-[wave_1s_infinite_ease-in-out_0.1s] rounded-[1px] bg-white" />
      <div className="w-[2px] animate-[wave_1s_infinite_ease-in-out_0.3s] rounded-[1px] bg-white" />
      <div className="w-[2px] animate-[wave_1s_infinite_ease-in-out_0.2s] rounded-[1px] bg-white" />
      <div className="w-[2px] animate-[wave_1s_infinite_ease-in-out_0.4s] rounded-[1px] bg-white" />
    </div>
  );
}
