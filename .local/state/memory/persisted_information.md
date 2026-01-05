# Persisted Information - AutoClose AI Project

## ⚠️ CONTEXTO FIJO OBLIGATORIO - Archivos de Referencia Principal

**ESTOS ARCHIVOS DEBEN ESTAR SIEMPRE PRESENTES EN EL CONTEXTO DE CADA PETICIÓN:**

### 📋 PROJECT_GOLAS.md (OBLIGATORIO - Leer siempre)
**PROJECT_GOLAS.md** es el archivo de referencia principal del proyecto y DEBE ser consultado SIEMPRE antes de realizar cualquier cambio. Este archivo contiene:

- La visión completa y arquitectura de AutoClose AI
- Los objetivos principales del proyecto
- La estructura del frontend (React + TypeScript) y backend (Express + MongoDB)
- Los principios de desarrollo fundamentales
- Las integraciones externas requeridas (Google Workspace, OpenAI)
- Los requisitos de entorno y configuración
- La arquitectura de datos y modelos (MongoDB, Mongoose)
- Los roles del sistema: estudiante, profesor, directivo, padre
- La filosofía de IA como centro operativo

**Este archivo define QUÉ es el proyecto y CÓMO debe funcionar técnicamente.**

### 🎨 design_guidelines.md (OBLIGATORIO - Leer siempre)
**design_guidelines.md** contiene las guías de diseño completas del proyecto AutoClose AI y DEBE ser consultado SIEMPRE antes de realizar cualquier cambio visual o de UI. Este archivo incluye:

- Filosofía de diseño y principios centrales (AI-First, moderno, limpio)
- Sistema de colores completo:
  - Purple Core: #9f25b8
  - Purple Deep: #6a0dad
  - Purple Light: #c66bff
- Tipografía: Inter (UI/cuerpo), Poppins (títulos), JetBrains Mono (código)
- Sistema de navegación next-gen: Command Palette, Quick Actions, AI Dock
- Glassmorphism: `bg-white/5 border-white/10 backdrop-blur-md`
- Componentes core, cards, formularios y microinteracciones
- Responsive behavior y accesibilidad
- Integración visual con Google Workspace

**Este archivo define CÓMO debe verse y sentirse el proyecto visualmente.**

## 🔄 Flujo de Trabajo Obligatorio para el AI Assistant

1. **Al recibir cualquier petición:**
   - Leer automáticamente `PROJECT_GOLAS.md` para contexto del proyecto
   - Leer automáticamente `design_guidelines.md` para contexto de diseño

2. **Antes de cualquier cambio:**
   - Verificar alineación con `PROJECT_GOLAS.md`
   - Verificar cumplimiento con `design_guidelines.md`

3. **Al crear nuevos componentes:**
   - Consultar `design_guidelines.md` para estilo visual
   - Consultar `PROJECT_GOLAS.md` para arquitectura

## Recordatorio Crítico

Estos dos archivos (`PROJECT_GOLAS.md` y `design_guidelines.md`) son la fuente de verdad del proyecto AutoClose AI. Deben estar presentes en el contexto de cada petición sin necesidad de que el usuario los especifique explícitamente.


