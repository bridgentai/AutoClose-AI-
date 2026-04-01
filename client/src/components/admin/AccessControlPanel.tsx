import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useInstitutionColors } from '@/hooks/useInstitutionColors';
import { useAuth } from '@/lib/authContext';
import { Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const CARD_STYLE = 'bg-white/5 border-white/10 backdrop-blur-md';

interface AccessControlFeature {
  id: string;
  blocked_roles: string[];
  reason: string | null;
  expires_at: string | null;
}

const FEATURE_LABELS: Record<string, { label: string; desc: string; defaultRoles: string[] }> = {
  ver_notas: {
    label: 'Ver calificaciones',
    desc: 'Bloquea que estudiantes y padres vean sus notas',
    defaultRoles: ['estudiante', 'padre'],
  },
  ver_asistencia: {
    label: 'Ver asistencia',
    desc: 'Bloquea que estudiantes y padres vean su registro de asistencia',
    defaultRoles: ['estudiante', 'padre'],
  },
  descargar_boletin: {
    label: 'Descargar boletín',
    desc: 'Bloquea la descarga de boletines de calificaciones',
    defaultRoles: ['estudiante', 'padre'],
  },
  chat_estudiantes: {
    label: 'Chat estudiantil',
    desc: 'Bloquea el acceso al chat para estudiantes',
    defaultRoles: ['estudiante'],
  },
  subir_archivos: {
    label: 'Subir archivos',
    desc: 'Bloquea la subida de archivos para estudiantes',
    defaultRoles: ['estudiante'],
  },
};

export function AccessControlPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { colorPrimario, colorSecundario } = useInstitutionColors();

  const [accessControlFeature, setAccessControlFeature] = useState('');
  const [accessControlReason, setAccessControlReason] = useState('');
  const [accessControlExpires, setAccessControlExpires] = useState('');

  const { data: accessControlsData, refetch: refetchAccessControls } = useQuery<{
    features: Record<string, AccessControlFeature | null>;
  }>({
    queryKey: ['accessControls', user?.colegioId],
    queryFn: () => apiRequest('GET', '/api/access-controls'),
    enabled: !!user?.colegioId,
  });

  const toggleAccessMutation = useMutation({
    mutationFn: (payload: {
      feature: string;
      enabled: boolean;
      blocked_roles?: string[];
      reason?: string;
      expires_at?: string | null;
    }) => apiRequest('POST', '/api/access-controls/toggle', payload),
    onSuccess: () => {
      refetchAccessControls();
      queryClient.invalidateQueries({ queryKey: ['accessControls'] });
    },
  });

  const features = accessControlsData?.features ?? {};

  return (
    <div className="space-y-6">
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: colorPrimario }} />
            Control de Accesos
          </CardTitle>
          <CardDescription className="text-white/60">
            Activa o desactiva funcionalidades para roles específicos. Útil para períodos de exámenes, eventos especiales o mantenimiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(FEATURE_LABELS).map(([feature, meta]) => {
            const control = features[feature];
            const isBlocked = !!control;
            return (
              <div key={feature} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{meta.label}</p>
                    <p className="text-white/50 text-sm">{meta.desc}</p>
                    {isBlocked && control && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {control.blocked_roles.map((r) => (
                          <Badge key={r} className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">{r}</Badge>
                        ))}
                        {control.reason && (
                          <span className="text-xs text-amber-400">"{control.reason}"</span>
                        )}
                        {control.expires_at && (
                          <span className="text-xs text-white/40">
                            Expira: {new Date(control.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={isBlocked ? 'default' : 'outline'}
                    className={
                      isBlocked
                        ? 'bg-red-500/80 hover:bg-red-500 text-white'
                        : 'border-white/20 text-white/70 hover:bg-white/10'
                    }
                    disabled={toggleAccessMutation.isPending}
                    onClick={() => {
                      if (isBlocked) {
                        toggleAccessMutation.mutate({ feature, enabled: true });
                      } else {
                        setAccessControlFeature(feature);
                        setAccessControlReason('');
                        setAccessControlExpires('');
                      }
                    }}
                  >
                    {isBlocked ? 'Bloqueado — Habilitar' : 'Habilitado — Bloquear'}
                  </Button>
                </div>
                {accessControlFeature === feature && !isBlocked && (
                  <div className="border-t border-white/10 pt-3 space-y-3">
                    <div>
                      <Label className="text-white/70 text-sm">Razón (opcional)</Label>
                      <Input
                        value={accessControlReason}
                        onChange={(e) => setAccessControlReason(e.target.value)}
                        placeholder="Ej: Período de exámenes"
                        className="bg-white/5 border-white/10 text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-white/70 text-sm">Fecha de expiración (opcional)</Label>
                      <Input
                        type="date"
                        value={accessControlExpires}
                        onChange={(e) => setAccessControlExpires(e.target.value)}
                        className="bg-white/5 border-white/10 text-white mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
                        onClick={() => {
                          toggleAccessMutation.mutate({
                            feature,
                            enabled: false,
                            blocked_roles: meta.defaultRoles,
                            reason: accessControlReason || undefined,
                            expires_at: accessControlExpires || null,
                          });
                          setAccessControlFeature('');
                        }}
                      >
                        Confirmar bloqueo
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white/60"
                        onClick={() => setAccessControlFeature('')}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
