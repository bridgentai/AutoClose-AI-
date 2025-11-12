import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export default function Register() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: '' as 'estudiante' | 'profesor' | 'directivo' | 'padre' | '',
    curso: '',
    codigoAcceso: '', // Código del colegio para profesor/directivo
    colegioId: 'default_colegio',
    hijoId: '',
  });
  const [materias, setMaterias] = useState<string[]>([]);
  const [currentMateria, setCurrentMateria] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.rol) {
      setError('Por favor selecciona un rol');
      setLoading(false);
      return;
    }

    if (formData.rol === 'estudiante' && !formData.curso) {
      setError('Los estudiantes deben especificar su curso');
      setLoading(false);
      return;
    }

    if ((formData.rol === 'profesor' || formData.rol === 'directivo') && !formData.codigoAcceso) {
      setError('Debes ingresar el código del colegio');
      setLoading(false);
      return;
    }

    // Validar materias para profesores
    if (formData.rol === 'profesor' && materias.length === 0) {
      setError('Los profesores deben especificar al menos una materia');
      setLoading(false);
      return;
    }

    try {
      await apiRequest('POST', '/api/auth/register', {
        ...formData,
        materias: formData.rol === 'profesor' ? materias : undefined
      });
      
      setSuccess(true);
      // Redirigir a login después de 2 segundos
      setTimeout(() => setLocation('/login'), 2000);
    } catch (err: any) {
      setError(err.message || 'Error al registrar usuario');
    } finally {
      setLoading(false);
    }
  };

  const addMateria = () => {
    if (currentMateria.trim() && !materias.includes(currentMateria.trim()) && materias.length < 10) {
      setMaterias([...materias, currentMateria.trim()]);
      setCurrentMateria('');
    }
  };

  const removeMateria = (materia: string) => {
    setMaterias(materias.filter(m => m !== materia));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
         style={{
           background: 'radial-gradient(circle at 20% 20%, #25003d, #0b0013 80%)'
         }}>
      <div className="w-full max-w-md">
        <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-3xl p-10 shadow-2xl"
             style={{ boxShadow: '0 0 35px rgba(159, 37, 184, 0.25)' }}>
          
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-[#9f25b8] to-[#c66bff] bg-clip-text text-transparent font-['Poppins']">
            Crear cuenta
          </h2>
          <p className="text-white/70 mb-8">Únete a AutoClose AI</p>

          {success ? (
            <div className="text-center py-8">
              <p className="text-green-400 font-semibold mb-2">¡Registro exitoso!</p>
              <p className="text-white/70 text-sm">Ahora puedes iniciar sesión con tu cuenta</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="nombre" className="text-white/90 mb-2 block">Nombre completo</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  placeholder="Juan Pérez"
                  data-testid="input-nombre"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-white/90 mb-2 block">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  placeholder="juan@correo.com"
                  data-testid="input-email"
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-white/90 mb-2 block">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  placeholder="••••••••"
                  data-testid="input-password"
                />
              </div>

              <div>
                <Label className="text-white/90 mb-2 block">Rol</Label>
                <Select
                  value={formData.rol}
                  onValueChange={(value: any) => setFormData({ ...formData, rol: value })}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-rol">
                    <SelectValue placeholder="Selecciona tu rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="estudiante">Estudiante</SelectItem>
                    <SelectItem value="profesor">Profesor</SelectItem>
                    <SelectItem value="directivo">Directivo</SelectItem>
                    <SelectItem value="padre">Padre/Madre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.rol === 'estudiante' && (
                <div>
                  <Label htmlFor="curso" className="text-white/90 mb-2 block">Curso</Label>
                  <Input
                    id="curso"
                    value={formData.curso}
                    onChange={(e) => setFormData({ ...formData, curso: e.target.value })}
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                    placeholder="ej: 10A, 11B"
                    data-testid="input-curso"
                  />
                </div>
              )}

              {formData.rol === 'profesor' && (
                <div>
                  <Label className="text-white/90 mb-2 block">Materias que dictas *</Label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={currentMateria}
                        onChange={(e) => setCurrentMateria(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addMateria();
                          }
                        }}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/40 flex-1"
                        placeholder="ej: Filosofía, Matemáticas"
                        data-testid="input-materia"
                      />
                      <Button
                        type="button"
                        onClick={addMateria}
                        disabled={!currentMateria.trim() || materias.length >= 10}
                        className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
                        size="icon"
                        data-testid="button-add-materia"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    {materias.length > 0 && (
                      <div className="flex flex-wrap gap-2" data-testid="container-materias">
                        {materias.map((materia) => (
                          <Badge
                            key={materia}
                            className="bg-[#9f25b8]/20 text-white border border-[#9f25b8]/40 hover:bg-[#9f25b8]/30"
                            data-testid={`badge-materia-${materia.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            {materia}
                            <button
                              type="button"
                              onClick={() => removeMateria(materia)}
                              className="ml-2 hover:text-red-400"
                              data-testid={`button-remove-${materia.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-white/50 text-xs">
                      Agrega todas las materias que dictas (máximo 10). Presiona Enter o el botón + para agregar.
                    </p>
                  </div>
                </div>
              )}

              {(formData.rol === 'profesor' || formData.rol === 'directivo') && (
                <div>
                  <Label htmlFor="codigoAcceso" className="text-white/90 mb-2 block">Código del Colegio</Label>
                  <Input
                    id="codigoAcceso"
                    value={formData.codigoAcceso}
                    onChange={(e) => setFormData({ ...formData, codigoAcceso: e.target.value })}
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                    placeholder="Código proporcionado por tu institución"
                    data-testid="input-codigo-acceso"
                  />
                </div>
              )}

              {error && (
                <p className="text-red-400 text-sm" data-testid="text-error">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#9f25b8] to-[#c66bff] hover:opacity-90 text-white font-semibold"
                data-testid="button-register"
              >
                {loading ? 'Registrando...' : 'Crear cuenta'}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => setLocation('/login')}
              className="text-white/60 hover:text-white/90 text-sm transition-colors"
              data-testid="link-login"
            >
              ¿Ya tienes cuenta? <span className="text-[#9f25b8] font-semibold">Inicia sesión</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
