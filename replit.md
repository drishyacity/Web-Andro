# replit.md

## Overview

This is a full-stack web application for converting websites and web files into Android APK/AAB packages. The application allows users to input either a website URL or upload web files, configure app settings, handle code signing, and build Android packages. Built with React/TypeScript frontend, Express.js backend, and PostgreSQL database using Drizzle ORM. 

**Recent Update**: Migrated from Replit Agent to Replit environment with enhanced security and robustness. Implemented professional Android builder with proper APK/AAB generation, keystore management, and code signing. The system now generates real, installable APK files with proper structure, metadata, and signing capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and production builds
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing
- **UI Components**: Radix UI primitives with custom styling

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Style**: RESTful API endpoints
- **File Upload**: Multer middleware for handling file uploads
- **Development**: Hot reloading with Vite integration

### Database Architecture
- **Database**: PostgreSQL (configured for Neon Database)
- **ORM**: Drizzle ORM for type-safe database operations
- **Migrations**: Drizzle Kit for schema management
- **Schema Location**: Shared between frontend and backend in `/shared/schema.ts`

## Key Components

### Database Schema
The application uses the following main entities:
- **Users**: Basic user authentication (username/password)
- **Projects**: Main project entity containing app configuration
- **Builds**: Build history and status tracking
- **Project Files**: File management for uploaded web assets
- **Signing Configs**: Android code signing configuration
- **Build Stats**: Analytics and statistics tracking

### API Endpoints
- **Projects**: CRUD operations for project management
- **Builds**: Build creation, status tracking, and file downloads
- **Files**: File upload and management
- **Signing**: Code signing configuration management

### Frontend Pages
- **Home**: Input source selection (URL or file upload)
- **App Config**: Application settings and metadata configuration
- **Signing & Build**: Code signing setup and build initiation
- **Download**: Build status and APK/AAB download

### UI Components
- **Progress Steps**: Multi-step wizard navigation
- **File Upload**: Drag-and-drop file upload interface
- **Project Preview**: Website/file preview functionality
- **Sidebar**: Project management and statistics
- **Modals**: Error handling and loading states

## Data Flow

1. **Project Creation**: User selects input method (URL/files) and creates project
2. **Configuration**: User configures app metadata (name, package, icons, etc.)
3. **Signing Setup**: User provides Android keystore configuration
4. **Build Process**: System processes files and generates APK/AAB
5. **Download**: User downloads completed build artifacts

## External Dependencies

### Frontend Dependencies
- **UI Framework**: React, Radix UI components
- **Data Fetching**: TanStack Query for API communication
- **Form Handling**: React Hook Form with Zod validation
- **File Handling**: Native HTML5 file APIs
- **Icons**: Lucide React icon library

### Backend Dependencies
- **Database**: Neon Database (PostgreSQL)
- **File Processing**: Multer for file uploads
- **Session Management**: express-session with PostgreSQL store
- **Build Tools**: Template-based Android build system with real APK/AAB generation
- **Archive Tools**: Archiver for creating proper ZIP-based APK files with correct structure

### Development Tools
- **TypeScript**: Full-stack type safety
- **Vite**: Frontend build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **ESBuild**: Backend bundling for production

## Deployment Strategy

### Development
- **Frontend**: Vite dev server with HMR
- **Backend**: tsx for TypeScript execution with auto-restart
- **Database**: Drizzle push for schema updates

### Production
- **Frontend**: Static build served by Express
- **Backend**: Bundled with ESBuild, runs on Node.js
- **Database**: PostgreSQL with connection pooling
- **File Storage**: Local filesystem (uploads directory)

### Build Process
1. Frontend builds to `dist/public`
2. Backend bundles to `dist/index.js`
3. Shared schema ensures type consistency
4. Database migrations run automatically

The application is designed for easy deployment on platforms like Replit, with automatic environment detection and appropriate configuration for development vs production modes.