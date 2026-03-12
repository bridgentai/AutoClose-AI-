import React from "react";
import { Switch, Route, useLocation, useLocation as useWouterLocation } from "wouter";

// Componente helper para redireccionar
function Redirect({ to }: { to: string }) {
  const [, setLocation] = useWouterLocation();
  React.useEffect(() => {
    setLocation(to);
  }, [setLocation, to]);
  return null;
}
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/lib/authContext";
import { AuthGuard, GuestGuard } from "@/components/auth-guard";
import { useInstitutionColors } from "@/hooks/useInstitutionColors";

import { AppLayout } from "@/components/app-layout";

import Home from "@/pages/home";
import LoginStandby from "@/pages/login-standby";
import RegisterStandby from "@/pages/register-standby";
import Login from "@/pages/login";
import AuthCallback from "@/pages/auth-callback";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Chat from "@/pages/chat";
import Courses from "@/pages/courses";
import CourseDetail from "@/pages/course-detail";
import CourseStudentsPage from "@/pages/course-students";
import CourseMaterialsPage from "@/pages/course-materials";
import CourseGradesTable from "@/pages/course-grades-table";
import CourseAnalytics from "@/pages/course-analytics";
import CalendarPage from "@/pages/calendar";
import Materials from "@/pages/materials";
import Account from "@/pages/account";
import Setup from "@/pages/setup";
import NotFound from "@/pages/not-found";
import PermisosPage from "@/pages/permisos";
import NotificacionesPage from "@/pages/notificaciones";
import DeprecatedModulePage from "@/pages/deprecated-module";
import TerminosPage from "@/pages/terminos";
import PrivacidadPage from "@/pages/privacidad";
import ConsentPage from "@/pages/consent";

import TeacherCalendarPage from "@/pages/teacher-calendar";
import TeacherTasksSummaryPage from "@/pages/teacher-tasks-summary";
import AssignmentDetailPage from "@/pages/assignment-detail";
import DirectivoPage from "@/pages/directivo";
import DirectivoCursosPage from "@/pages/directivo-cursos";
import DirectivoCursoDetailPage from "@/pages/directivo-curso-detail";
import DirectivoEstudiantesPage from "@/pages/directivo-estudiantes";
import DirectivoCursoEstudiantesPage from "@/pages/directivo-curso-estudiantes";
import DirectivoEstudianteNotasPage from "@/pages/directivo-estudiante-notas";
import PlataformasPage from "@/pages/plataformas";

import MiAprendizajeLayout from "@/pages/mi-aprendizaje";
import MiAprendizajeHorarioPage from "@/pages/mi-aprendizaje-horario";

import PerfilLayout from "@/pages/PerfilLayout";
import InformacionPersonal from "@/pages/InformacionPersonal";
import FichaMedica from "@/pages/FichaMedica";

import ComunicacionHome from "@/pages/ComunicacionHome";
import ComunicacionAcademico from "@/pages/ComunicacionAcademico";
import BandejaDeEntrada from "@/pages/BandejaDeEntrada";
import EvoSendPage from "@/pages/evo-send";
import EvoDrivePage from "@/pages/evo-drive";

import ComunidadLayout from "@/pages/ComunidadLayout";
import CalendarioEventos from "@/pages/CalendarioEventos";
import AvisosNoticias from "@/pages/AvisosNoticias";

import GroupAssignmentPage from "@/pages/GroupAssignmentPage";
import AsignacionHorariosPage from "@/pages/asignacion-horarios/index";
import HorariosCursoPage from "@/pages/asignacion-horarios/horarios-curso";
import HorariosProfesorPage from "@/pages/asignacion-horarios/horarios-profesor";

import StudentNotesPage from "@/pages/student-notes";
import StudentNotesHistoryPage from "@/pages/student-notes-history";
import StudentTasksPage from "@/pages/student-tasks";
import ParentMateriasPage from "@/pages/parent-materias";
import ParentNotesHistorialPage from "@/pages/parent-notes-historial";
import TeacherNotesPage from "@/pages/teacher-notes";
import TeacherGroupTasksPage from "@/pages/teacher-group-tasks";
import StudentProfilePage from "@/pages/student-profile";
import BoletinInteligentePage from "@/pages/boletin-inteligente";
import StudentCourseAnalyticsPage from "@/pages/student-course-analytics";
import ParentCourseAnalyticsPage from "@/pages/parent-course-analytics";

