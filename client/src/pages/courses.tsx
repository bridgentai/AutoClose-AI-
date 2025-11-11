import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Users, FileText } from 'lucide-react';

export default function Courses() {
  const { user } = useAuth();

  const courses = [
    { id: 1, nombre: 'Matemáticas Avanzadas', profesor: 'Prof. García', estudiantes: 32, materiales: 12, color: '#9f25b8' },
    { id: 2, nombre: 'Física Moderna', profesor: 'Prof. Martínez', estudiantes: 28, materiales: 15, color: '#6a0dad' },
    { id: 3, nombre: 'Química Orgánica', profesor: 'Prof. López', estudiantes: 30, materiales: 10, color: '#c66bff' },
    { id: 4, nombre: 'Historia Contemporánea', profesor: 'Prof. Rodríguez', estudiantes: 35, materiales: 8, color: '#9f25b8' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
      <AppSidebar />
      
      <div className="ml-20 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
              {user?.rol === 'profesor' ? 'Mis Cursos' : 'Cursos Disponibles'}
            </h1>
            <p className="text-white/60">
              {user?.rol === 'profesor' 
                ? 'Gestiona y actualiza tus materias' 
                : 'Accede a los materiales y recursos de tus cursos'}
            </p>
          </div>

          {user?.rol === 'profesor' && (
            <div className="mb-6">
              <button className="px-6 py-3 bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90 text-white rounded-xl font-medium transition-opacity">
                + Crear Nuevo Curso
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {courses.map((course) => (
              <Card key={course.id} className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate transition-all cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${course.color}, #6a0dad)` }}
                    >
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-white">{course.nombre}</CardTitle>
                      <CardDescription className="text-white/60 text-sm">{course.profesor}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-white/70">
                      <Users className="w-4 h-4" />
                      <span>{course.estudiantes} estudiantes</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/70">
                      <FileText className="w-4 h-4" />
                      <span>{course.materiales} materiales</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
