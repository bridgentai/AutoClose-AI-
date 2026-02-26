import { useLocation } from 'wouter';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface NotesOverviewCardData {
  group: string;
  ctaRoute: string;
}

interface NotesOverviewCardProps {
  data: NotesOverviewCardData;
  className?: string;
}

export function NotesOverviewCard({ data, className }: NotesOverviewCardProps) {
  const [, setLocation] = useLocation();
  const { group, ctaRoute } = data;

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
        <div className="flex items-center gap-2 text-[#a78bfa]">
          <BookOpen className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-sm font-medium uppercase tracking-wide">Notas del grupo</span>
        </div>
        <p className="text-lg font-semibold text-white font-['Poppins'] pt-1">Grupo {group}</p>
      </CardHeader>
      <CardContent className="pb-4">
        <p className="text-white/70 text-sm">
          Abre la tabla de calificaciones para ver y gestionar las notas de tus estudiantes.
        </p>
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
          Ver tabla de notas
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
        </Button>
      </CardFooter>
    </Card>
  );
}