// Módulos del profesor
import ProfesorAcademiaLayout from "@/pages/profesor-academia";
import ProfesorComunicacionLayout from "@/pages/profesor-comunicacion";
import ProfesorBandejaEntrada from "@/pages/profesor-bandeja-entrada";
import ProfesorRedactarMensaje from "@/pages/profesor-redactar-mensaje";
import ProfesorMensajesEnviados from "@/pages/profesor-mensajes-enviados";
import ProfesorTareasPage from "@/pages/profesor-tareas";
import ProfesorCalificacionLogrosPage from "@/pages/profesor-calificacion-logros";
import ProfesorAsignarTareaPage from "@/pages/profesor-asignar-tarea";
import ProfesorRevisionTareasPage from "@/pages/profesor-revision-tareas";
import ProfesorPanelCalificacionPage from "@/pages/profesor-panel-calificacion";
import ProfesorTareasPorRevisarPage from "@/pages/profesor-tareas-por-revisar";
import ProfesorEditorDocumentoPage from "@/pages/profesor-editor-documento";
import AsistenciaProfesor from "@/pages/asistencia-profesor";
import HorarioGruposPage from "@/pages/horario-grupos";
import HorarioEscolarPage from "@/pages/horario-escolar";
import RegistroAsistenciaPage from "@/pages/registro-asistencia";
import AsistenciaSelectorPage from "@/pages/asistencia-selector";

// Nuevos roles
import AdministradorGeneralPage from "@/pages/administrador-general";
import TransportePage from "@/pages/transporte";
import NutricionPage from "@/pages/nutricion";
import CafeteriaPage from "@/pages/cafeteria";

// Módulos de Directivo
import DirectivoComunidadLayout from "@/pages/directivo-comunidad";
import DirectivoAcademiaLayout from "@/pages/directivo-academia";
import DirectivoReportesPage from "@/pages/directivo-reportes";
import DirectivoComunicacionLayout from "@/pages/directivo-comunicacion";

// Módulos de Administrador General
import AdministradorGeneralComunidadLayout from "@/pages/administrador-general-comunidad";
import AdministradorGeneralAcademiaLayout from "@/pages/administrador-general-academia";
import AdministradorGeneralComunicacionLayout from "@/pages/administrador-general-comunicacion";

// Módulos de Transporte
import TransporteComunidadLayout from "@/pages/transporte-comunidad";
import TransporteAcademiaLayout from "@/pages/transporte-academia";
import TransporteComunicacionLayout from "@/pages/transporte-comunicacion";

// Módulos de Tesorería

// Módulos de Nutrición
import NutricionComunidadLayout from "@/pages/nutricion-comunidad";
import NutricionAcademiaLayout from "@/pages/nutricion-academia";
import NutricionComunicacionLayout from "@/pages/nutricion-comunicacion";

// Módulos de Cafetería
import CafeteriaComunidadLayout from "@/pages/cafeteria-comunidad";
import CafeteriaAcademiaLayout from "@/pages/cafeteria-academia";
import CafeteriaComunicacionLayout from "@/pages/cafeteria-comunicacion";

// Asistente
import AsistentePage from "@/pages/asistente";
import AsistenteComunicacionLayout from "@/pages/asistente-comunicacion";

// Super Admin
import SuperAdminPage from "@/pages/super-admin";

const queryClient = new QueryClient();

