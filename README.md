# Intranet Next App - Project Documentation

## Project Overview

The **Intranet Next App** is a web application designed for Sheares Hall residents to manage and view their CCA (Co-Curricular Activities) information. The application allows users to:

- View their CCA memberships and associated points
- Rank their Committee CCA preferences  
- Track their total activity points
- Manage user authentication through Google OAuth

## Tech Stack

### Frontend
- **Next.js 15.3.4** - React framework with App Router
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 3.4.1** - Utility-first CSS framework
- **Framer Motion 12.4.10** - Animation library
- **React Hot Toast 2.4.1** - Toast notifications

### Backend & Services
- **Firebase 10.13.2** - Authentication and user management
- **Firebase Admin 12.5.0** - Server-side Firebase operations
- **Supabase** - Primary database for user data and CCA information

### Infrastructure & Deployment
- **AWS CloudFront** - CDN for global content delivery
- **AWS S3** - Static website hosting
- **AWS Route 53** - Custom domain management
- **Terraform** - Infrastructure as Code management
- **GitHub Actions** - CI/CD pipeline automation

### Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **ts-node** - TypeScript execution for scripts

## Project Structure
```
intranet-next-app/ # Root directory
├── .github/ # GitHub configuration
│ └── workflows/ # CI/CD workflow definitions
│ ├── 1-ci-merge-request.yml # Pull request CI workflow
│ ├── 2-preprod-release.yml # Pre-production deployment
│ └── 3-prd-release.yml # Production deployment
├── src/ # Application source code
│ ├── app/ # Next.js App Router pages
│ │ ├── auth/login/ # Authentication pages
│ │ ├── dashboard/ # Main dashboard area
│ │ │ ├── home/ # Dashboard home
│ │ │ ├── mycca/ # User's CCA information
│ │ │ └── rank/ # CCA ranking functionality
│ │ ├── api/ # API routes
│ │ │ ├── auth/getUserByEmail/ # User authentication endpoint
│ │ │ ├── ping/ # Health check endpoint
│ │ │ └── user/ # User-related API endpoints
│ │ │ ├── getCCAs/[email]/ # Fetch user CCA data
│ │ │ └── getPoints/[email]/ # Calculate user points
│ │ ├── globals.css # Global styles
│ │ ├── layout.tsx # Root layout
│ │ └── page.tsx # Home page
│ ├── components/ # Reusable React components
│ │ ├── Sidebar.tsx # Navigation sidebar
│ │ └── withAuth.tsx # Authentication HOC
│ ├── context/ # React context providers
│ │ └── AuthContext.tsx # Authentication state management
│ └── lib/ # Utility libraries and configurations
│ ├── firebase.ts # Firebase client config
│ ├── firebase-admin-config.ts # Firebase admin config
│ ├── supabase.ts # Supabase client config
│ └── interfaces.ts # TypeScript type definitions
├── infra/ # Infrastructure as Code (Terraform)
│ ├── modules/ # Terraform modules (Git submodule)
│ ├── config/ # Environment-specific configurations
│ │ ├── preprod.tfvars # Pre-production variables
│ │ └── prd.tfvars # Production variables
│ ├── main.tf # Main Terraform configuration
│ ├── variables.tf # Variable definitions
│ ├── outputs.tf # Output definitions
│ ├── cloudfront.tf # CloudFront distribution config
│ └── domain.tf # Route53 domain configuration
├── scripts/ # Utility scripts
│ ├── index.ts # User onboarding script
│ ├── users.csv # User data for bulk import
│ └── errors.txt # Script validation errors
├── .env # Environment variables (not committed)
├── .gitignore # Git ignore rules
├── .gitmodules # Git submodule configuration
├── package.json # Dependencies and scripts
├── package-lock.json # Locked dependency versions
├── tsconfig.json # TypeScript configuration
├── tailwind.config.ts # Tailwind CSS configuration
└── postcss.config.mjs # PostCSS configuration
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

### Hybrid Architecture: Firebase + Supabase
The application uses a **dual-database approach**:
- **Firebase**: Handles Google OAuth authentication and session management
- **Supabase**: Stores all user data and CCA information
- **Email Bridge**: User email serves as the connection between both systems

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

### Authenticated user data flow
- Source: `authenticated_user_info` view that joins role flags and CCA appointments.
- Types: `AuthenticatedUser`, `UserAppointment`, and `UserRoleFlags` in `src/types/User.ts` are the single source of truth for user shape across the app.
- Server cache: `src/lib/fetch-user-info.ts` hydrates data (profile photo URL, roles, appointments) and stores a 10-minute TTL cookie (`authenticated_user`) plus a short-lived `user_id` cookie.
- API: `GET /api/user` returns the cached-or-fresh user payload and refreshes the cookie; `DELETE /api/user` clears the cache (used during sign out).
- Client loading: `AuthContext` first reads the cached cookie, falling back to `/api/user` only when stale/missing. Sign-in (`/auth/callback`) refreshes the cache, and sign-out purges both client and server cookies.

**React usage:**
- Wrap pages with `AuthProvider` (`src/app/layout.tsx`) and access user data via `useAuth()`.
- Rely on the `user` object returned by the hook; it already includes role flags and appointments without extra API calls.
- If you need the raw user ID in server routes, call `fetchUserId()` which reuses the same TTL-aware cache.
  
## Infrastructure Overview

### AWS Deployment Architecture
The application uses a modern serverless architecture deployed on AWS:

- **Static Hosting**: Next.js build artifacts hosted on S3
- **Content Delivery**: CloudFront CDN for global performance
- **Custom Domain**: Route 53 for DNS management
- **Automated Deployment**: GitHub Actions with Terraform

### Terraform Configuration
Infrastructure is managed as code using Terraform with modular design:

- **Reusable Modules**: External Terraform modules via Git submodule
- **Environment Separation**: Separate configurations for preprod/production
- **State Management**: Terraform workspaces for environment isolation

> **Note**: Infrastructure configuration details should be updated by the infrastructure team member. The current setup provides the foundation for AWS deployment with CloudFront, S3, and Route 53 integration.

## CI/CD Pipeline

### GitHub Actions Workflows

#### 1. **Merge Request CI** (`1-ci-merge-request.yml`)
- **Trigger**: Pull requests to main branch
- **Purpose**: Validate code changes before merge
- **Steps**: Dependency installation, type checking, build verification
- **Environment Variables**: All required secrets for build process

#### 2. **Pre-production Release** (`2-preprod-release.yml`)
- **Trigger**: Release candidate tags (`v*.*.*-rc`)
- **Purpose**: Deploy to staging environment
- **Steps**: Build → Deploy Infrastructure → Deploy to S3 → Promote to production tag

#### 3. **Production Release** (`3-prd-release.yml`)
- **Trigger**: Production tags (`v*.*.*`)
- **Purpose**: Deploy to production environment
- **Steps**: Build → Deploy Infrastructure → Deploy to S3

### Required GitHub Secrets
```
# Firebase Configuration
FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY
FIREBASE_CLIENT_EMAIL
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

