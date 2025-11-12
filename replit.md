# AutoClose AI - Educational Platform

## Overview

AutoClose AI is a comprehensive educational platform designed for institutional use in Colombian schools. It serves as an AI-powered learning management system that provides role-based dashboards and intelligent chat assistance for students, teachers, administrators, and parents. The platform features a modern glassmorphism design with a distinctive purple brand identity (#9f25b8) from Bridgent AI.

The application enables:
- Multi-role authentication and personalized dashboards
- AI-powered educational chat assistance using OpenAI GPT-5
- Course and material management
- Real-time student-teacher-parent communication
- Institution-specific customization and branding

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query v5 for server state management
- **UI Component Library**: Radix UI primitives with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom purple theme configuration
- **Type Safety**: Full TypeScript coverage across client, server, and shared code

**Design System**:
- Glassmorphism aesthetic with backdrop blur effects
- Purple gradient theme (#9f25b8 to #6a0dad)
- Dark mode background gradients
- Typography: Inter for body text, Poppins for headings, JetBrains Mono for code
- Responsive design with mobile-first approach

**Component Structure**:
- Route guards (AuthGuard/GuestGuard) for protected routes
- Collapsible sidebar navigation with role-based menu items
  - Students: "Mis Materias" (subject-first view) + "Calendario"
  - Teachers: "Cursos" (class-group management)
  - Subject selector in assignment creation form for multi-subject teachers
- Reusable UI components from shadcn/ui
- Context-based authentication management

**Key Pages**:
- `/subjects` - Student view of all subjects in their class group
- `/subject/:id` - Subject detail with teacher info and categorized assignments (pending/past)
- `/calendar` - Student calendar filtered by enrolled course
- `/courses` - Teacher management of class groups
- `/course/:cursoId` - Teacher assignment creation and calendar for a specific group

### Backend Architecture

**Framework**: Express.js with TypeScript (ESM modules)
- **Runtime**: Node.js with tsx for development
- **API Style**: RESTful endpoints organized by feature domains
- **Session Management**: JWT-based authentication with bcrypt password hashing
- **Middleware**: CORS enabled, JSON body parsing, custom logging middleware

**API Route Organization**:
- `/api/auth` - User registration and login
- `/api/chat` - AI chat sessions and messaging
- `/api/courses` - Course CRUD operations
  - `GET /api/courses/for-group/:grupo` - Get teacher's subjects for a specific class group
- `/api/subjects` - Student subject overview (added November 2025)
  - `GET /api/subjects/mine` - Get all subjects taught to student's class group
  - `GET /api/subjects/:id/overview` - Get subject details with pending/past assignments
- `/api/assignments` - Assignment management
- `/api/materials` - Educational material management
- `/api/health` - Service health checks

**Authentication Flow**:
- JWT tokens stored in localStorage on client
- Bearer token authentication on protected routes
- Role-based access control (estudiante, profesor, directivo, padre)
- Password hashing with bcryptjs (10 salt rounds)
- 30-day token expiration

### Data Storage

**Database**: MongoDB via Mongoose ODM
- **Connection**: MongoDB Atlas with connection string from environment variables
- **Connection Handling**: Graceful degradation if MongoDB unavailable (app still starts)
- **Schema Models**: TypeScript interfaces with Mongoose schemas

**Data Models**:
1. **User**: Authentication, roles, course assignments, institution linkage
   - **Teacher-specific field**: `materias` (array of strings) - subjects the teacher teaches
2. **Course**: Subject information (e.g., "Matemáticas"), teacher assignment, multiple student groups
3. **Assignment**: Tasks with **required** courseId reference to link to specific subjects
4. **Material**: Educational resources (PDFs, videos, links, documents)
5. **ChatSession**: Conversation history with context tracking
6. **InstitutionConfig**: School-specific branding and curriculum settings

**Schema Design Decisions**:
- Multi-tenancy via `colegioId` field on all documents
- Role-based data access (student/teacher/admin/parent views)
- Embedded chat message arrays for performance
- Reference-based relationships between users and courses
- Pre-save hooks for password hashing and timestamp updates
- **Teacher Subject Management** (added November 2025):
  - Teachers specify one or more subjects during registration via `materias` array
  - Backend validates, normalizes (capitalize), and deduplicates subjects (max 10, min 1)
  - Registration UI uses chip-based input for subject entry/removal
  - Account page displays teacher's subjects as badges
- **Assignment-Course Linking & Security** (added November 2025):
  - Assignments **require** courseId field referencing Course (no longer optional)
  - Backend validates both courseId ownership AND curso membership before creating assignment
  - Server checks: (1) Course exists, (2) course.profesorId === requesting user, (3) curso ∈ course.cursos
  - Prevents spoofed assignments where teacher uses valid courseId but arbitrary grupo
  - **Auto-selection UX**: If teacher teaches only ONE subject to a group, courseId auto-selected; if MULTIPLE, dropdown selector shown
  - Frontend disables submit when teacher has no subjects for target group

**Database Configuration** (Drizzle setup present but MongoDB is primary):
- Drizzle Kit configured for PostgreSQL migrations (fallback option)
- Schema definitions in shared/schema.ts support both systems
- Current implementation uses Mongoose for MongoDB

### External Dependencies

**AI Services**:
- **OpenAI API** (GPT-5 model as of August 2025)
  - Purpose: Educational chat assistance with role-specific prompts
  - Context-aware responses based on user role and curriculum
  - Colombian Spanish language support
  - API key required via OPENAI_API_KEY environment variable

**Database**:
- **MongoDB Atlas**
  - Connection via MONGO_URI environment variable
  - Required format: `mongodb+srv://username:password@cluster/database`
  - Graceful degradation if connection fails

**Authentication**:
- **JWT Secret** (JWT_SECRET environment variable)
  - Required for token signing and verification
  - Application fails to start if not configured

**Third-Party UI Libraries**:
- **Radix UI**: Accessible component primitives (v1.x)
- **TanStack Query**: Server state synchronization (v5.60)
- **Tailwind CSS**: Utility-first styling (v3.x)
- **Wouter**: Minimal routing library
- **date-fns**: Date formatting and manipulation
- **clsx/tailwind-merge**: Conditional class name handling

**Development Tools**:
- **Replit Plugins**: Cartographer, dev banner, runtime error overlay
- **Vite Plugins**: React, custom Replit development tooling
- **TypeScript**: Strict mode with ESNext target
- **ESBuild**: Server-side bundling for production

**WebSocket Support**:
- Neon Database serverless with WebSocket constructor (ws library)
- Used for PostgreSQL fallback if needed

**Environment Requirements**:
1. `MONGO_URI` - MongoDB connection string (required for full functionality)
2. `JWT_SECRET` - Secret key for JWT signing (required)
3. `OPENAI_API_KEY` - OpenAI API access (required for chat features)
4. `DATABASE_URL` - PostgreSQL URL (optional, Drizzle fallback)