function AppRouter() {
  const { user } = useAuth();
  const isLogged = Boolean(user);
  const [location] = useLocation();
  
  // Cargar y aplicar colores de la institución (el hook maneja internamente si el usuario está autenticado)
  useInstitutionColors();

  // Landing en "/" - sin AppLayout, sin AI Dock, primera página al abrir la plataforma
  if (location === "/" || location === "") {
    return <Home />;
  }

  return (
    <>
      {isLogged ? (
        <AppLayout>
          <Switch>

            <Route path="/dashboard">
              <AuthGuard><Dashboard /></AuthGuard>
            </Route>
            <Route path="/chat/:chatId?">
              <AuthGuard><Chat /></AuthGuard>
            </Route>

            {/* Redirigir rutas antiguas al dashboard oficial */}
            <Route path="/student">
              <AuthGuard>
                <Redirect to="/dashboard" />
              </AuthGuard>
            </Route>
            <Route path="/teacher">
              <AuthGuard>
                <Redirect to="/dashboard" />
              </AuthGuard>
            </Route>
            <Route path="/director">
              <AuthGuard>
                <Redirect to="/dashboard" />
              </AuthGuard>
            </Route>
            <Route path="/parent">
              <AuthGuard>
                <Redirect to="/dashboard" />
              </AuthGuard>
            </Route>
            <Route path="/parent/materias">
              <AuthGuard><ParentMateriasPage /></AuthGuard>
            </Route>
            <Route path="/parent/notas/historial">
              <AuthGuard><ParentNotesHistorialPage /></AuthGuard>
            </Route>
            <Route path="/parent/analytics/:studentId/:cursoId">
              <AuthGuard><ParentCourseAnalyticsPage /></AuthGuard>
            </Route>
            <Route path="/directivo">
              <AuthGuard><DirectivoPage /></AuthGuard>
            </Route>
            <Route path="/administrador-general">
              <AuthGuard><AdministradorGeneralPage /></AuthGuard>
            </Route>
            <Route path="/transporte">
              <AuthGuard><TransportePage /></AuthGuard>
            </Route>
            <Route path="/tesoreria">
              <AuthGuard><DeprecatedModulePage /></AuthGuard>
            </Route>
            <Route path="/nutricion">
              <AuthGuard><NutricionPage /></AuthGuard>
            </Route>
            <Route path="/cafeteria">
              <AuthGuard><CafeteriaPage /></AuthGuard>
            </Route>
            <Route path="/asistente">
              <AuthGuard><AsistentePage /></AuthGuard>
            </Route>
            <Route path="/asistente/comunicacion">
              <AuthGuard><AsistenteComunicacionLayout /></AuthGuard>
            </Route>
            <Route path="/asistente/comunicacion/bandeja">
              <AuthGuard><BandejaDeEntrada /></AuthGuard>
            </Route>
            <Route path="/asistente/comunicacion/redactar">
              <AuthGuard><ProfesorRedactarMensaje /></AuthGuard>
            </Route>
            <Route path="/super-admin">
              <AuthGuard><SuperAdminPage /></AuthGuard>
            </Route>

            <Route path="/subjects">
              <AuthGuard><Courses /></AuthGuard>
            </Route>
            <Route path="/courses">
              <AuthGuard><Courses /></AuthGuard>
            </Route>
            <Route path="/course/:grupoId/asistencia/registro">
              <AuthGuard><RegistroAsistenciaPage /></AuthGuard>
            </Route>
            <Route path="/course/:grupoId/asistencia">
              <AuthGuard><AsistenciaSelectorPage /></AuthGuard>
            </Route>
            <Route path="/course/:grupoId/horario">
              <AuthGuard><HorarioEscolarPage /></AuthGuard>
            </Route>
            <Route path="/course/:cursoId">
              <AuthGuard><CourseDetail /></AuthGuard>
            </Route>
            <Route path="/course-detail/:cursoId/estudiantes">
              <AuthGuard><CourseStudentsPage /></AuthGuard>
            </Route>
            <Route path="/course-detail/:cursoId/materiales">
              <AuthGuard><CourseMaterialsPage /></AuthGuard>
            </Route>
            <Route path="/course-detail/:cursoId">
              <AuthGuard><CourseDetail /></AuthGuard>
            </Route>
            <Route path="/course/:cursoId/analytics">
              <AuthGuard><CourseAnalytics /></AuthGuard>
            </Route>
            <Route path="/course/:cursoId/grades">
              <AuthGuard><CourseGradesTable /></AuthGuard>
            </Route>

            <Route path="/mi-aprendizaje/cursos">
              <AuthGuard><Courses /></AuthGuard>
            </Route>
            <Route path="/mi-aprendizaje/materiales">
              <AuthGuard><Materials /></AuthGuard>
            </Route>
            <Route path="/mi-aprendizaje/horario">
              <AuthGuard><MiAprendizajeHorarioPage /></AuthGuard>
            </Route>
            <Route path="/mi-aprendizaje/calendario">
              <AuthGuard><CalendarPage /></AuthGuard>
            </Route>
            <Route path="/student/course/:cursoId/analytics">
              <AuthGuard><StudentCourseAnalyticsPage /></AuthGuard>
            </Route>
            <Route path="/mi-aprendizaje/notas/historial">
              <AuthGuard><StudentNotesHistoryPage /></AuthGuard>
            </Route>
            <Route path="/mi-aprendizaje/notas">
              <AuthGuard><StudentNotesPage /></AuthGuard>
            </Route>
            <Route path="/mi-aprendizaje/tareas">
              <AuthGuard><StudentTasksPage /></AuthGuard>
            </Route>

            <Route path="/mi-aprendizaje">
              <AuthGuard><MiAprendizajeLayout /></AuthGuard>
            </Route>

            <Route path="/mi-perfil">
              <AuthGuard><PerfilLayout /></AuthGuard>
            </Route>
            <Route path="/mi-perfil/personal">
              <AuthGuard><InformacionPersonal /></AuthGuard>
            </Route>
            <Route path="/mi-perfil/medica">
              <AuthGuard><FichaMedica /></AuthGuard>
            </Route>
            <Route path="/mi-perfil/cuenta">
              <AuthGuard><Account /></AuthGuard>
            </Route>

            <Route path="/comunicacion">
              <AuthGuard><ComunicacionHome /></AuthGuard>
            </Route>
            <Route path="/comunicacion/bandeja">
              <AuthGuard><BandejaDeEntrada /></AuthGuard>
            </Route>
            <Route path="/comunicacion/academico">
              <AuthGuard><ComunicacionAcademico /></AuthGuard>
            </Route>
            <Route path="/comunicacion/academico/:materiaId">
              <AuthGuard><ComunicacionAcademico /></AuthGuard>
            </Route>
            <Route path="/comunicacion/redactar">
              <AuthGuard><ProfesorRedactarMensaje /></AuthGuard>
            </Route>
            <Route path="/evo-send">
              <AuthGuard><EvoSendPage /></AuthGuard>
            </Route>
            <Route path="/evo-drive">
              <AuthGuard><EvoDrivePage /></AuthGuard>
            </Route>

            <Route path="/comunidad">
              <AuthGuard><ComunidadLayout /></AuthGuard>
            </Route>
            <Route path="/comunidad/calendario">
              <AuthGuard><CalendarioEventos /></AuthGuard>
            </Route>
            <Route path="/comunidad/noticias">
              <AuthGuard><AvisosNoticias /></AuthGuard>
            </Route>

            <Route path="/calendar">
              <AuthGuard><CalendarPage /></AuthGuard>
            </Route>
            <Route path="/teacher-calendar">
              <AuthGuard><TeacherCalendarPage /></AuthGuard>
            </Route>
            <Route path="/profesor/tareas/resumen">
              <AuthGuard><TeacherTasksSummaryPage /></AuthGuard>
            </Route>
            <Route path="/profesor/cursos/:cursoId/notas">
              <AuthGuard><TeacherNotesPage /></AuthGuard>
            </Route>
            <Route path="/profesor/cursos/:cursoId/estudiantes/:estudianteId/notas">
              <AuthGuard><TeacherNotesPage /></AuthGuard>
            </Route>
            <Route path="/profesor/cursos/:cursoId/tareas">
              <AuthGuard><TeacherGroupTasksPage /></AuthGuard>
            </Route>
            <Route path="/profesor/cursos/:cursoId/estudiantes/:estudianteId">
              <AuthGuard><StudentProfilePage /></AuthGuard>
            </Route>
            <Route path="/profesor/cursos/:cursoId/estudiantes/:estudianteId/boletin-inteligente">
              <AuthGuard><DeprecatedModulePage /></AuthGuard>
            </Route>

            <Route path="/group-assignment">
              <AuthGuard><GroupAssignmentPage /></AuthGuard>
            </Route>
            <Route path="/asignacion-horarios/curso">
              <AuthGuard><HorariosCursoPage /></AuthGuard>
            </Route>
            <Route path="/asignacion-horarios/profesor">
              <AuthGuard><HorariosProfesorPage /></AuthGuard>
            </Route>
            <Route path="/asignacion-horarios">
              <AuthGuard><AsignacionHorariosPage /></AuthGuard>
            </Route>

            <Route path="/materials">
              <AuthGuard><Materials /></AuthGuard>
            </Route>

            <Route path="/assignment/:id">
              <AuthGuard><AssignmentDetailPage /></AuthGuard>
            </Route>

            <Route path="/setup">
              <AuthGuard><Setup /></AuthGuard>
            </Route>

            <Route path="/settings">
              <AuthGuard><Setup /></AuthGuard>
            </Route>

            <Route path="/account">
              <AuthGuard><Account /></AuthGuard>
            </Route>

            <Route path="/plataformas">
              <AuthGuard><PlataformasPage /></AuthGuard>
            </Route>

            <Route path="/permisos">
              <AuthGuard><PermisosPage /></AuthGuard>
            </Route>
            <Route path="/notificaciones">
              <AuthGuard><NotificacionesPage /></AuthGuard>
            </Route>
            <Route path="/boletin">
              <AuthGuard><DeprecatedModulePage /></AuthGuard>
            </Route>

            <Route path="/terminos">
              <TerminosPage />
            </Route>
            <Route path="/privacidad">
              <PrivacidadPage />
            </Route>
            <Route path="/consent">
              <AuthGuard><ConsentPage /></AuthGuard>
            </Route>

            {/* Módulos del Profesor */}
            <Route path="/profesor/academia">
              <AuthGuard><ProfesorAcademiaLayout /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/cursos">
              <AuthGuard><Courses /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/materiales">
              <AuthGuard><Materials /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/grupos">
              <AuthGuard><GroupAssignmentPage /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/tareas/asignar">
              <AuthGuard><Redirect to="/profesor/academia/cursos" /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/tareas/revision">
              <AuthGuard><Redirect to="/profesor/academia/cursos" /></AuthGuard>
            </Route>
            <Route path="/profesor/tareas-por-revisar">
              <AuthGuard><ProfesorTareasPorRevisarPage /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/tareas/calificacion/:cursoId">
              <AuthGuard><ProfesorPanelCalificacionPage /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/tareas/editor/:id">
              <AuthGuard><ProfesorEditorDocumentoPage /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/tareas">
              <AuthGuard><Redirect to="/profesor/academia/cursos" /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/calificacion/logros">
              <AuthGuard><ProfesorCalificacionLogrosPage /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/calificacion">
              <AuthGuard><ProfesorCalificacionLogrosPage /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/notas">
              <AuthGuard><Courses /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/plataformas">
              <AuthGuard><PlataformasPage /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/asistencia">
              <AuthGuard><AsistenciaProfesor /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/horario">
              <AuthGuard><HorarioGruposPage /></AuthGuard>
            </Route>

            <Route path="/profesor/comunicacion">
              <AuthGuard><ProfesorComunicacionLayout /></AuthGuard>
            </Route>
            <Route path="/profesor/comunicacion/bandeja">
              <AuthGuard><ProfesorBandejaEntrada /></AuthGuard>
            </Route>
            <Route path="/profesor/comunicacion/redactar">
              <AuthGuard><ProfesorRedactarMensaje /></AuthGuard>
            </Route>
            <Route path="/profesor/comunicacion/enviados">
              <AuthGuard><ProfesorMensajesEnviados /></AuthGuard>
            </Route>

            {/* Módulos de Directivo */}
            <Route path="/directivo/comunidad">
              <AuthGuard><DirectivoComunidadLayout /></AuthGuard>
            </Route>
            <Route path="/directivo/academia/reportes">
              <AuthGuard><DirectivoReportesPage /></AuthGuard>
            </Route>
            <Route path="/directivo/academia">
              <AuthGuard><DirectivoAcademiaLayout /></AuthGuard>
            </Route>
            <Route path="/directivo/estudiantes">
              <AuthGuard><DirectivoEstudiantesPage /></AuthGuard>
            </Route>
            <Route path="/directivo/cursos">
              <AuthGuard><DirectivoCursosPage /></AuthGuard>
            </Route>
            <Route path="/directivo/cursos/:grupoId/estudiantes">
              <AuthGuard><DirectivoCursoEstudiantesPage /></AuthGuard>
            </Route>
            <Route path="/directivo/cursos/:grupoId/estudiantes/:estudianteId/notas">
              <AuthGuard><DirectivoEstudianteNotasPage /></AuthGuard>
            </Route>
            <Route path="/directivo/cursos/:grupoId">
              <AuthGuard><DirectivoCursoDetailPage /></AuthGuard>
            </Route>
            <Route path="/directivo/comunicacion">
              <AuthGuard><DirectivoComunicacionLayout /></AuthGuard>
            </Route>

            {/* Módulos de Administrador General */}
            <Route path="/administrador-general/comunidad">
              <AuthGuard><AdministradorGeneralComunidadLayout /></AuthGuard>
            </Route>
            <Route path="/administrador-general/academia">
              <AuthGuard><AdministradorGeneralAcademiaLayout /></AuthGuard>
            </Route>
            <Route path="/administrador-general/comunicacion">
              <AuthGuard><AdministradorGeneralComunicacionLayout /></AuthGuard>
            </Route>

            {/* Módulos de Transporte */}
            <Route path="/transporte/comunidad">
              <AuthGuard><TransporteComunidadLayout /></AuthGuard>
            </Route>
            <Route path="/transporte/academia">
              <AuthGuard><TransporteAcademiaLayout /></AuthGuard>
            </Route>
            <Route path="/transporte/comunicacion">
              <AuthGuard><TransporteComunicacionLayout /></AuthGuard>
            </Route>

            {/* Módulos de Tesorería (removidos) */}
            <Route path="/tesoreria/comunidad">
              <AuthGuard><DeprecatedModulePage /></AuthGuard>
            </Route>
            <Route path="/tesoreria/academia">
              <AuthGuard><DeprecatedModulePage /></AuthGuard>
            </Route>
            <Route path="/tesoreria/comunicacion">
              <AuthGuard><DeprecatedModulePage /></AuthGuard>
            </Route>

            {/* Módulos de Nutrición */}
            <Route path="/nutricion/comunidad">
              <AuthGuard><NutricionComunidadLayout /></AuthGuard>
            </Route>
            <Route path="/nutricion/academia">
              <AuthGuard><NutricionAcademiaLayout /></AuthGuard>
            </Route>
            <Route path="/nutricion/comunicacion">
              <AuthGuard><NutricionComunicacionLayout /></AuthGuard>
            </Route>

            {/* Módulos de Cafetería */}
            <Route path="/cafeteria/comunidad">
              <AuthGuard><CafeteriaComunidadLayout /></AuthGuard>
            </Route>
            <Route path="/cafeteria/academia">
              <AuthGuard><CafeteriaAcademiaLayout /></AuthGuard>
            </Route>
            <Route path="/cafeteria/comunicacion">
              <AuthGuard><CafeteriaComunicacionLayout /></AuthGuard>
            </Route>

            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      ) : (
        <Switch>
          {/* Rutas de login y registro activas */}
          <Route path="/login">
            <GuestGuard><Login /></GuestGuard>
          </Route>

          <Route path="/auth/callback">
            <AuthCallback />
          </Route>

          <Route path="/register">
            <GuestGuard><Register /></GuestGuard>
          </Route>

          {/* Cualquier otra ruta sin login -> redirigir al landing */}
          <Route path="/:rest*">
            <Redirect to="/" />
          </Route>
          
          {/* Rutas de standby comentadas */}
          {/* <Route path="/login">
            <LoginStandby />
          </Route>

          <Route path="/register">
            <RegisterStandby />
          </Route> */}
        </Switch>
      )}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
