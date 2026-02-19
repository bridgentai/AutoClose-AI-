import React from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';
import { useLocation } from 'wouter';

const CARD_STYLE = 'bg-white/5 border-white/10 backdrop-blur-md';

interface NotifItem {
  _id: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  leido: boolean;
}

export default function NotificacionesPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['/api/notifications'],
    queryFn: () => apiRequest<{ list: NotifItem[]; unreadCount: number }>('GET', '/api/notifications'),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => apiRequest('PATCH', `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/notifications/mark-all-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const list = data?.list ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <NavBackButton to="/dashboard" label="Dashboard" />
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 font-['Poppins'] mt-4 flex items-center gap-2">
          <Bell className="w-8 h-8 text-[#1e3cff] shrink-0" />
          Notificaciones
        </h1>
        <p className="text-white/60 text-sm sm:text-base">Mensajes y avisos del colegio</p>
      </div>

      <Card className={CARD_STYLE}>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-white">Bandeja</CardTitle>
            <CardDescription className="text-white/60">{unreadCount} sin leer</CardDescription>
          </div>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 min-h-[44px]"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
            >
              <CheckCheck className="w-4 h-4 mr-1 shrink-0" />
              Marcar todas leídas
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-white/60">Cargando...</p>
          ) : list.length === 0 ? (
            <p className="text-white/50 py-8 text-center">No hay notificaciones</p>
          ) : (
            <ul className="space-y-2">
              {list.map((n) => (
                <li
                  key={n._id}
                  className={`flex items-start justify-between gap-3 sm:gap-4 p-4 rounded-xl border transition-colors ${
                    n.leido ? 'bg-white/5 border-white/10' : 'bg-[#1e3cff]/10 border-[#1e3cff]/30'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium truncate sm:truncate-none">{n.titulo}</p>
                    <p className="text-white/70 text-sm mt-1 line-clamp-2 sm:line-clamp-none">{n.descripcion}</p>
                    <p className="text-white/50 text-xs mt-2">{new Date(n.fecha).toLocaleString('es-CO')}</p>
                  </div>
                  {!n.leido && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white/80 hover:bg-white/10 min-h-[44px] min-w-[44px] shrink-0"
                      onClick={() => markOneMutation.mutate(n._id)}
                      aria-label="Marcar como leída"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
