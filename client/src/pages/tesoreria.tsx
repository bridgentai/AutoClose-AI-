import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { DollarSign, TrendingUp, FileText, Users, Plus, CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

const CARD_STYLE = 'bg-white/5 border-white/10 backdrop-blur-md';

interface Stats {
  pagosPendientes: number;
  facturasEmitidasMes: number;
  ingresosMes: number;
  padresConDeuda: number;
  totalPendienteCobro: number;
}

interface FacturaItem {
  _id: string;
  facturaId: string;
  concepto: string;
  monto: number;
  fecha: string;
  estado: string;
  usuarioId?: { nombre: string; correo: string };
  estudianteId?: { nombre: string };
}

interface PagoItem {
  _id: string;
  monto: number;
  fecha: string;
  metodo: string;
  estado: string;
  usuarioId?: { nombre: string };
  facturaId?: unknown;
}

export default function TesoreriaPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [modalFactura, setModalFactura] = useState(false);
  const [modalPago, setModalPago] = useState(false);
  const [formFactura, setFormFactura] = useState({ usuarioId: '', estudianteId: '', concepto: 'Pensión', monto: '', fechaVencimiento: '' });
  const [formPago, setFormPago] = useState({ usuarioId: '', facturaId: '', monto: '', metodo: 'efectivo' });

  const canManage = ['admin-general-colegio', 'directivo', 'tesoreria', 'super_admin'].includes(user?.rol || '');

  const { data: stats } = useQuery({
    queryKey: ['/api/treasury/stats'],
    queryFn: () => apiRequest<Stats>('GET', '/api/treasury/stats'),
    enabled: canManage,
  });

  const { data: facturas = [] } = useQuery({
    queryKey: ['/api/treasury/facturas'],
    queryFn: () => apiRequest<FacturaItem[]>('GET', '/api/treasury/facturas'),
  });

  const { data: pagos = [] } = useQuery({
    queryKey: ['/api/treasury/pagos'],
    queryFn: () => apiRequest<PagoItem[]>('GET', '/api/treasury/pagos'),
  });

  const { data: padres = [] } = useQuery({
    queryKey: ['/api/users/by-role', 'padre'],
    queryFn: () => apiRequest<{ _id: string; nombre: string; email?: string }[]>('GET', '/api/users/by-role?rol=padre'),
    enabled: canManage,
  });

  const createFacturaMutation = useMutation({
    mutationFn: (payload: { usuarioId: string; estudianteId?: string; concepto: string; monto: number; fechaVencimiento?: string }) =>
      apiRequest('POST', '/api/treasury/facturas', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/treasury/facturas'] });
      queryClient.invalidateQueries({ queryKey: ['/api/treasury/stats'] });
      setModalFactura(false);
      setFormFactura({ usuarioId: '', estudianteId: '', concepto: 'Pensión', monto: '', fechaVencimiento: '' });
    },
  });

  const createPagoMutation = useMutation({
    mutationFn: (payload: { usuarioId: string; facturaId?: string; monto: number; metodo: string }) =>
      apiRequest('POST', '/api/treasury/pagos', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/treasury/pagos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/treasury/facturas'] });
      queryClient.invalidateQueries({ queryKey: ['/api/treasury/stats'] });
      setModalPago(false);
      setFormPago({ usuarioId: '', facturaId: '', monto: '', metodo: 'efectivo' });
    },
  });

  return (
    <div data-testid="tesoreria-page" className="p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 font-['Poppins']">
          Bienvenido, {user?.nombre?.split(' ')[0] || 'Tesorero'}
        </h2>
        <p className="text-white/60 text-sm sm:text-base">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {canManage && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className={`${CARD_STYLE} hover:bg-white/[0.07] transition-colors`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <DollarSign className="w-5 h-5 text-[#00c8ff]" />
                Pagos Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.pagosPendientes}</div>
              <p className="text-sm text-white/50 mt-1">Por procesar</p>
            </CardContent>
          </Card>
          <Card className={`${CARD_STYLE} hover:bg-white/[0.07] transition-colors`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <TrendingUp className="w-5 h-5 text-[#00c8ff]" />
                Ingresos del Mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">${stats.ingresosMes?.toLocaleString('es-CO') ?? 0}</div>
              <p className="text-sm text-white/50 mt-1">Recaudado</p>
            </CardContent>
          </Card>
          <Card className={`${CARD_STYLE} hover:bg-white/[0.07] transition-colors`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <FileText className="w-5 h-5 text-[#00c8ff]" />
                Facturas Emitidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.facturasEmitidasMes ?? 0}</div>
              <p className="text-sm text-white/50 mt-1">Este mes</p>
            </CardContent>
          </Card>
          <Card className={`${CARD_STYLE} hover:bg-white/[0.07] transition-colors`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="w-5 h-5 text-[#00c8ff]" />
                Padres con Deuda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stats.padresConDeuda ?? 0}</div>
              <p className="text-sm text-white/50 mt-1">Pendientes</p>
            </CardContent>
          </Card>
        </div>
      )}

      {canManage && (
        <div className="flex gap-3 mb-6">
          <Button onClick={() => setModalFactura(true)} className="bg-gradient-to-r from-[#002366] to-[#1e3cff]">
            <Plus className="w-4 h-4 mr-2" />
            Nueva factura
          </Button>
          <Button onClick={() => setModalPago(true)} variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <CreditCard className="w-4 h-4 mr-2" />
            Registrar pago
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white">Facturas</CardTitle>
            <CardDescription className="text-white/60">Listado de facturas</CardDescription>
          </CardHeader>
          <CardContent>
            {facturas.length === 0 ? (
              <p className="text-white/50 py-6 text-center">No hay facturas</p>
            ) : (
              <ul className="space-y-2 max-h-[300px] overflow-y-auto">
                {facturas.slice(0, 20).map((f) => (
                  <li key={f._id} className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/10">
                    <div>
                      <p className="text-white font-medium">{f.concepto}</p>
                      <p className="text-white/50 text-sm">
                        {(f.usuarioId as { nombre?: string })?.nombre ?? f.facturaId} · {new Date(f.fecha).toLocaleDateString('es-CO')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-['Poppins']">${f.monto?.toLocaleString('es-CO')}</p>
                      <span className={`text-xs ${f.estado === 'pagada' ? 'text-emerald-400' : 'text-amber-400'}`}>{f.estado}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white">Pagos</CardTitle>
            <CardDescription className="text-white/60">Últimos pagos</CardDescription>
          </CardHeader>
          <CardContent>
            {pagos.length === 0 ? (
              <p className="text-white/50 py-6 text-center">No hay pagos recientes</p>
            ) : (
              <ul className="space-y-2 max-h-[300px] overflow-y-auto">
                {pagos.slice(0, 20).map((p) => (
                  <li key={p._id} className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/10">
                    <div>
                      <p className="text-white">{(p.usuarioId as { nombre?: string })?.nombre ?? '—'}</p>
                      <p className="text-white/50 text-sm">{new Date(p.fecha).toLocaleDateString('es-CO')} · {p.metodo}</p>
                    </div>
                    <p className="text-white font-['Poppins']">${p.monto?.toLocaleString('es-CO')}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {modalFactura && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className={`${CARD_STYLE} w-full max-w-md`}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Nueva factura</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setModalFactura(false)} className="text-white/70">Cerrar</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-white/80">Padre / responsable (ID)</Label>
                <select
                  value={formFactura.usuarioId}
                  onChange={(e) => setFormFactura((f) => ({ ...f, usuarioId: e.target.value }))}
                  className="w-full rounded-lg bg-white/10 border border-white/10 text-white px-3 py-2 mt-1"
                >
                  <option value="">Seleccionar</option>
                  {padres.map((p) => (
                    <option key={p._id} value={p._id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-white/80">Concepto</Label>
                <Input
                  value={formFactura.concepto}
                  onChange={(e) => setFormFactura((f) => ({ ...f, concepto: e.target.value }))}
                  className="bg-white/10 border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-white/80">Monto</Label>
                <Input
                  type="number"
                  value={formFactura.monto}
                  onChange={(e) => setFormFactura((f) => ({ ...f, monto: e.target.value }))}
                  className="bg-white/10 border-white/10 text-white mt-1"
                />
              </div>
              <Button
                className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff]"
                onClick={() => createFacturaMutation.mutate({
                  usuarioId: formFactura.usuarioId,
                  concepto: formFactura.concepto,
                  monto: Number(formFactura.monto),
                  ...(formFactura.fechaVencimiento ? { fechaVencimiento: formFactura.fechaVencimiento } : {}),
                })}
                disabled={!formFactura.usuarioId || !formFactura.monto || createFacturaMutation.isPending}
              >
                {createFacturaMutation.isPending ? 'Creando...' : 'Crear factura'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {modalPago && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className={`${CARD_STYLE} w-full max-w-md`}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Registrar pago</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setModalPago(false)} className="text-white/70">Cerrar</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-white/80">Padre (ID)</Label>
                <select
                  value={formPago.usuarioId}
                  onChange={(e) => setFormPago((f) => ({ ...f, usuarioId: e.target.value }))}
                  className="w-full rounded-lg bg-white/10 border border-white/10 text-white px-3 py-2 mt-1"
                >
                  <option value="">Seleccionar</option>
                  {padres.map((p) => (
                    <option key={p._id} value={p._id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-white/80">Factura (opcional)</Label>
                <select
                  value={formPago.facturaId}
                  onChange={(e) => setFormPago((f) => ({ ...f, facturaId: e.target.value }))}
                  className="w-full rounded-lg bg-white/10 border border-white/10 text-white px-3 py-2 mt-1"
                >
                  <option value="">Sin factura</option>
                  {facturas.filter((f) => f.estado === 'pendiente').map((f) => (
                    <option key={f._id} value={f._id}>{f.concepto} - ${f.monto} ({(f.usuarioId as { nombre?: string })?.nombre})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-white/80">Monto</Label>
                <Input
                  type="number"
                  value={formPago.monto}
                  onChange={(e) => setFormPago((f) => ({ ...f, monto: e.target.value }))}
                  className="bg-white/10 border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-white/80">Método</Label>
                <select
                  value={formPago.metodo}
                  onChange={(e) => setFormPago((f) => ({ ...f, metodo: e.target.value }))}
                  className="w-full rounded-lg bg-white/10 border border-white/10 text-white px-3 py-2 mt-1"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff]"
                onClick={() => createPagoMutation.mutate({
                  usuarioId: formPago.usuarioId,
                  monto: Number(formPago.monto),
                  metodo: formPago.metodo,
                  ...(formPago.facturaId ? { facturaId: formPago.facturaId } : {}),
                })}
                disabled={!formPago.usuarioId || !formPago.monto || createPagoMutation.isPending}
              >
                {createPagoMutation.isPending ? 'Registrando...' : 'Registrar pago'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
