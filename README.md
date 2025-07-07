# Intranet Next App - Project Documentation

## Project Overview

The **Intranet Next App** is a web application designed for Sheares Hall residents to manage and view their CCA (Co-Curricular Activities) information. The application allows users to:

- View their CCA memberships and associated points
- Rank their Committee CCA preferences  
- Track their total activity points
- Manage user authentication through Google OAuth

## Tech Stack

### Frontend
- **Next.js 15.1.2** - React framework with App Router
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 3.4.1** - Utility-first CSS framework
- **Framer Motion 12.4.10** - Animation library
- **React Hot Toast 2.4.1** - Toast notifications

### Backend & Services
- **Firebase 10.13.2** - Authentication and user management
- **Firebase Admin 12.5.0** - Server-side Firebase operations
- **Supabase** - Primary database for user data and CCA information

### Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **ts-node** - TypeScript execution for scripts

## Project Structure
```
intranet-next-app/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── auth/login/         # Authentication pages
│   │   ├── dashboard/          # Main dashboard area
│   │   │   ├── home/           # Dashboard home
│   │   │   └── mycca/          # User's CCA information
│   │   ├── api/                # API routes
│   │   │   ├── ping/           # Health check endpoint
│   │   │   └── user/           # User-related API endpoints
│   │   ├── globals.css         # Global styles
│   │   └── layout.tsx          # Root layout
│   ├── components/             # Reusable React components
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   └── withAuth.tsx        # Authentication HOC
│   ├── context/                # React context providers
│   │   └── AuthContext.tsx     # Authentication state management
│   └── lib/                    # Utility libraries and configurations
│       ├── firebase.ts         # Firebase client config
│       ├── firebase-admin-config.ts  # Firebase admin config
│       ├── supabase.ts         # Supabase client config
│       └── interfaces.ts       # TypeScript type definitions
├── scripts/                    # Utility scripts
│   ├── index.ts               # User onboarding script
│   ├── users.csv              # User data for bulk import
│   └── errors.txt             # Script validation errors
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── tailwind.config.ts         # Tailwind CSS configuration
└── postcss.config.mjs         # PostCSS configuration
```

## Key Features

### 1. **Authentication System**
- **Google OAuth integration** through Firebase Auth
- **Protected routes** using HOC pattern
- **User session management** with React Context
- **Automatic redirects** for unauthenticated users

### 2. **CCA Management**
- **View personal CCAs** with roles and points
- **Points calculation** and display
- **Real-time data fetching** from Supabase
- **Responsive dashboard** with animated elements

### 3. **User Management**
- **Bulk user import** via CSV processing
- **Email validation** (Gmail accounts only)
- **User role management** (admin/regular users)
- **Room assignment tracking**

## Authentication Flow

### Components
1. **AuthContext** (`src/context/AuthContext.tsx`)
   - Manages global authentication state
   - Listens to Firebase auth state changes
   - Provides user object and loading states

2. **withAuth HOC** (`src/components/withAuth.tsx`)
   - Protects routes requiring authentication
   - Redirects unauthorized users to login
   - Shows loading states during auth checks

3. **Login Page** (`src/app/auth/login/page.tsx`)
   - Google OAuth sign-in implementation
   - Error handling and user feedback
   - Automatic redirect after successful login

## Database Schema

### Supabase Tables

#### Users Table
```
interface DBUser {
  id: string;
  created_at: string;
  name: string;
  email: string;
  room: string;
  is_admin: boolean;
}
```

#### User CCA Roles Table (`user_cca_roles`)
- Stores user CCA memberships
- Fields: `email`, `name` (CCA name), `role`, `points`
- Used for points calculation and CCA display

## API Endpoints

### User Management
- **POST** `/api/user/auth` - User authentication verification
- **GET** `/api/user/getCCAs/[email]` - Fetch user's CCA data
- **GET** `/api/user/getPoints/[email]` - Calculate user's total points

### Health Check
- **GET** `/api/ping` - Application health check endpoint

## Scripts and Utilities

### User Onboarding Script (`scripts/index.ts`)

**Purpose**: Bulk import users from CSV file into both Firebase and Supabase

**Key Features**:
- **Email validation** (Gmail accounts only using regex pattern)
- **Dual database insertion** (Firebase Auth + Supabase Users table)
- **Error handling** with detailed logging
- **CSV parsing** with validation feedback

**Usage**:
```
npm run run-script
```

**Validation Rules**:
- Email must match pattern: `/^[a-z0-9](\.?[a-z0-9]){5,}@g(oogle)?mail\.com$/`
- All required fields must be present
- Invalid entries logged to `errors.txt`

## Key Components Analysis

### Dashboard (`src/app/dashboard/home/page.tsx`)
- **Animated points display** with expanding circles
- **Counter animation** using Framer Motion
- **CCA navigation buttons** with hover effects
- **Responsive design** for mobile and desktop

### Sidebar (`src/components/Sidebar.tsx`)
- Navigation component for authenticated users
- **Consistent styling** across pages
- **Link integration** with Next.js routing

### MyCCA Page (`src/app/dashboard/mycca/page.tsx`)
- **Table display** of user's CCA information
- **Real-time data fetching** with error handling
- **Points calculation** and total display
- **Toast notifications** for user feedback

## Configuration Files

### Firebase Configuration
- **Client config** in `src/lib/firebase.ts`
- **Admin config** in `src/lib/firebase-admin-config.ts`
- **Environment variables** for API keys and secrets

### Supabase Configuration
- **Client setup** in `src/lib/supabase.ts`
- **Service role key** for script operations
- **Database URL** configuration

### Styling Configuration
- **Tailwind CSS** for utility-first styling
- **Global CSS** with CSS custom properties
- **Component-specific CSS** for complex layouts

## Environment Variables Required
```
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin Configuration
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=
```

## Getting Started

### Prerequisites
1. **Node.js** (version compatible with Next.js 15)
2. **Firebase project** with Authentication enabled
3. **Supabase project** with required tables set up
4. **Environment variables** configured

### Installation
```
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Initial Setup
1. **Configure Firebase** with Google OAuth provider
2. **Set up Supabase tables** (`Users`, `user_cca_roles`)
3. **Run user import script** if needed
4. **Verify authentication flow** works correctly

## Notable Implementation Details

### Error Handling
- **Comprehensive error catching** in API routes
- **User-friendly error messages** via toast notifications
- **Logging** for debugging and monitoring

### Performance Considerations
- **Client-side routing** with Next.js App Router
- **Optimized images** with Next.js Image component
- **Lazy loading** and code splitting

### Security Features
- **Protected API routes** with authentication checks
- **Email validation** for user registration
- **Firebase security rules** (not shown in files)