import { Switch, Route } from "wouter";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/lib/authContext";
import { AuthGuard, GuestGuard } from "@/components/auth-guard";

import { TopNavigation } from "@/components/TopNavigation";

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

function AppRouter() {
  const { user } = useAuth();
  const isLogged = Boolean(user);

  return (
    <>
      {isLogged ? (
        <div className="min-h-screen w-full bg-gradient-to-b from-black via-[#1a0020] to-[#0c0010] text-white">
          <TopNavigation />
          <main className="pt-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
              <Switch>
                <Route path="/" component={Home} />

                <Route path="/dashboard">
                  <AuthGuard><Dashboard /></AuthGuard>
                </Route>
                <Route path="/chat">
                  <AuthGuard><Chat /></AuthGuard>
                </Route>

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

                <Route path="/subjects">
                  <AuthGuard><Courses /></AuthGuard>
                </Route>
                <Route path="/courses">
                  <AuthGuard><Courses /></AuthGuard>
                </Route>
                <Route path="/course/:cursoId">
                  <AuthGuard><CourseDetail /></AuthGuard>
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

                <Route component={NotFound} />
              </Switch>
            </div>
          </main>
        </div>
      ) : (
        <Switch>
          <Route path="/login">
            <GuestGuard><Login /></GuestGuard>
          </Route>

          <Route path="/register">
            <GuestGuard><Register /></GuestGuard>
          </Route>

          <Route component={Login} />
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
