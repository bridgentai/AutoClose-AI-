import { useLocation } from 'wouter';
import { ListTodo, ArrowRight, Calendar, Circle } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TasksOverviewCardData {
  group: string;
  tasks: { title: string; dueDate: string; status: string }[];
  ctaRoute: string;
}

interface TasksOverviewCardProps {
  data: TasksOverviewCardData;
  className?: string;
}

function formatDate(s: string) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function TasksOverviewCard({ data, className }: TasksOverviewCardProps) {
  const [, setLocation] = useLocation();
  const { group, tasks, ctaRoute } = data;
  const displayed = tasks.slice(0, 5);

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
          <ListTodo className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-sm font-medium uppercase tracking-wide">Tareas del grupo</span>
        </div>
        <p className="text-lg font-semibold text-white font-['Poppins'] pt-1">Grupo {group}</p>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        {displayed.length === 0 ? (
          <p className="text-white/60 text-sm">No hay tareas asignadas.</p>
        ) : (
          <ul className="space-y-2">
            {displayed.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Circle
                  className={cn(
                    'h-2 w-2 mt-1.5 shrink-0 rounded-full',
                    t.status === 'Entregado' ? 'text-emerald-400/80' : 'text-amber-400/80'
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <span className="text-white/90 truncate block">{t.title}</span>
                  <span className="text-white/50 text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(t.dueDate)} · {t.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {tasks.length > 5 && (
          <p className="text-white/50 text-xs pt-1">+{tasks.length - 5} más</p>
        )}
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
          Ver todas las tareas
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
        </Button>
      </CardFooter>
    </Card>
  );
}
