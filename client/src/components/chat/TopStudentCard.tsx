import { useLocation } from 'wouter';
import { Trophy, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TopStudentCardData {
  studentName: string;
  average: number;
  group: string;
  ranking: number;
  ctaRoute: string;
}

interface TopStudentCardProps {
  data: TopStudentCardData;
  className?: string;
}

export function TopStudentCard({ data, className }: TopStudentCardProps) {
  const [, setLocation] = useLocation();
  const { studentName, average, group, ranking, ctaRoute } = data;

  return (
    <Card
      className={cn(
        'chat-structured-card max-w-md w-full',
        'bg-[#0F0F14] border-[#6366f1]/50',
        'hover:border-[#6366f1]/80 hover:shadow-[0_8px_32px_rgba(99,102,241,0.2)]',
        'transition-all duration-300 ease-out',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        className
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#a78bfa]">
            <Trophy className="h-5 w-5 shrink-0" aria-hidden />
            <span className="text-sm font-medium uppercase tracking-wide">Mejor promedio</span>
          </div>
          <span
            className={cn(
              'inline-flex items-center justify-center rounded-md px-2.5 py-0.5 text-xs font-semibold',
              'bg-[#6366f1]/20 text-[#a78bfa] border border-[#6366f1]/40'
            )}
          >
            #{ranking} del grupo
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        <p className="text-xl font-semibold text-white font-['Poppins']">{studentName}</p>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-bold text-[#a78bfa] tabular-nums">{average.toFixed(1)}</span>
          <span className="text-sm text-white/60">promedio</span>
        </div>
        <p className="text-sm text-white/70">Grupo {group}</p>
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          variant="outline"
          className={cn(
            'w-full border-[#6366f1]/50 text-[#a78bfa] hover:bg-[#6366f1]/15 hover:border-[#6366f1]/70',
            'hover-elevate transition-smooth'
          )}
          onClick={() => setLocation(ctaRoute)}
        >
          Ver tabla completa
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
        </Button>
      </CardFooter>
    </Card>
  );
}
