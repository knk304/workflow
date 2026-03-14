# 🚀 Local Setup Instructions

Complete step-by-step guide to get the Workflow Platform running on your local machine.

---

## ✅ Step 1: Verify Prerequisites

### Check Node.js Installation
```powershell
node --version
# Should output: v20.x.x or higher
```

If not installed, download from: https://nodejs.org/

### Check npm Installation
```powershell
npm --version
# Should output: 10.x.x or higher
```

---

## 📂 Step 2: Navigate to Frontend Directory

```powershell
cd c:\development\workflow\frontend
```

Verify you see these files:
- `package.json` ✓
- `angular.json` ✓
- `tsconfig.json` ✓
- `src/` folder ✓

---

## 📦 Step 3: Install Dependencies

```powershell
npm install
```

**What this does:**
- Downloads all packages listed in `package.json`
- Installs Angular 19, Material Design, NgRx, Tailwind CSS
- Creates `node_modules/` folder (~500MB)
- Creates `package-lock.json` (locks dependency versions)

**Expected output:**
```
added 1500+ packages in ~3-5 minutes
```

**If you get errors:**
```powershell
# Option 1: Clear cache and retry
npm cache clean --force
npm install

# Option 2: Use legacy peer deps flag
npm install --legacy-peer-deps
```

---

## 🎯 Step 4: Verify Installation

Check that Angular CLI is installed locally:
```powershell
npx ng version
```

**Expected output:**
```
Angular CLI: 19.2.19
Node: 20.x.x
TypeScript: 5.6.3
```

---

## 🚀 Step 5: Start Development Server

```powershell
npm start
```

**This will:**
1. Compile TypeScript → JavaScript
2. Bundle all modules
3. Start a dev server on `http://localhost:4200`
4. Open browser automatically

**First build takes 30-60 seconds.** Subsequent builds are faster.

**Expected output:**
```
✔ Compiled successfully.
// Refresh your browser
Application bundle generation complete. [X.XXX seconds]
Local:   http://localhost:4200/
```

---

## 🌐 Step 6: Access the Application

Once the dev server is running, your browser should open to:
```
http://localhost:4200
```

You should see the **Login Page** with:
- Email input field
- Password input field  
- Demo credentials displayed
- Register link

### Login with Demo Credentials:
```
Email: alice@example.com
Password: password123
Role: MANAGER
```

After login, you'll see the **Dashboard** with:
- Stats cards (Open Cases, Critical Cases, My Tasks, Overdue Tasks)
- Recent cases list
- Recent tasks list

---

## 🗂️ Step 7: Explore Features

Once logged in, navigate to:

### Cases (Left Sidebar)
- **Cases** → See case list with filters
- Click any case ID → View case details with stage progression

### Tasks (Left Sidebar)
- **My Tasks** → View Kanban board
- Drag tasks between columns to update status

### Click Case Details to See:
- **Details Tab:** Case fields and info
- **Tasks Tab:** Related tasks
- **Activity Tab:** Audit trail

---

## 🔧 Step 8: Common Development Tasks

### Stop the Dev Server
Press `Ctrl + C` in terminal

### Restart Dev Server
```powershell
npm start
```

### Rebuild on Port 4300 (if 4200 is busy)
```powershell
ng serve --port 4300
```

### Build for Production
```powershell
npm run build:prod
```
**Output:** `dist/workflow-platform/` folder ready for deployment

---

## 📊 File Structure on Your Computer

After installation, you should have:

```
c:\development\workflow\
├── frontend/
│   ├── node_modules/              (500MB - all dependencies)
│   ├── dist/                      (created after npm run build)
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/              (services, models, guards)
│   │   │   ├── features/          (login, dashboard, cases, tasks)
│   │   │   ├── layout/            (shell/navigation)
│   │   │   ├── state/             (NgRx stores)
│   │   │   ├── app.routes.ts
│   │   │   ├── app.config.ts
│   │   │   └── app.component.ts
│   │   ├── environments/          (dev/prod config)
│   │   ├── main.ts                (bootstrap)
│   │   ├── styles.css             (global styles)
│   │   ├── index.html             (HTML entry point)
│   ├── package.json               (dependencies list)
│   ├── angular.json               (Angular CLI config)
│   ├── tsconfig.json              (TypeScript config)
│   ├── tailwind.config.js         (Tailwind config)
│   ├── .npmrc                     (npm config)
│   ├── .gitignore                 (git ignore rules)
│   └── README.md                  (documentation)
```

---

## 🐛 Troubleshooting

### Issue: "Command not found: ng"
**Solution:** Make sure you're in the `frontend` directory
```powershell
cd c:\development\workflow\frontend
```

### Issue: "Port 4200 already in use"
**Solution:** Use different port
```powershell
ng serve --port 4300
```

### Issue: Node.js version too old
**Solution:** Update Node.js to latest LTS
```powershell
# Download from: https://nodejs.org/
# Then reinstall
npm install
```

### Issue: Slow performance / High memory usage
**Solution:** Increase Node heap size
```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm start
```

### Issue: TypeScript compilation errors
**Solution:** Clear cache and rebuild
```powershell
rm -r .angular
npm install
npm start
```

### Issue: "Module not found" errors
**Solution:** Reinstall dependencies
```powershell
rm -r node_modules package-lock.json
npm install
```

---

## ✨ What's Working

✅ **Authentication**
- Login with email/password
- JWT mock token
- Protected routes

✅ **Case Management**
- List cases with filters
- View case details
- Stage progression (5 stages)
- Status/priority indicators

✅ **Task Management**
- Kanban board (5 columns)
- Drag-drop tasks between columns
- Filter by priority
- Checklist tracking

✅ **Comments**
- Add comments to cases
- @mention team members
- Threaded replies
- Edit/delete own comments

✅ **Notifications**
- Unread notification badge
- Assignment notifications
- Mentions notifications
- SLA warnings

---

## 🎓 Learning Resources

### Angular Documentation
```
https://angular.io/docs
```

### Material Design Components
```
https://material.angular.io
```

### Tailwind CSS
```
https://tailwindcss.com/docs
```

### NgRx State Management
```
https://ngrx.io/docs
```

### Angular CDK (Drag-Drop)
```
https://material.angular.io/cdk/drag-drop/overview
```

---

## 📧 Next Steps

If everything is working:

1. **Explore the UI** - Click around to get familiar with features
2. **Test the filters** - Try different case filters
3. **Try drag-drop** - Drag tasks in Kanban board
4. **Test mock data** - See how different roles affect UI
5. **Check console** - Open DevTools (F12) to see NgRx actions

---

## 🎯 Backend Integration (When Ready)

To connect to a real backend API instead of mock data:

1. Update `environment.ts` with your API URL
2. Replace mock services with HTTP calls
3. Adjust interceptors for authentication
4. Update NgRx effects to call real endpoints

More details in: `IMPLEMENTATION-STRATEGY.md`

---

## ✅ Checklist

- [ ] Node.js v20+ installed
- [ ] `npm install` completed
- [ ] `npm start` runs without errors
- [ ] Browser opens to `http://localhost:4200`
- [ ] Can login with demo credentials
- [ ] Dashboard loads with stats cards
- [ ] Can navigate to Cases and Tasks
- [ ] Drag-drop works on Kanban board

**If all checks pass, you're ready to develop! 🚀**

---

**Questions?** Check the documentation or error messages in the browser console (F12).
