AutoClose AI – Project Vision & Architecture Guide (Updated)
1. Overview
AutoClose AI es una plataforma educativa institucional diseñada para colegios en Colombia. No es solo un sistema de registro académico: es un sistema de gestión académica accionable, donde la IA es el centro operativo que conecta tareas, automatiza procesos y permite que cada rol (estudiante, profesor, directivo, padre) actúe de forma más eficiente.

El usuario puede:

realizar acciones manualmente navegando por la plataforma

o simplemente pedirle al asistente IA que lo haga por él

La plataforma combina:

gestión académica tradicional

automatización inteligente

integración profunda con Google Workspace

diseño moderno, limpio y altamente usable

2. Core Vision
✅ La IA como centro operativo
La IA no es un “extra”, sino el núcleo del sistema:

interpreta objetivos del usuario según su rol

ejecuta acciones automatizadas

conecta tareas entre módulos

reduce pasos manuales

guía al usuario en procesos complejos

Ejemplos:

“Crea una tarea para 7B mañana y notifícale a los estudiantes”

“Muéstrame mis materias pendientes esta semana”

“Genera un documento en Drive con el resumen del curso”

3. Main Objectives
✅ 1. Centralizar Google Workspace
Integración completa mediante APIs:

Drive

Docs

Sheets

Calendar

Classroom (si aplica)

Gmail

Todo accesible desde AutoClose AI, sin cambiar de plataforma.

✅ 2. Automatización total con IA
La IA debe poder:

crear tareas

generar documentos

programar eventos

enviar notificaciones

organizar materiales

preparar resúmenes

gestionar flujos académicos

Todo basado en instrucciones naturales.

✅ 3. Gestión académica completa
Incluye:

cursos

materias

tareas

materiales

calendarios

comunicación

roles y permisos

Pero siempre con la IA como puente entre módulos.

✅ 4. Identidad visual moderna
limpia

minimalista

user‑friendly

glassmorphism

paleta púrpura (#9f25b8)

diseño que supera las plataformas tradicionales

4. Frontend Architecture
Tecnologías
React 18 + TypeScript

Vite

Wouter

React Query v5

Radix UI + shadcn/ui

Tailwind CSS

Diseño
moderno

limpio

accesible

mobile‑first

glassmorphism

tipografías Inter, Poppins, JetBrains Mono

Estructura de componentes
⚠️ No se define aún una estructura fija (como sidebar) Porque el objetivo es superar las plataformas actuales y crear una navegación más inteligente, posiblemente:

centrada en IA

basada en acciones

basada en objetivos

adaptable por rol

Cursor debe entender que la estructura está en exploración.

Páginas clave actuales
/subjects

/subject/:id

/calendar

/teacher-calendar

/assignment/:id

/courses

/course/:cursoId

/directivo

5. Backend Architecture
Tecnologías
Express.js + TypeScript

Node.js + tsx

JWT

bcryptjs

CORS

Logging middleware

Rutas principales
/api/auth

/api/chat

/api/users

/api/courses

/api/subjects

/api/assignments

/api/materials

/api/health

Flujo de autenticación
JWT en localStorage

Roles: estudiante, profesor, directivo, padre

Validaciones estrictas por rol

6. Data Storage
Base de datos principal
MongoDB (Mongoose)

Modelos
User

Course

Assignment

Material

ChatSession

InstitutionConfig

Decisiones clave
multi‑tenancy por colegioId

validaciones estrictas de ownership

courseId obligatorio en tareas

seguridad reforzada en creación/edición

7. External Integrations
✅ Google Workspace (centralización total)
Drive

Docs

Sheets

Calendar

Gmail

Classroom (opcional)

✅ OpenAI GPT‑5
asistente educativo

automatización de tareas

generación de contenido

soporte contextual por rol

8. Environment Requirements
Code
MONGO_URI
JWT_SECRET
OPENAI_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN

9. Development Principles
✅ La IA es el centro del sistema
No es un módulo aparte.

✅ Todo debe poder hacerse manual o por IA
Dualidad completa.

✅ Navegación flexible
No se fija sidebar ni estructura rígida.

✅ Tipado estricto
Nada de any.

✅ Seguridad por rol
Validaciones obligatorias.

✅ Integración profunda con Google Workspace
No duplicar funciones que ya existen en Google; se centralizan.

✅ Diseño moderno y limpio
Nada de estructuras viejas tipo Moodle/Canvas.

10. Summary
Este documento define la visión actualizada de AutoClose AI:

IA como núcleo

automatización total

centralización de Google Workspace

diseño moderno

arquitectura clara

roles bien definidos

navegación flexible

gestión académica completa

Es la referencia principal para mantener el proyecto alineado con su propósito.