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
- Reusable UI components from shadcn/ui
- Context-based authentication management

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
2. **Course**: Subject information, teacher assignment, student groups
3. **Material**: Educational resources (PDFs, videos, links, documents)
4. **ChatSession**: Conversation history with context tracking
5. **InstitutionConfig**: School-specific branding and curriculum settings

**Schema Design Decisions**:
- Multi-tenancy via `colegioId` field on all documents
- Role-based data access (student/teacher/admin/parent views)
- Embedded chat message arrays for performance
- Reference-based relationships between users and courses
- Pre-save hooks for password hashing and timestamp updates

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