import { AccessControlPanel } from '@/components/admin/AccessControlPanel';

export default function AsistenteAcademicaAccesosPage() {
  return (
    <div data-testid="asistente-academica-accesos-page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 font-['Poppins']">Control de Accesos</h1>
        <p className="text-white/60">
          Gestiona las funcionalidades habilitadas para cada rol dentro de la institución.
        </p>
      </div>
      <AccessControlPanel />
    </div>
  );
}
