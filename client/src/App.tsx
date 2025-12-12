import { Switch, Route } from "wouter";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/lib/authContext";
import { AuthGuard, GuestGuard } from "@/components/auth-guard";

// Layout global
import { AppSidebar } from "@/components/app-sidebar";
import { AppLayout } from "@/layout/AppLayout";

// =========================================================================
// P A G E S
// =========================================================================

import Home from "@/pages/home";
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

import StudentPage from "@/pages/student";
import TeacherPage from "@/pages/teacher";
import TeacherCalendarPage from "@/pages/teacher-calendar";
import AssignmentDetailPage from "@/pages/assignment-detail";
import DirectorPage from "@/pages/director";
import ParentPage from "@/pages/parent";
import DirectivoPage from "@/pages/directivo";
import PlataformasPage from "@/pages/plataformas";

import MiAprendizajeLayout from "@/pages/mi-aprendizaje";

import PerfilLayout from "@/pages/PerfilLayout"; 
import InformacionPersonal from "@/pages/InformacionPersonal";
import FichaMedica from "@/pages/FichaMedica"; 

import ComunicacionHome from "@/pages/ComunicacionHome";

import ComunidadLayout from "@/pages/ComunidadLayout";
import CalendarioEventos from "@/pages/CalendarioEventos";
import AvisosNoticias from "@/pages/AvisosNoticias";

import GroupAssignmentPage from "@/pages/GroupAssignmentPage";

const queryClient = new QueryClient();

// ==============================================================
//   R O U T E R   C O N   L A Y O U T
// ==============================================================

function AppRouter() {
  const { user } = useAuth();

  const isLogged = Boolean(user);

  return (
    <>
      {/* Sidebar SOLO si está autenticado */}
      {isLogged && <AppSidebar />}

      {/* El layout global SOLO cuando hay usuario */}
      {isLogged ? (
        <AppLayout>
          <Switch>
            {/* Home */}
            <Route path="/" component={Home} />

            {/* Interfaces principales */}
            <Route path="/dashboard">
              <AuthGuard><Dashboard /></AuthGuard>
            </Route>
            <Route path="/chat">
              <AuthGuard><Chat /></AuthGuard>
            </Route>

            {/* Roles */}
            <Route path="/student">
              <AuthGuard><StudentPage /></AuthGuard>
            </Route>
            <Route path="/teacher">
              <AuthGuard><TeacherPage /></AuthGuard>
            </Route>
            <Route path="/director">
              <AuthGuard><DirectorPage /></AuthGuard>
            </Route>
            <Route path="/parent">
              <AuthGuard><ParentPage /></AuthGuard>
            </Route>
            <Route path="/directivo">
              <AuthGuard><DirectivoPage /></AuthGuard>
            </Route>

            {/* Materias / Cursos */}
            <Route path="/subjects">
              <AuthGuard><Courses /></AuthGuard>
            </Route>
            <Route path="/courses">
              <AuthGuard><Courses /></AuthGuard>
            </Route>
            <Route path="/course/:cursoId">
              <AuthGuard><CourseDetail /></AuthGuard>
            </Route>

            {/* Mi Aprendizaje */}
            <Route path="/mi-aprendizaje">
              <AuthGuard><MiAprendizajeLayout /></AuthGuard>
            </Route>

            {/* Mi Perfil */}
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

            {/* Comunicación */}
            <Route path="/comunicacion">
              <AuthGuard><ComunicacionHome /></AuthGuard>
            </Route>

            {/* Comunidad */}
            <Route path="/comunidad">
              <AuthGuard><ComunidadLayout /></AuthGuard>
            </Route>
            <Route path="/comunidad/calendario">
              <AuthGuard><CalendarioEventos /></AuthGuard>
            </Route>
            <Route path="/comunidad/noticias">
              <AuthGuard><AvisosNoticias /></AuthGuard>
            </Route>

            {/* Calendarios */}
            <Route path="/calendar">
              <AuthGuard><CalendarPage /></AuthGuard>
            </Route>
            <Route path="/teacher-calendar">
              <AuthGuard><TeacherCalendarPage /></AuthGuard>
            </Route>

            {/* Grupos */}
            <Route path="/group-assignment">
              <AuthGuard><GroupAssignmentPage /></AuthGuard>
            </Route>

            {/* Materiales */}
            <Route path="/materials">
              <AuthGuard><Materials /></AuthGuard>
            </Route>

            {/* Asignaciones */}
            <Route path="/assignment/:id">
              <AuthGuard><AssignmentDetailPage /></AuthGuard>
            </Route>

            {/* 404 */}
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      ) : (
        // ===========================================
        // RUTAS SIN LAYOUT (Login / Register)
        // ===========================================
        <Switch>
          <Route path="/login">
            <GuestGuard><Login /></GuestGuard>
          </Route>

          <Route path="/register">
            <GuestGuard><Register /></GuestGuard>
          </Route>

          {/* fallback cuando no está autenticado */}
          <Route component={Login} />
        </Switch>
      )}
    </>
  );
}

// ==============================================================
//   A P P   W R A P P E R S
// ==============================================================

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
