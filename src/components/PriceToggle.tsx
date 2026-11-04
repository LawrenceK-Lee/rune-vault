/** "Show prices" switch plus the data source/date, shown above card grids. */
export function PriceToggle({
  show,
  onChange,
  updatedAt,
  children,
}: {
  show: boolean;
  onChange: (v: boolean) => void;
  updatedAt: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
      <label className="flex cursor-pointer items-center gap-2 text-slate-300">
        <input type="checkbox" className="h-4 w-4 accent-gold-400" checked={show} onChange={(e) => onChange(e.target.checked)} />
        Show prices
      </label>
      {show && updatedAt && (
        <span className="text-xs">TCGplayer market price in USD · updated {new Date(updatedAt).toLocaleDateString()}</span>
      )}
      {children}
    </div>
  );
}
