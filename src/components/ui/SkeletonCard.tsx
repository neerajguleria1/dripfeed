export default function SkeletonCard() {
  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-[#051F45]/10 overflow-hidden">
      <div className="aspect-square skeleton" />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-3 w-16 skeleton rounded" />
        <div className="h-4 w-full skeleton rounded" />
        <div className="h-4 w-3/4 skeleton rounded" />
        <div className="h-5 w-20 skeleton rounded-full" />
        <div className="h-6 w-24 skeleton rounded" />
        <div className="h-10 w-full skeleton rounded-lg mt-2" />
      </div>
    </div>
  );
}
