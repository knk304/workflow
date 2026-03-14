# Workflow Platform - Frontend

Angular 19 application for Case and Task Management with mock data services.

## 📋 Prerequisites

- **Node.js:** v20.x or higher
- **npm:** v10.x or higher
- **Angular CLI:** v19.x

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install all Angular, Material, NgRx, and other dependencies from `package.json`.

### 2. Start Development Server

```bash
npm start
```

Or use:
```bash
ng serve --open
```

The app will open automatically at `http://localhost:4200/`

### 3. Build for Production

```bash
npm run build:prod
```

Output will be in `dist/workflow-platform/`

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── core/              # Services, models, guards, interceptors
│   │   ├── features/          # Feature modules (auth, cases, tasks, etc.)
│   │   ├── layout/            # Shell and layout components
│   │   ├── shared/            # Shared components and utilities
│   │   ├── state/             # NgRx stores (auth, cases, tasks, notifications)
│   │   ├── app.routes.ts      # Application routing
│   │   ├── app.config.ts      # App configuration & NgRx setup
│   │   ├── app.component.ts   # Root component
│   ├── environments/          # Environment configurations
│   ├── main.ts                # Application bootstrap
│   ├── styles.css             # Global styles
│   ├── styles.scss            # Tailwind integration
│   └── index.html             # HTML entry point
├── angular.json               # Angular CLI config
├── tsconfig.json              # TypeScript config
├── tailwind.config.js         # Tailwind CSS config
├── package.json               # Dependencies
└── README.md
```

## 🔑 Key Features

### Authentication
- **Login:** Email/password form with validation
- **Register:** New user registration
- **Mock Auth Service:** JWT simulation for testing
- **Auth Guard:** Protects routes, redirects to login if not authenticated

### Case Management
- **Case List:** Material table with filters, search, and pagination
- **Case Detail:** Full case view with stage progression (5 stages)
- **Stage Visualization:** Track case journey from intake to disbursement

### Task Management
- **Kanban Board:** CDK drag-drop across 5 columns (Pending → Done → Blocked)
- **Task Filters:** By assignee, priority, due date
- **Checklist Tracking:** Progress bars on task cards

### Comments & Collaboration
- **Threaded Comments:** Reply to comments
- **@Mentions:** Autocomplete for team member mentions
- **Real-time Updates:** Add/edit/delete without page refresh

### Notifications
- **Unread Badge:** Shows count of unread notifications
- **Types:** Assignment, mention, SLA warning
- **Mark as Read:** Dismiss notifications

## 🛠️ Development Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start dev server (opens browser) |
| `npm run dev` | Start dev server without auto-open |
| `npm run build` | Build with dev config |
| `npm run build:prod` | Build for production |
| `npm run watch` | Build in watch mode |
| `npm test` | Run unit tests |
| `npm run lint` | Run ESLint |

## 📦 Dependencies

### Core
- **@angular/core:** v19.2.19
- **@angular/material:** v19.2.19 (UI components)
- **@angular/cdk:** v19.2.19 (drag-drop, utilities)

### State Management
- **@ngrx/store:** v18.0.0
- **@ngrx/effects:** v18.0.0
- **@ngrx/store-devtools:** v18.0.0 (development tools)

### Styling
- **tailwindcss:** v3.4.1

### Utilities
- **rxjs:** v7.8.1 (Reactive programming)
- **tslib:** v2.6.2

## 🔌 Connecting to Backend

Currently using mock data services. To connect to a real backend:

1. Replace `MockAuthService` in effects with real HTTP endpoint
2. Replace `MockDataService` with real API calls
3. Update `environment.ts` with your API URL
4. Adjust HTTP interceptors if needed

### Environment Config

**Development** (`environment.ts`):
```typescript
apiUrl: 'http://localhost:3000/api'
production: false
```

**Production** (`environment.prod.ts`):
```typescript
apiUrl: 'https://api.workflow.example.com/api'
production: true
```

## 🧪 Mock Data

Pre-configured mock data includes:
- 3 users (Alice, Bob, Carol, Dave) with different roles
- 2 teams (Lending Operations, Compliance)
- 2 case types (loan_origination, support_ticket) with field schemas
- 3 realistic cases at different stages
- 5 tasks with dependencies and checklists
- 3 comments with @mentions
- 3 notifications

All mock responses simulate network latency (300-500ms delay).

## 🔐 User Credentials (Mock)

Login with these test credentials:

| Email | Password | Role |
|-------|----------|------|
| alice@example.com | password123 | MANAGER |
| bob@example.com | password123 | WORKER |
| carol@example.com | password123 | WORKER |
| dave@example.com | password123 | ADMIN |

## 📝 TypeScript Configuration

Strict mode enabled with:
- No implicit any
- No unused locals/parameters
- No unreach code
- Path aliases for cleaner imports:
  - `@app/*` → `src/app/*`
  - `@core/*` → `src/app/core/*`
  - `@features/*` → `src/app/features/*`
  - `@state/*` → `src/app/state/*`

## 🎯 Common Tasks

### Add a New Component
```bash
ng generate component features/my-feature/my-component --standalone
```

### Add a New Service
```bash
ng generate service core/services/my-service
```

### Generate NgRx Store
```bash
ng generate @ngrx/schematics:action state/my-feature/my-feature
ng generate @ngrx/schematics:effect state/my-feature/my-feature
ng generate @ngrx/schematics:reducer state/my-feature/my-feature
```

## 🐛 Troubleshooting

### Port 4200 Already in Use
```bash
ng serve --port 4300
```

### Module Not Found Errors
```bash
rm -rf node_modules
npm install
```

### TypeScript Compilation Errors
Delete `.angular` cache:
```bash
rm -rf .angular
ng serve
```

### Memory Issues During Build
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

## 📖 Additional Resources

- [Angular Documentation](https://angular.io/docs)
- [Material Design](https://material.angular.io)
- [NgRx Documentation](https://ngrx.io)
- [Tailwind CSS](https://tailwindcss.com)
- [Angular CDK](https://material.angular.io/cdk)

## 📧 Support

For issues or questions, refer to the main project documentation in the root `README-IMPLEMENTATION.md`.
