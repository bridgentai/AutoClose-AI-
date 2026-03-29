import React, { useState } from 'react';
import { Calendar, Plus, Trash2, Edit2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/authContext';
import { NavBackButton } from '@/components/nav-back-button';

const CARD_STYLE = 'bg-white/5 border-white/10 backdrop-blur-md';

interface EventoItem {
  _id: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  tipo: 'curso' | 'colegio';
  cursoId?: { nombre: string };
}

export default function CalendarioEventos() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [desde] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [hasta] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0).toISOString().slice(0, 10));
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ titulo: '', descripcion: '', fecha: new Date().toISOString().slice(0, 16), tipo: 'colegio' as 'curso' | 'colegio', cursoId: '' });

  const { data: eventos = [] } = useQuery({
    queryKey: ['/api/events', desde, hasta],
    queryFn: () => apiRequest<EventoItem[]>('GET', `/api/events?desde=${desde}&hasta=${hasta}`),
  });

  const createMutation = useMutation({
    mutationFn: (body: { titulo: string; descripcion: string; fecha: string; tipo: string; cursoId?: string }) =>
      apiRequest('POST', '/api/events', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setModalOpen(false);
      setForm({ titulo: '', descripcion: '', fecha: new Date().toISOString().slice(0, 16), tipo: 'colegio', cursoId: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/events/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/events'] }),
  });

  const canCreate = ['directivo', 'admin-general-colegio', 'profesor'].includes(user?.rol || '');

  return (
    <div className="p-4 sm:p-6">
      <NavBackButton to="/comunicacion" label="Comunicación" />
      <div className="mb-6">
        <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2 font-['Poppins'] flex items-center gap-2">
          <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-[#00c8ff] shrink-0" />
          Calendario de Eventos
        </h1>
        <p className="text-white/60 text-sm sm:text-base">Eventos institucionales y fechas importantes</p>
      </div>

      <div className="flex justify-end mb-6">
        {canCreate && (
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo evento
          </Button>
        )}
      </div>

      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white font-['Poppins']">Próximos eventos</CardTitle>
          <CardDescription className="text-white/60">Listado de eventos del colegio</CardDescription>
        </CardHeader>
        <CardContent>
          {eventos.length === 0 ? (
            <p className="text-white/60 py-8 text-center">No hay eventos en este rango de fechas.</p>
          ) : (
            <ul className="space-y-3">
              {eventos.map((ev) => (
                <li
                  key={ev._id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium">{ev.titulo}</p>
                    <p className="text-white/60 text-sm mt-1 line-clamp-2 sm:line-clamp-none">{ev.descripcion || '—'}</p>
                    <p className="text-white/50 text-xs mt-1">
                      {new Date(ev.fecha).toLocaleString('es-CO')}
                      {ev.tipo === 'curso' && ev.cursoId && ` · ${(ev.cursoId as { nombre?: string }).nombre || ''}`}
                    </p>
                  </div>
                  {canCreate && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:bg-red-500/20 min-h-[44px] min-w-[44px] sm:min-w-0 self-end sm:self-center shrink-0"
                      onClick={() => deleteMutation.mutate(ev._id)}
                      aria-label="Eliminar evento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className={`${CARD_STYLE} w-full max-w-md`}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Nuevo evento</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)} className="text-white/70">Cerrar</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-white/80">Título</Label>
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  className="bg-white/10 border-white/10 text-white mt-1"
                  placeholder="Ej. Reunión de padres"
                />
              </div>
              <div>
                <Label className="text-white/80">Descripción</Label>
                <Textarea
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  className="bg-white/10 border-white/10 text-white mt-1"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <Label className="text-white/80">Fecha y hora</Label>
                <input
                  type="datetime-local"
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                  className="w-full rounded-lg bg-white/10 border border-white/10 text-white px-3 py-2 mt-1"
                />
              </div>
              <div>
                <Label className="text-white/80">Tipo</Label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as 'curso' | 'colegio' }))}
                  className="w-full rounded-lg bg-white/10 border border-white/10 text-white px-3 py-2 mt-1"
                >
                  <option value="colegio">Colegio (todos)</option>
                  <option value="curso">Por curso</option>
                </select>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff]"
                onClick={() => createMutation.mutate({
                  titulo: form.titulo,
                  descripcion: form.descripcion,
                  fecha: new Date(form.fecha).toISOString(),
                  tipo: form.tipo,
                  ...(form.tipo === 'curso' && form.cursoId ? { cursoId: form.cursoId } : {}),
                })}
                disabled={!form.titulo.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creando...' : 'Crear evento'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
