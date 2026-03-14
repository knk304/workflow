# 🚀 Quick Reference - Get Started in 5 Minutes

## The 4 Essential Commands

```powershell
# 1. Navigate to frontend folder
cd c:\development\workflow\frontend

# 2. Install all dependencies (one-time, takes 3-5 minutes)
npm install

# 3. Start development server (every time you want to work)
npm start

# 4. Open browser at http://localhost:4200 and login
```

## Demo Login Credentials

Use any of these to login and explore:

```
┌─────────────────────────────────────────────────────┐
│ Email: alice@example.com    │ Role: MANAGER        │
│ Password: password123       │                      │
├─────────────────────────────────────────────────────┤
│ Email: bob@example.com      │ Role: WORKER         │
│ Password: password123       │                      │
├─────────────────────────────────────────────────────┤
│ Email: carol@example.com    │ Role: WORKER         │
│ Password: password123       │                      │
├─────────────────────────────────────────────────────┤
│ Email: dave@example.com     │ Role: ADMIN          │
│ Password: password123       │                      │
└─────────────────────────────────────────────────────┘
```

Try alice@example.com as a manager to see admin menu!

## File Structure

```
frontend/
├── package.json          ← List of all dependencies
├── angular.json          ← Angular CLI configuration
├── tsconfig.json         ← TypeScript configuration
├── tailwind.config.js    ← Tailwind CSS configuration
├── src/
│   ├── app/              ← All Angular source code
│   │   ├── core/         ← Services, guards, models
│   │   ├── features/     ← Pages (login, cases, tasks, etc.)
│   │   ├── state/        ← NgRx store management
│   │   ├── app.routes.ts ← Route definitions
│   │   └── app.config.ts ← App setup & NgRx
│   ├── main.ts           ← App bootstrap
│   ├── index.html        ← HTML entry point
│   └── styles.css        ← Global styles
├── node_modules/         ← Dependencies (auto-created, 500MB)
└── README.md             ← Full documentation
```

## What You Can Do

### ✅ Immediately (Works Now)
- Login with demo credentials
- View dashboard with stats
- View case list with filters
- View case details with stage progression
- Use Kanban board with drag-drop
- Add comments with @mentions
- View notifications

### ⚠️ Later (Needs Backend)
- Save case changes
- Create new cases
- Persist task updates
- Store comments permanently
- Real authentication

## Useful Commands

```powershell
# Start dev server (opens browser auto)
npm start

# Start dev server on different port
ng serve --port 4300

# Build for production
npm run build:prod

# Stop the server
Ctrl + C

# Clear cache and reinstall
rm -r node_modules; npm install

# Run tests
npm test
```

## Features Overview

### 📋 Dashboard
- Stats cards (Open Cases, Critical, My Tasks, Overdue)
- Recent items list
- Quick navigation

### 📁 Cases
- **List:** Filter by status, stage, priority
- **Detail:** View with 5-stage progression
- **Timeline:** See case history
- **Tasks:** View related tasks

### ✅ Tasks
- **Kanban:** 5 columns (Pending → In Progress → Review → Done → Blocked)
- **Drag-Drop:** Move tasks between columns
- **Filters:** By priority or assignment

### 💬 Comments
- Add comments
- @mention team members
- Reply with threading
- Edit/delete own

### 🔔 Notifications
- Unread count badge
- Assignment notifications
- Mentions
- SLA warnings

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Shift + I` | Open DevTools |
| `F12` | Open DevTools |
| `Ctrl + C` | Stop dev server |
| `Ctrl + K` | In search/filter |

## Browser DevTools

Press `F12` to open DevTools and check:

1. **Console Tab:** See errors/logs
2. **Network Tab:** See API calls (mock currently)
3. **Application Tab:** See local storage
4. **Redux DevTools:** See NgRx state (if enabled)

## Troubleshooting Quick Fixes

```powershell
# Port already in use?
ng serve --port 4300

# Dependencies issue?
npm install

# Cache issues?
rm -r .angular
npm start

# Node version wrong?
node --version    # Should be v20+

# Clear everything and start fresh?
rm -r node_modules package-lock.json
npm install
npm start
```

## What's Inside package.json

The `package.json` defines:

**Core Libraries:**
- `@angular/core` - Angular framework
- `@angular/material` - UI components
- `@angular/cdk` - Utilities (drag-drop, etc.)
- `@ngrx/store` - State management

**Dev Tools:**
- `typescript` - Type-checking
- `tailwindcss` - Styling utilities

**Run:** `npm install` to download all these

## Environment Variables

Located in `src/environments/`:

**Development** (`environment.ts`):
```typescript
apiUrl: 'http://localhost:3000/api'
production: false
```

**Production** (`environment.prod.ts`):
```typescript
apiUrl: 'https://api.example.com/api'
production: true
```

Change API URLs here when connecting to backend.

## File Locations for Quick Reference

| What | Location |
|------|----------|
| Login Page | `src/app/features/auth/login.component.ts` |
| Dashboard | `src/app/features/dashboard/dashboard.component.ts` |
| Case List | `src/app/features/cases/case-list.component.ts` |
| Case Detail | `src/app/features/cases/case-detail.component.ts` |
| Kanban | `src/app/features/tasks/task-kanban.component.ts` |
| Comments | `src/app/features/comments/comments.component.ts` |
| Mock Data | `src/app/core/services/mock-data.service.ts` |
| Routes | `src/app/app.routes.ts` |
| NgRx Stores | `src/app/state/[auth/cases/tasks/notifications]/` |

## First-Time Setup Checklist

```
☐ 1. Open PowerShell
☐ 2. Navigate: cd c:\development\workflow\frontend
☐ 3. Install: npm install
☐ 4. Start: npm start
☐ 5. Login: alice@example.com / password123
☐ 6. Explore dashboard, cases, tasks, comments
☐ 7. Try filters and drag-drop
☐ 8. Open DevTools (F12) to see state
```

## Need Help?

1. **Check error in console:** F12 → Console tab
2. **Check DevTools:** See NgRx actions and state
3. **Try clearing cache:** `rm -r .angular`
4. **Reinstall packages:** `rm -r node_modules; npm install`
5. **Read full docs:** `frontend/README.md`

---

**Ready?** Run `npm start` now! 🚀
