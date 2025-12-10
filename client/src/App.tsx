import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/authContext";
import { AuthGuard, GuestGuard } from "@/components/auth-guard";

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
import Account from "@/pages/account";
import Setup from "@/pages/setup";
import NotFound from "@/pages/not-found";
// Role-specific pages
import StudentPage from "@/pages/student";
import TeacherPage from "@/pages/teacher";
import DirectorPage from "@/pages/director";
import ParentPage from "@/pages/parent";
// Director panel
import DirectivoPage from "@/pages/directivo";
// Teacher pages
import PlataformasPage from "@/pages/plataformas";
// Mi Aprendizaje module
import MiAprendizajeLayout from "@/pages/mi-aprendizaje";


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

<Route path="/mi-aprendizaje">
<AuthGuard>
<MiAprendizajeLayout />
</AuthGuard>
</Route>

{/* Spanish routes for Mi Aprendizaje module */}
<Route path="/cursos">
<AuthGuard>
<Courses />
</AuthGuard>
</Route>

<Route path="/materiales">
<AuthGuard>
<Materials />
</AuthGuard>
</Route>

<Route path="/calendario">
<AuthGuard>
<CalendarPage />
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

<Route path="/account">
<AuthGuard>
<Account />
</AuthGuard>
</Route>

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