# AWS Configuration
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
```

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

### Dashboard (`src/app/dashboard/page.tsx`)
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

### Local Development (`.env`)
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
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=
```

### Production (GitHub Repository Secrets)
All environment variables must be configured as GitHub Repository Secrets for CI/CD pipeline functionality.

## Getting Started

### Prerequisites
1. **Node.js** (version compatible with Next.js 15)
2. **Firebase project** with Google OAuth provider enabled
3. **Supabase project** with required tables set up
4. **AWS account** with appropriate permissions for infrastructure deployment
5. **Environment variables** configured locally and in GitHub

### Development Setup
```
# Clone the repository
git clone https://github.com/ShearesWeb/intranet-next-app.git
cd intranet-next-app

# Install dependencies
npm install

# Set up environment variables
Create .env file with required values (see Environment Variables section)
Initialize Terraform submodule (if needed)
git submodule update --init --recursive

# Run development server
npm run dev

# Build for production (optional)
npm run build
```

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

### Initial Configuration
1. **Configure Firebase** with Google OAuth provider
2. **Set up Supabase tables** (`Users`, `user_cca_roles`)
3. **Configure AWS credentials** for infrastructure deployment
4. **Set up GitHub repository secrets** for CI/CD pipeline
5. **Run user import script** if needed for initial data
6. **Verify authentication flow** works correctly

## Deployment Process

### Automated Deployment via GitHub Actions
1. **Development**: Push changes to feature branches
2. **Testing**: Create pull request → CI workflow validates changes
3. **Staging**: Create release candidate tag → Deploys to pre-production
4. **Production**: Create production tag → Deploys to production environment

### Manual Infrastructure Updates
For infrastructure changes, coordinate with the infrastructure team member who manages the Terraform configurations and AWS resources.

## Notable Implementation Details

### Project Structure Benefits
- **Clean root-level organization** - No nested folder confusion
- **Standard Next.js layout** - Follows framework best practices
- **Modular infrastructure** - Separated concerns for maintainability
- **Comprehensive CI/CD** - Automated testing and deployment

### Error Handling
- **Comprehensive error catching** in API routes
- **User-friendly error messages** via toast notifications
- **Build-time error detection** in CI pipeline
- **Environment variable validation** in workflows

### Performance Considerations
- **Client-side routing** with Next.js App Router
- **Optimized images** with Next.js Image component
- **CDN distribution** via CloudFront
- **Static generation** for improved performance

### Security Features
- **Protected API routes** with Firebase Admin authentication
- **Environment variable encryption** via GitHub Secrets
- **Row-level security** available in Supabase
- **HTTPS enforcement** via CloudFront
- **Email validation** for user registration

This documentation reflects the current integrated state of the application with clean project structure, automated CI/CD pipeline, and AWS infrastructure foundation ready for production deployment.
