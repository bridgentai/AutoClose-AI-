  import { Switch, Route } from "wouter";
  import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
  import { TooltipProvider } from "@/components/ui/tooltip";
  import { Toaster } from "@/components/ui/toaster";
  import { AuthProvider } from "@/lib/authContext";
  import { AuthGuard, GuestGuard } from "@/components/auth-guard";

  // =========================================================================
  // P A G E S - I M P O R T S
  // =========================================================================

  // Pages
  import Home from "@/pages/home";
  import Login from "@/pages/login";
  import Register from "@/pages/register";
  import Dashboard from "@/pages/dashboard";
  import Chat from "@/pages/chat";
  import Courses from "@/pages/courses";
  import CourseDetail from "@/pages/course-detail";
  import CalendarPage from "@/pages/calendar";
  import Materials from "@/pages/materials";
  import Account from "@/pages/account"; // Componente original de la ruta /account
  import Setup from "@/pages/setup";
  import NotFound from "@/pages/not-found";

  // Role-specific pages
  import StudentPage from "@/pages/student";
  import TeacherPage from "@/pages/teacher";
  import TeacherCalendarPage from "@/pages/teacher-calendar";
  import AssignmentDetailPage from "@/pages/assignment-detail";
  import DirectorPage from "@/pages/director";
  import ParentPage from "@/pages/parent";
  import DirectivoPage from "@/pages/directivo";
  import PlataformasPage from "@/pages/plataformas";

  // Mi Aprendizaje module
  import MiAprendizajeLayout from "@/pages/mi-aprendizaje";

  // ----------------------------------------------------------------------
  // Componentes del Módulo 4: Mi Perfil (¡Usando el alias @/pages!)
  // ----------------------------------------------------------------------
  import PerfilLayout from "@/pages/PerfilLayout"; 
  import InformacionPersonal from "@/pages/InformacionPersonal";
  import FichaMedica from "@/pages/FichaMedica"; 
  // NOTA: No necesitamos MiCuentaPage, usaremos el componente 'Account'
  // ----------------------------------------------------------------------
  // Componentes del Módulo 3: Comunicación
  import ComunicacionLayout from "@/pages/ComunicacionLayout";
  import BandejaDeEntrada from "@/pages/BandejaDeEntrada";
  import RedactarMensaje from "@/pages/RedactarMensaje";
  import MensajesEnviados from "@/pages/MensajesEnviados";

  // Componentes del Módulo 2: Comunidad
  import ComunidadLayout from "@/pages/ComunidadLayout";
  import CalendarioEventos from "@/pages/CalendarioEventos";
  import AvisosNoticias from "@/pages/AvisosNoticias";

  // 🎯 NUEVO: Importamos el componente de Asignación de Grupos
  import GroupAssignmentPage from "@/pages/GroupAssignmentPage";


  const queryClient = new QueryClient();


  function Router() {
  return (
  <Switch>
  {/* Public routes */}
  <Route path="/login">
  <GuestGuard>
  <Login />
  </GuestGuard>
  </Route>

  <Route path="/register">
  <GuestGuard>
  <Register />
  </GuestGuard>
  </Route>

  {/* Home/Landing Page - accessible to everyone */}
  <Route path="/" component={Home} />

  {/* Protected routes */}

  {/* Role-specific interfaces */}
  <Route path="/student">
  <AuthGuard>
  <StudentPage />
  </AuthGuard>
  </Route>

  <Route path="/teacher">
  <AuthGuard>
  <TeacherPage />
  </AuthGuard>
  </Route>

  <Route path="/plataformas">
  <AuthGuard>
  <PlataformasPage />
  </AuthGuard>
  </Route>

  {/* Mi Aprendizaje - Student module */}
  <Route path="/mi-aprendizaje">
  <AuthGuard>
  <MiAprendizajeLayout />
  </AuthGuard>
  </Route>

  <Route path="/mi-aprendizaje/cursos">
  <AuthGuard>
  <Courses />
  </AuthGuard>
  </Route>

  <Route path="/mi-aprendizaje/materiales">
  <AuthGuard>
  <Materials />
  </AuthGuard>
  </Route>

  <Route path="/mi-aprendizaje/plataformas">
  <AuthGuard>
  <PlataformasPage />
  </AuthGuard>
  </Route>

  <Route path="/mi-aprendizaje/calendario">
  <AuthGuard>
  <CalendarPage />
  </AuthGuard>
  </Route>

  {/* ----------------------------------------------------------------------
  Rutas del Módulo 4: Mi Perfil (Estudiante)
  ---------------------------------------------------------------------- */}

  {/* 1. RUTA PRINCIPAL DEL LAYOUT: /mi-perfil */}
  <Route path="/mi-perfil">
  <AuthGuard>
  <PerfilLayout /> 
  </AuthGuard>
  </Route>

  {/* 2. SUB-RUTAS INTERNAS: Se cargan las páginas de destino */}
  <Route path="/mi-perfil/personal">
  <AuthGuard>
  <InformacionPersonal />
  </AuthGuard>
  </Route>

  <Route path="/mi-perfil/medica">
  <AuthGuard>
  <FichaMedica />
  </AuthGuard>
  </Route>

  {/* 3. SUB-RUTA 'Mi Cuenta' USA EL COMPONENTE YA EXISTENTE 'Account' */}
  <Route path="/mi-perfil/cuenta">
  <AuthGuard>
  <Account /> 
  </AuthGuard>
  </Route>


  <Route path="/director">
  <AuthGuard>
  <DirectorPage />
  </AuthGuard>
  </Route>

  <Route path="/parent">
  <AuthGuard>
  <ParentPage />
  </AuthGuard>
  </Route>

  <Route path="/dashboard">
  <AuthGuard>
  <Dashboard />
  </AuthGuard>
  </Route>

  <Route path="/chat">
  <AuthGuard>
  <Chat />
  </AuthGuard>
  </Route>

  {/* RUTA PRINCIPAL DE CURSOS/MATERIAS */}
  <Route path="/courses">
  <AuthGuard>
  <Courses />
  </AuthGuard>
  </Route>

        {/* 🎯 NUEVA RUTA PARA LA GESTIÓN DE ASIGNACIONES (PROFESOR) */}
        <Route path="/group-assignment">
          <AuthGuard>
            <GroupAssignmentPage />
          </AuthGuard>
        </Route>


  {/* RUTA CORREGIDA: Si el menú o la app usa /subjects, cargamos CoursesPage */}
  <Route path="/subjects">
  <AuthGuard>
  <Courses />
  </AuthGuard>
  </Route>

  <Route path="/course/:cursoId">
  <AuthGuard>
  <CourseDetail />
  </AuthGuard>
  </Route>


  <Route path="/calendar">
  <AuthGuard>
  <CalendarPage />
  </AuthGuard>
  </Route>

  <Route path="/teacher-calendar">
  <AuthGuard>
  <TeacherCalendarPage />
  </AuthGuard>
  </Route>

  <Route path="/assignment/:id">
  <AuthGuard>
  <AssignmentDetailPage />
  </AuthGuard>
  </Route>

  <Route path="/directivo">
  <AuthGuard>
  <DirectivoPage />
  </AuthGuard>
  </Route>

  <Route path="/materials">
  <AuthGuard>
  <Materials />
  </AuthGuard>
  </Route>

  {/* ----------------------------------------------------------------------
  Rutas del Módulo 3: Comunicación (Estudiante)
  ---------------------------------------------------------------------- */}
  <Route path="/comunicacion">
  <AuthGuard>
  <ComunicacionLayout />
  </AuthGuard>
  </Route>
  <Route path="/comunicacion/bandeja">
  <AuthGuard>
  <BandejaDeEntrada />
  </AuthGuard>
  </Route>
  <Route path="/comunicacion/redactar">
  <AuthGuard>
  <RedactarMensaje />
  </AuthGuard>
  </Route>
  <Route path="/comunicacion/enviados">
  <AuthGuard>
  <MensajesEnviados />
  </AuthGuard>
  </Route>

  {/* ----------------------------------------------------------------------
  Rutas del Módulo 2: Comunidad (Todos los roles)
  ---------------------------------------------------------------------- */}
  <Route path="/comunidad">
  <AuthGuard>
  <ComunidadLayout />
  </AuthGuard>
  </Route>
  <Route path="/comunidad/calendario">
  <AuthGuard>
  <CalendarioEventos />
  </AuthGuard>
  </Route>
  <Route path="/comunidad/noticias">
  <AuthGuard>
  <AvisosNoticias />
  </AuthGuard>
  </Route>

  {/* RUTA ORIGINAL DE /account - CUIDADO: Puedes comentar o eliminar si /mi-perfil/cuenta la reemplaza
  <Route path="/account">
  <AuthGuard>
  <Account />
  </AuthGuard>
  </Route>
  */}

  <Route path="/setup" component={Setup} />

  {/* Fallback to 404 */}
  <Route component={NotFound} />
  </Switch>
  );
  }

  function App() {
  return (
  <QueryClientProvider client={queryClient}>
  <AuthProvider>
  <TooltipProvider>
  <Toaster />
  <Router />
  </TooltipProvider>
  </AuthProvider>
  </QueryClientProvider>
  );
  }

  export default App;