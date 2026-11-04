/**
 * Page layout for card-grid pages: fills the space under the header. Put the
 * controls first (they stay fixed) and a CardGrid last (it scrolls).
 */
export function ScrollPage({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex min-h-0 flex-1 flex-col gap-3 ${className}`}>{children}</div>;
}
