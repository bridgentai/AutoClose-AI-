import { Link } from 'wouter';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items, className = '' }: { items: BreadcrumbItem[]; className?: string }) {
  const lastIdx = items.length - 1;
  const prev = items.length >= 2 ? items[items.length - 2] : null;
  const isSingleItem = items.length === 1;

  return (
    <nav aria-label="Breadcrumb" className={`text-[13px] ${className}`.trim()}>
      {/* Mobile: solo nivel anterior (←) */}
      <div className="sm:hidden">
        {prev?.href ? (
          <Link
            href={prev.href}
            className="inline-flex items-center gap-2 text-white/50 hover:text-white/70 transition-colors"
          >
            <span aria-hidden="true" className="text-white/70">
              ←
            </span>
            <span className="truncate max-w-[75vw]">{prev.label}</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2 text-white/90">
            <span aria-hidden="true" className="text-white/70">
              ←
            </span>
            <span className="truncate max-w-[75vw]">{prev?.label ?? items[0]?.label ?? ''}</span>
          </span>
        )}
      </div>

      {/* Desktop: jerarquía completa */}
      <ol className="hidden sm:flex flex-wrap items-center gap-0">
        {items.map((it, idx) => {
          const isLast = idx === lastIdx;
          const content = it.href ? (
            <Link
              href={it.href}
              className={
                isLast
                  ? isSingleItem
                    ? 'text-white/90 font-medium hover:text-white transition-colors'
                    : 'text-[#3B82F6] font-medium hover:text-[#60A5FA] transition-colors'
                  : 'text-white/50 hover:text-white/70 transition-colors'
              }
            >
              {it.label}
            </Link>
          ) : (
            <span className={isLast ? (isSingleItem ? 'text-white/90 font-medium' : 'text-[#3B82F6] font-medium') : 'text-white/50'}>{it.label}</span>
          );

          return (
            <li key={`${it.label}-${idx}`} className="flex items-center">
              {content}
              {!isLast && <span className="mx-2 text-white/40">{'>'}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

