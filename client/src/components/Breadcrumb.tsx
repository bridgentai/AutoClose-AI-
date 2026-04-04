import { Link } from 'wouter';
import { cn } from '@/lib/utils';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type BreadcrumbVariant = 'dark' | 'light';

export function Breadcrumb({
  items,
  className = '',
  variant = 'dark',
}: {
  items: BreadcrumbItem[];
  className?: string;
  variant?: BreadcrumbVariant;
}) {
  const lastIdx = items.length - 1;
  const prev = items.length >= 2 ? items[items.length - 2] : null;
  const isSingleItem = items.length === 1;
  const light = variant === 'light';

  return (
    <nav aria-label="Breadcrumb" className={cn('text-[13px]', className)}>
      <div className="sm:hidden">
        {prev?.href ? (
          <Link
            href={prev.href}
            className={cn(
              'inline-flex items-center gap-2 transition-colors',
              light
                ? 'text-zinc-500 hover:text-zinc-800'
                : 'text-white/50 hover:text-white/70',
            )}
          >
            <span
              aria-hidden="true"
              className={light ? 'text-zinc-400' : 'text-white/70'}
            >
              ←
            </span>
            <span className="truncate max-w-[75vw]">{prev.label}</span>
          </Link>
        ) : (
          <span
            className={cn(
              'inline-flex items-center gap-2',
              light ? 'text-zinc-800' : 'text-white/90',
            )}
          >
            <span
              aria-hidden="true"
              className={light ? 'text-zinc-400' : 'text-white/70'}
            >
              ←
            </span>
            <span className="truncate max-w-[75vw]">{prev?.label ?? items[0]?.label ?? ''}</span>
          </span>
        )}
      </div>

      <ol className="hidden sm:flex flex-wrap items-center gap-0">
        {items.map((it, idx) => {
          const isLast = idx === lastIdx;
          const content = it.href ? (
            <Link
              href={it.href}
              className={cn(
                'font-medium transition-colors',
                light
                  ? isLast
                    ? isSingleItem
                      ? 'text-zinc-800 hover:text-zinc-950'
                      : 'text-[#4F6BF6] hover:text-[#3d56c4]'
                    : 'text-zinc-500 hover:text-zinc-700'
                  : isLast
                    ? isSingleItem
                      ? 'text-white/90 hover:text-white'
                      : 'text-[#3B82F6] hover:text-[#60A5FA]'
                    : 'text-white/50 hover:text-white/70',
              )}
            >
              {it.label}
            </Link>
          ) : (
            <span
              className={cn(
                'font-medium',
                light
                  ? isLast
                    ? isSingleItem
                      ? 'text-zinc-800'
                      : 'text-[#4F6BF6]'
                    : 'text-zinc-500'
                  : isLast
                    ? isSingleItem
                      ? 'text-white/90'
                      : 'text-[#3B82F6]'
                    : 'text-white/50',
              )}
            >
              {it.label}
            </span>
          );

          return (
            <li key={`${it.label}-${idx}`} className="flex items-center">
              {content}
              {!isLast && (
                <span
                  className={cn(
                    'mx-2',
                    light ? 'text-zinc-300' : 'text-white/40',
                  )}
                >
                  {'>'}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
