/**
 * Prueba Piloto - Creación de Datos Reales
 *
 * Test omnisciente: crea todas las cuentas por sí mismo (incluido el admin) y luego
 * crea usuarios, grupos, tareas, entregas, calificaciones y chats desde los roles indicados.
 * No requiere credenciales previas.
 *
 * Requisitos:
 * - Backend accesible (PLAYWRIGHT_BASE_URL o BASE_URL; default http://localhost:5000)
 * - Base de datos según proyecto (PG para modo actual)
 *
 * Ejecutar: npm run test:e2e:crear-datos
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const E2E_BASE =
  process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:5000';

// Tipos para el informe final
interface CreatedData {
  fechaEjecucion: string;
  admin: {
    email: string;
    password: string;
    token: string;
  };
  usuarios: {
    directivo?: { id: string; email: string; password: string; nombre: string };
    profesores: Array<{ id: string; email: string; password: string; nombre: string; materias: string[] }>;
    estudiantes: Array<{ id: string; email: string; password: string; nombre: string; curso: string }>;
    padres: Array<{ id: string; email: string; password: string; nombre: string }>;
  };
  grupos: Array<{ id: string; nombre: string; seccion: string }>;
  cursos: Array<{ id: string; nombre: string; profesorId: string }>;
  asignacionesProfesor: Array<{ profesorId: string; grupos: string[]; materia: string }>;
  estudiantesEnGrupos: Array<{ grupoId: string; estudianteId: string }>;
  vinculacionesPadres: Array<{ padreId: string; estudianteId: string }>;
  tareas: Array<{ id: string; titulo: string; curso: string; profesorId: string; fechaEntrega: string }>;
  entregas: Array<{ tareaId: string; estudianteId: string }>;
  calificaciones: Array<{ tareaId: string; estudianteId: string; calificacion: number }>;
  chats: Array<{ id: string; titulo: string; userId: string; rol: string }>;
  resumen: {
    totalUsuarios: number;
    totalGrupos: number;
    totalCursos: number;
    totalTareas: number;
    totalEntregas: number;
    totalCalificaciones: number;
    totalChats: number;
  };
}

// Helper: Login y obtener token
async function login(request: any, email: string, password: string): Promise<string> {
  const response = await request.post('/api/auth/login', {
    data: { email, password },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Login fallido para ${email}: ${response.status()} - ${body}`);
  }

  const data = await response.json();
  if (!data.token) {
    throw new Error(`No se recibió token para ${email}`);
  }

  return data.token;
}

// Helper: Request autenticado
async function authenticatedRequest(
  request: any,
  token: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  data?: any
): Promise<any> {
  const options: any = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (data) {
    options.data = data;
  }

  const response = await request[method.toLowerCase()](url, options);

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Request fallido ${method} ${url}: ${response.status()} - ${body}`);
  }

  return await response.json();
}

test.describe('Prueba Piloto - Creación de Datos Reales', () => {
  let adminToken: string;
  let adminEmail: string;
  let adminPassword: string;
  const createdData: CreatedData = {
    fechaEjecucion: new Date().toISOString(),
    admin: { email: '', password: '', token: '' },
    usuarios: {
      profesores: [],
      estudiantes: [],
      padres: [],
    },
    grupos: [],
    cursos: [],
    asignacionesProfesor: [],
    estudiantesEnGrupos: [],
    vinculacionesPadres: [],
    tareas: [],
    entregas: [],
    calificaciones: [],
    chats: [],
    resumen: {
      totalUsuarios: 0,
      totalGrupos: 0,
      totalCursos: 0,
      totalTareas: 0,
      totalEntregas: 0,
      totalCalificaciones: 0,
      totalChats: 0,
    },
  };

  test.beforeAll(async ({ request }) => {
    // Verificar que el servidor está corriendo
    try {
      const healthResponse = await request.get('/api/health', { timeout: 5000 });
      if (!healthResponse.ok()) {
        throw new Error(`Servidor no responde correctamente: ${healthResponse.status()}`);
      }
    } catch (error: any) {
      if (error.message?.includes('ECONNREFUSED') || error.message?.includes('timeout')) {
        throw new Error(
          `ERROR: No hay backend en ${E2E_BASE}. Ejecuta npm run dev o define PLAYWRIGHT_BASE_URL.`
        );
      }
      throw error;
    }

    // Admin piloto: se crea por registro (sin credenciales previas). Código de colegio demo.
    const PILOTO_ADMIN_EMAIL = 'piloto-admin@colegio-piloto.local';
    const PILOTO_ADMIN_PASSWORD = 'PilotoAdmin123!';
    const CODIGO_COLEGIO_DEMO = 'COLEGIO_DEMO_2025';

    console.log('🔐 Creando admin piloto por registro...');

    const registerRes = await request.post('/api/auth/register', {
      data: {
        nombre: 'Admin Piloto MVP',
        email: PILOTO_ADMIN_EMAIL,
        password: PILOTO_ADMIN_PASSWORD,
        rol: 'admin-general-colegio',
        codigoAcceso: CODIGO_COLEGIO_DEMO,
      },
    });

    if (registerRes.ok()) {
      console.log('✅ Admin piloto registrado');
    } else {
      const body = await registerRes.text();
      const alreadyExists = body.includes('ya está registrado') || body.includes('ya existe');
      if (!alreadyExists) {
        throw new Error(`No se pudo crear el admin piloto: ${registerRes.status()} - ${body}`);
      }
      console.log('✅ Admin piloto ya existía, se usará para login');
    }

    adminEmail = PILOTO_ADMIN_EMAIL;
    adminPassword = PILOTO_ADMIN_PASSWORD;
    adminToken = await login(request, adminEmail, adminPassword);

    createdData.admin = {
      email: adminEmail,
      password: adminPassword,
      token: adminToken,
    };

    console.log('✅ Login como admin piloto listo');
  });

  test('1. Crear usuarios (Directivo, Profesores, Estudiantes, Padres)', async ({ request }) => {
    console.log('\n📝 Creando usuarios...');

    // Crear Directivo
    const directivoData = await authenticatedRequest(request, adminToken, 'POST', '/api/users/create', {
      nombre: 'María González',
      email: 'directivo@colegio.com',
      rol: 'directivo',
    });
    createdData.usuarios.directivo = {
      id: directivoData.user._id,
      email: directivoData.user.email,
      password: directivoData.user.passwordTemporal,
      nombre: directivoData.user.nombre,
    };
    console.log(`✅ Directivo creado: ${directivoData.user.email} (password: ${directivoData.user.passwordTemporal})`);

    // Crear Profesores
    const profesoresData = [
      { nombre: 'Carlos Ramírez', email: 'profesor.matematicas@colegio.com', materias: ['Matemáticas'] },
      { nombre: 'Ana Martínez', email: 'profesor.espanol@colegio.com', materias: ['Español'] },
      { nombre: 'Luis Fernández', email: 'profesor.ciencias@colegio.com', materias: ['Ciencias'] },
    ];

    for (const prof of profesoresData) {
      const profData = await authenticatedRequest(request, adminToken, 'POST', '/api/users/create', {
        nombre: prof.nombre,
        email: prof.email,
        rol: 'profesor',
        materias: prof.materias,
      });
      createdData.usuarios.profesores.push({
        id: profData.user._id,
        email: profData.user.email,
        password: profData.user.passwordTemporal,
        nombre: profData.user.nombre,
        materias: prof.materias,
      });
      console.log(`✅ Profesor creado: ${profData.user.email} (password: ${profData.user.passwordTemporal})`);
    }

    // Crear Estudiantes
    const estudiantesData = [
      { nombre: 'Juan Pérez', email: 'estudiante1@colegio.com' },
      { nombre: 'Sofía López', email: 'estudiante2@colegio.com' },
      { nombre: 'Diego Torres', email: 'estudiante3@colegio.com' },
      { nombre: 'Valentina Ruiz', email: 'estudiante4@colegio.com' },
    ];

    for (const est of estudiantesData) {
      const estData = await authenticatedRequest(request, adminToken, 'POST', '/api/users/create', {
        nombre: est.nombre,
        email: est.email,
        rol: 'estudiante',
      });
      createdData.usuarios.estudiantes.push({
        id: estData.user._id,
        email: estData.user.email,
        password: estData.user.passwordTemporal,
        nombre: estData.user.nombre,
        curso: '', // Se asignará después
      });
      console.log(`✅ Estudiante creado: ${estData.user.email} (password: ${estData.user.passwordTemporal})`);
    }

    // Crear Padres
    const padresData = [
      { nombre: 'Roberto Pérez', email: 'padre1@colegio.com' },
      { nombre: 'Carmen López', email: 'padre2@colegio.com' },
      { nombre: 'Miguel Torres', email: 'padre3@colegio.com' },
    ];

    for (const padre of padresData) {
      const padreData = await authenticatedRequest(request, adminToken, 'POST', '/api/users/create', {
        nombre: padre.nombre,
        email: padre.email,
        rol: 'padre',
      });
      createdData.usuarios.padres.push({
        id: padreData.user._id,
        email: padreData.user.email,
        password: padreData.user.passwordTemporal,
        nombre: padreData.user.nombre,
      });
      console.log(`✅ Padre creado: ${padreData.user.email} (password: ${padreData.user.passwordTemporal})`);
    }

    createdData.resumen.totalUsuarios =
      1 + // directivo
      createdData.usuarios.profesores.length +
      createdData.usuarios.estudiantes.length +
      createdData.usuarios.padres.length;
  });

  test('2. Crear grupos (cursos)', async ({ request }) => {
    console.log('\n📚 Creando grupos...');

    const gruposData = [
      { nombre: '11A', seccion: 'high-school' },
      { nombre: '10B', seccion: 'high-school' },
      { nombre: '9C', seccion: 'middle-school' },
    ];

    const existingGroups = await authenticatedRequest(request, adminToken, 'GET', '/api/groups/all');
    const existingByName = new Map((existingGroups || []).map((g: { _id: string; nombre: string }) => [g.nombre.toUpperCase().trim(), g]));

    for (const grupo of gruposData) {
      const nombreNorm = grupo.nombre.toUpperCase().trim();
      const existente = existingByName.get(nombreNorm);

      if (existente) {
        createdData.grupos.push({
          id: existente._id,
          nombre: existente.nombre,
          seccion: grupo.seccion,
        });
        console.log(`✅ Grupo ya existía, usando: ${existente.nombre}`);
      } else {
        const grupoData = await authenticatedRequest(request, adminToken, 'POST', '/api/groups/create', {
          nombre: grupo.nombre,
          seccion: grupo.seccion,
        });
        createdData.grupos.push({
          id: grupoData.grupo._id,
          nombre: grupoData.grupo.nombre,
          seccion: grupoData.grupo.seccion,
        });
        console.log(`✅ Grupo creado: ${grupoData.grupo.nombre} (${grupoData.grupo.seccion})`);
      }
    }

    createdData.resumen.totalGrupos = createdData.grupos.length;
  });

  test('3. Crear cursos (materias) y asignar profesores', async ({ request }) => {
    console.log('\n📖 Creando cursos y asignando profesores...');

    expect(createdData.usuarios.profesores?.length, 'Se requieren profesores creados (test 1).').toBeGreaterThan(0);
    expect(createdData.grupos?.length, 'Se requieren grupos creados (test 2).').toBeGreaterThan(0);

    const profesorToken = await login(
      request,
      createdData.usuarios.profesores[0].email,
      createdData.usuarios.profesores[0].password
    );

    // Crear cursos (materias) como profesor
    const cursosData = [
      { nombre: 'Matemáticas', descripcion: 'Curso de Matemáticas' },
      { nombre: 'Español', descripcion: 'Curso de Español' },
      { nombre: 'Ciencias', descripcion: 'Curso de Ciencias' },
    ];

    for (let i = 0; i < cursosData.length; i++) {
      const curso = cursosData[i];
      const profesorId = createdData.usuarios.profesores[i].id;

      // Login como el profesor correspondiente
      const token = await login(
        request,
        createdData.usuarios.profesores[i].email,
        createdData.usuarios.profesores[i].password
      );

      const cursoData = await authenticatedRequest(request, token, 'POST', '/api/courses', {
        nombre: curso.nombre,
        descripcion: curso.descripcion,
      });

      createdData.cursos.push({
        id: cursoData._id,
        nombre: cursoData.nombre,
        profesorId: profesorId,
      });
      console.log(`✅ Curso creado: ${cursoData.nombre} (profesor: ${createdData.usuarios.profesores[i].nombre})`);
    }

    // Asignar profesores a grupos usando el endpoint de admin
    for (let i = 0; i < createdData.usuarios.profesores.length; i++) {
      const profesor = createdData.usuarios.profesores[i];
      const grupo = createdData.grupos[i % createdData.grupos.length];

      const asignacionData = await authenticatedRequest(
        request,
        adminToken,
        'POST',
        '/api/courses/assign-professor-to-groups',
        {
          professorId: profesor.id,
          groupNames: [grupo.nombre],
        }
      );

      createdData.asignacionesProfesor.push({
        profesorId: profesor.id,
        grupos: [grupo.nombre],
        materia: profesor.materias[0],
      });
      console.log(`✅ Profesor ${profesor.nombre} asignado a grupo ${grupo.nombre}`);
    }

    createdData.resumen.totalCursos = createdData.cursos.length;
  });

  test('4. Asignar estudiantes a grupos', async ({ request }) => {
    console.log('\n👥 Asignando estudiantes a grupos...');

    expect(createdData.usuarios.estudiantes?.length, 'Se requieren estudiantes (test 1).').toBeGreaterThan(0);
    expect(createdData.grupos?.length, 'Se requieren grupos (test 2).').toBeGreaterThan(0);

    for (let i = 0; i < createdData.usuarios.estudiantes.length; i++) {
      const estudiante = createdData.usuarios.estudiantes[i];
      const grupo = createdData.grupos[i % createdData.grupos.length];

      await authenticatedRequest(request, adminToken, 'POST', '/api/groups/assign-student', {
        grupoId: grupo.nombre,
        estudianteId: estudiante.id,
      });

      // Actualizar curso del estudiante en el objeto
      estudiante.curso = grupo.nombre;

      createdData.estudiantesEnGrupos.push({
        grupoId: grupo.id,
        estudianteId: estudiante.id,
      });
      console.log(`✅ Estudiante ${estudiante.nombre} asignado a grupo ${grupo.nombre}`);
    }
  });

  test('5. Vincular padres con estudiantes', async ({ request }) => {
    console.log('\n🔗 Vinculando padres con estudiantes...');

    // Vincular cada padre con un estudiante
    for (let i = 0; i < createdData.usuarios.padres.length; i++) {
      const padre = createdData.usuarios.padres[i];
      const estudiante = createdData.usuarios.estudiantes[i];

      await authenticatedRequest(request, adminToken, 'POST', '/api/users/vinculaciones', {
        padreId: padre.id,
        estudianteId: estudiante.id,
      });

      createdData.vinculacionesPadres.push({
        padreId: padre.id,
        estudianteId: estudiante.id,
      });
      console.log(`✅ Padre ${padre.nombre} vinculado con estudiante ${estudiante.nombre}`);
    }
  });

  test('6. Crear tareas (assignments)', async ({ request }) => {
    console.log('\n📋 Creando tareas...');

    expect(createdData.usuarios.profesores?.length, 'Se requieren profesores (test 1).').toBeGreaterThan(0);
    expect(createdData.cursos?.length, 'Se requieren cursos (test 3).').toBeGreaterThan(0);
    expect(createdData.grupos?.length, 'Se requieren grupos (test 2).').toBeGreaterThan(0);

    const profesorToken = await login(
      request,
      createdData.usuarios.profesores[0].email,
      createdData.usuarios.profesores[0].password
    );

    const cursoId = createdData.cursos[0].id;
    const grupo = createdData.grupos[0];

    const tareasData = [
      {
        titulo: 'Tarea 1: Ejercicios de Álgebra',
        descripcion: 'Resolver los ejercicios del capítulo 3',
        curso: grupo.nombre,
        courseId: cursoId,
        fechaEntrega: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 días desde ahora
      },
      {
        titulo: 'Tarea 2: Ensayo sobre Literatura',
        descripcion: 'Escribir un ensayo de 500 palabras sobre el tema asignado',
        curso: grupo.nombre,
        courseId: cursoId,
        fechaEntrega: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 días desde ahora
      },
    ];

    for (const tarea of tareasData) {
      const tareaData = await authenticatedRequest(request, profesorToken, 'POST', '/api/assignments', tarea);

      createdData.tareas.push({
        id: tareaData._id,
        titulo: tareaData.titulo,
        curso: tareaData.curso,
        profesorId: tareaData.profesorId,
        fechaEntrega: tareaData.fechaEntrega,
      });
      console.log(`✅ Tarea creada: ${tareaData.titulo}`);
    }

    createdData.resumen.totalTareas = createdData.tareas.length;
  });

  test('7. Crear entregas (submissions)', async ({ request }) => {
    console.log('\n📤 Creando entregas...');

    expect(createdData.usuarios.estudiantes?.length, 'Se requieren estudiantes (test 1).').toBeGreaterThan(0);
    expect(createdData.tareas?.length, 'Se requieren tareas (test 6).').toBeGreaterThan(0);

    for (let i = 0; i < Math.min(2, createdData.usuarios.estudiantes.length); i++) {
      const estudiante = createdData.usuarios.estudiantes[i];
      const tarea = createdData.tareas[0]; // Primera tarea

      const estudianteToken = await login(request, estudiante.email, estudiante.password);

      await authenticatedRequest(
        request,
        estudianteToken,
        'POST',
        `/api/assignments/${tarea.id}/submit`,
        {
          archivos: [],
          comentario: `Entrega de ${estudiante.nombre} para la tarea ${tarea.titulo}`,
        }
      );

      createdData.entregas.push({
        tareaId: tarea.id,
        estudianteId: estudiante.id,
      });
      console.log(`✅ Entrega creada: ${estudiante.nombre} -> ${tarea.titulo}`);
    }

    createdData.resumen.totalEntregas = createdData.entregas.length;
  });

  test('8. Calificar entregas', async ({ request }) => {
    console.log('\n⭐ Calificando entregas...');

    expect(createdData.usuarios.profesores?.length, 'Se requieren profesores (test 1).').toBeGreaterThan(0);
    expect(createdData.entregas?.length, 'Se requieren entregas (test 7).').toBeGreaterThan(0);

    const profesorToken = await login(
      request,
      createdData.usuarios.profesores[0].email,
      createdData.usuarios.profesores[0].password
    );

    for (const entrega of createdData.entregas) {
      const calificacion = Math.floor(Math.random() * 30) + 70; // Entre 70 y 100

      await authenticatedRequest(
        request,
        profesorToken,
        'PUT',
        `/api/assignments/${entrega.tareaId}/grade`,
        {
          estudianteId: entrega.estudianteId,
          calificacion: calificacion,
          retroalimentacion: `Excelente trabajo. Calificación: ${calificacion}/100`,
          logro: 'Alcanzado',
        }
      );

      createdData.calificaciones.push({
        tareaId: entrega.tareaId,
        estudianteId: entrega.estudianteId,
        calificacion: calificacion,
      });
      console.log(`✅ Calificación creada: ${calificacion}/100 para estudiante ${entrega.estudianteId}`);
    }

    createdData.resumen.totalCalificaciones = createdData.calificaciones.length;
  });

  test('9. Crear chats (conversaciones)', async ({ request }) => {
    console.log('\n💬 Creando chats...');

    expect(createdData.usuarios.estudiantes?.length, 'Se requieren estudiantes (test 1).').toBeGreaterThan(0);
    expect(createdData.usuarios.profesores?.length, 'Se requieren profesores (test 1).').toBeGreaterThan(0);
    expect(createdData.cursos?.length, 'Se requieren cursos (test 3).').toBeGreaterThan(0);

    const estudiante = createdData.usuarios.estudiantes[0];
    const estudianteToken = await login(request, estudiante.email, estudiante.password);
    const cursoId = createdData.cursos[0].id;

    const chatEstudiante = await authenticatedRequest(
      request,
      estudianteToken,
      'POST',
      '/api/chat/new',
      {
        titulo: 'Chat de Estudiante - Consulta sobre Matemáticas',
        contextoTipo: 'estudiante_general',
        cursoId: cursoId,
      }
    );
    createdData.chats.push({
      id: chatEstudiante.sessionId,
      titulo: 'Chat de Estudiante - Consulta sobre Matemáticas',
      userId: estudiante.id,
      rol: 'estudiante',
    });
    console.log(`✅ Chat creado: Estudiante -> ${chatEstudiante.sessionId}`);

    // Crear chat como profesor
    const profesor = createdData.usuarios.profesores[0];
    const profesorToken = await login(request, profesor.email, profesor.password);

    const chatProfesor = await authenticatedRequest(
      request,
      profesorToken,
      'POST',
      '/api/chat/new',
      {
        titulo: 'Chat de Profesor - Planificación de Clases',
        contextoTipo: 'profesor_general',
        cursoId: cursoId,
      }
    );
    createdData.chats.push({
      id: chatProfesor.sessionId,
      titulo: 'Chat de Profesor - Planificación de Clases',
      userId: profesor.id,
      rol: 'profesor',
    });
    console.log(`✅ Chat creado: Profesor -> ${chatProfesor.sessionId}`);

    // Crear chat como padre
    const padre = createdData.usuarios.padres[0];
    const padreToken = await login(request, padre.email, padre.password);

    const chatPadre = await authenticatedRequest(
      request,
      padreToken,
      'POST',
      '/api/chat/new',
      {
        titulo: 'Chat de Padre - Consulta sobre Rendimiento',
        contextoTipo: 'padre_general',
      }
    );
    createdData.chats.push({
      id: chatPadre.sessionId,
      titulo: 'Chat de Padre - Consulta sobre Rendimiento',
      userId: padre.id,
      rol: 'padre',
    });
    console.log(`✅ Chat creado: Padre -> ${chatPadre.sessionId}`);

    createdData.resumen.totalChats = createdData.chats.length;
  });

  test('10. Generar informe final', async () => {
    console.log('\n📊 Generando informe final...');

    // Crear directorio docs si no existe
    const docsDir = path.join(process.cwd(), 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    // Nombre del archivo con fecha
    const fecha = new Date().toISOString().split('T')[0];
    const informePath = path.join(docsDir, `INFORME_DATOS_PILOTO_${fecha}.json`);

    // Escribir informe
    fs.writeFileSync(informePath, JSON.stringify(createdData, null, 2), 'utf-8');

    console.log(`\n✅ Informe generado: ${informePath}`);
    console.log('\n📋 RESUMEN DE DATOS CREADOS:');
    console.log(`   - Usuarios: ${createdData.resumen.totalUsuarios}`);
    console.log(`   - Grupos: ${createdData.resumen.totalGrupos}`);
    console.log(`   - Cursos: ${createdData.resumen.totalCursos}`);
    console.log(`   - Tareas: ${createdData.resumen.totalTareas}`);
    console.log(`   - Entregas: ${createdData.resumen.totalEntregas}`);
    console.log(`   - Calificaciones: ${createdData.resumen.totalCalificaciones}`);
    console.log(`   - Chats: ${createdData.resumen.totalChats}`);
    console.log('\n🔐 CREDENCIALES DE ACCESO:');
    console.log(`   Admin: ${createdData.admin.email} / ${createdData.admin.password}`);
    if (createdData.usuarios.directivo) {
      console.log(`   Directivo: ${createdData.usuarios.directivo.email} / ${createdData.usuarios.directivo.password}`);
    }
    createdData.usuarios.profesores.forEach(p => {
      console.log(`   Profesor: ${p.email} / ${p.password}`);
    });
    createdData.usuarios.estudiantes.forEach(e => {
      console.log(`   Estudiante: ${e.email} / ${e.password}`);
    });
    createdData.usuarios.padres.forEach(p => {
      console.log(`   Padre: ${p.email} / ${p.password}`);
    });
  });
});
