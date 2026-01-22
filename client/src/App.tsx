import React from "react";
import { Switch, Route, useLocation as useWouterLocation } from "wouter";

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

import { AppLayout } from "@/components/app-layout";

import Home from "@/pages/home";
import Entry from "@/pages/entry";
import LoginStandby from "@/pages/login-standby";
import RegisterStandby from "@/pages/register-standby";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Chat from "@/pages/chat";
import Courses from "@/pages/courses";
import CourseDetail from "@/pages/course-detail";
import CalendarPage from "@/pages/calendar";
import Materials from "@/pages/materials";
import Account from "@/pages/account";
import Setup from "@/pages/setup";
import NotFound from "@/pages/not-found";
import PermisosPage from "@/pages/permisos";

import TeacherCalendarPage from "@/pages/teacher-calendar";
import TeacherTasksSummaryPage from "@/pages/teacher-tasks-summary";
import AssignmentDetailPage from "@/pages/assignment-detail";
import DirectivoPage from "@/pages/directivo";
import PlataformasPage from "@/pages/plataformas";

import MiAprendizajeLayout from "@/pages/mi-aprendizaje";

import PerfilLayout from "@/pages/PerfilLayout";
import InformacionPersonal from "@/pages/InformacionPersonal";
import FichaMedica from "@/pages/FichaMedica";

import ComunicacionHome from "@/pages/ComunicacionHome";
import ComunicacionAcademico from "@/pages/ComunicacionAcademico";

import ComunidadLayout from "@/pages/ComunidadLayout";
import CalendarioEventos from "@/pages/CalendarioEventos";
import AvisosNoticias from "@/pages/AvisosNoticias";

import GroupAssignmentPage from "@/pages/GroupAssignmentPage";

import StudentNotesPage from "@/pages/student-notes";
import StudentNotesHistoryPage from "@/pages/student-notes-history";
import StudentTasksPage from "@/pages/student-tasks";
import TeacherNotesPage from "@/pages/teacher-notes";
import TeacherGroupTasksPage from "@/pages/teacher-group-tasks";
import StudentProfilePage from "@/pages/student-profile";

// Módulos del profesor
import ProfesorAcademiaLayout from "@/pages/profesor-academia";
import ProfesorComunicacionLayout from "@/pages/profesor-comunicacion";
import ProfesorBandejaEntrada from "@/pages/profesor-bandeja-entrada";
import ProfesorRedactarMensaje from "@/pages/profesor-redactar-mensaje";
import ProfesorMensajesEnviados from "@/pages/profesor-mensajes-enviados";
import ProfesorTareasPage from "@/pages/profesor-tareas";
import ProfesorAsignarTareaPage from "@/pages/profesor-asignar-tarea";
import ProfesorRevisionTareasPage from "@/pages/profesor-revision-tareas";
import ProfesorPanelCalificacionPage from "@/pages/profesor-panel-calificacion";
import ProfesorEditorDocumentoPage from "@/pages/profesor-editor-documento";

// Nuevos roles
import AdministradorGeneralPage from "@/pages/administrador-general";
import TransportePage from "@/pages/transporte";
import TesoreriaPage from "@/pages/tesoreria";
import NutricionPage from "@/pages/nutricion";
import CafeteriaPage from "@/pages/cafeteria";

// Módulos de Directivo
import DirectivoComunidadLayout from "@/pages/directivo-comunidad";
import DirectivoAcademiaLayout from "@/pages/directivo-academia";
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
import TesoreriaComunidadLayout from "@/pages/tesoreria-comunidad";
import TesoreriaAcademiaLayout from "@/pages/tesoreria-academia";
import TesoreriaComunicacionLayout from "@/pages/tesoreria-comunicacion";

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

const queryClient = new QueryClient();

function AppRouter() {
  const { user } = useAuth();
  const isLogged = Boolean(user);

  return (
    <>
      {isLogged ? (
        <AppLayout>
          <Switch>
            <Route path="/" component={Home} />

            <Route path="/dashboard">
              <AuthGuard><Dashboard /></AuthGuard>
            </Route>
            <Route path="/chat">
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
              <AuthGuard><TesoreriaPage /></AuthGuard>
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

            <Route path="/subjects">
              <AuthGuard><Courses /></AuthGuard>
            </Route>
            <Route path="/courses">
              <AuthGuard><Courses /></AuthGuard>
            </Route>
            <Route path="/course/:cursoId">
              <AuthGuard><CourseDetail /></AuthGuard>
            </Route>
            <Route path="/course-detail/:cursoId">
              <AuthGuard><CourseDetail /></AuthGuard>
            </Route>

            <Route path="/mi-aprendizaje/cursos">
              <AuthGuard><Courses /></AuthGuard>
            </Route>
            <Route path="/mi-aprendizaje/materiales">
              <AuthGuard><Materials /></AuthGuard>
            </Route>
            <Route path="/mi-aprendizaje/plataformas">
              <AuthGuard><PlataformasPage /></AuthGuard>
            </Route>
            <Route path="/mi-aprendizaje/calendario">
              <AuthGuard><CalendarPage /></AuthGuard>
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
            <Route path="/comunicacion/academico">
              <AuthGuard><ComunicacionAcademico /></AuthGuard>
            </Route>
            <Route path="/comunicacion/academico/:materiaId">
              <AuthGuard><ComunicacionAcademico /></AuthGuard>
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

            <Route path="/group-assignment">
              <AuthGuard><GroupAssignmentPage /></AuthGuard>
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
              <AuthGuard><ProfesorAsignarTareaPage /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/tareas/revision">
              <AuthGuard><ProfesorRevisionTareasPage /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/tareas/calificacion/:cursoId">
              <AuthGuard><ProfesorPanelCalificacionPage /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/tareas/editor/:id">
              <AuthGuard><ProfesorEditorDocumentoPage /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/tareas">
              <AuthGuard><ProfesorTareasPage /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/notas">
              <AuthGuard><Courses /></AuthGuard>
            </Route>
            <Route path="/profesor/academia/plataformas">
              <AuthGuard><PlataformasPage /></AuthGuard>
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
            <Route path="/directivo/academia">
              <AuthGuard><DirectivoAcademiaLayout /></AuthGuard>
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

            {/* Módulos de Tesorería */}
            <Route path="/tesoreria/comunidad">
              <AuthGuard><TesoreriaComunidadLayout /></AuthGuard>
            </Route>
            <Route path="/tesoreria/academia">
              <AuthGuard><TesoreriaAcademiaLayout /></AuthGuard>
            </Route>
            <Route path="/tesoreria/comunicacion">
              <AuthGuard><TesoreriaComunicacionLayout /></AuthGuard>
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
          <Route path="/" component={Entry} />
          
          {/* Rutas de login y registro activas */}
          <Route path="/login">
            <GuestGuard><Login /></GuestGuard>
          </Route>

          <Route path="/register">
            <GuestGuard><Register /></GuestGuard>
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
