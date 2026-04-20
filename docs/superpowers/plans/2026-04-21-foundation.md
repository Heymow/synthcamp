# SynthCamp Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `base.txt` (500-line single-file HTML mockup) into a maintainable Next.js 15 project, deployed on Railway, reproducing the mockup UI with mobile-first + a11y corrections, backend scaffolded but inactive.

**Architecture:** Single Next.js 15 App Router app, `'use client'` by default (no real data fetching in Foundation). URL-based routing replaces the mockup's `useState` mode/tab. Radix primitives + Tailwind v4 custom styling. React Three Fiber for the 3D background. Mock data in `lib/mock-data.ts`. Supabase and R2 clients present as stubs, not connected.

**Tech Stack:** Next.js 15 · TypeScript strict · pnpm · Tailwind CSS v4 · Radix UI · Lucide React · @react-three/fiber + drei · next/font local · Vitest + Testing Library · ESLint + Prettier · Railway deploy.

**Spec reference:** `docs/superpowers/specs/2026-04-21-foundation-design.md`

**Important note on TDD:** The spec explicitly excludes written tests in Foundation (infra prepared for phase 2+). Tasks use a **build-and-verify** discipline instead: each task ends with a build/lint/dev check and a commit. TDD returns in phase 2 when feature logic begins.

---

## Milestone 0 — Prerequisites (git + GitHub + Railway)

### Task 0.1: Initialize git repository

**Files:**
- Create: `C:\Projets\SynthCamp-marketplace\.gitignore`

- [ ] **Step 1: Initialize git**

Run from `C:\Projets\SynthCamp-marketplace\`:

```bash
git init
git branch -M main
```

- [ ] **Step 2: Create .gitignore**

Content of `.gitignore`:

```gitignore
# Dependencies
node_modules
.pnpm-store

# Next.js
.next
out
next-env.d.ts

# Environment
.env
.env.local
.env*.local

# Build artifacts
build
dist

# OS
.DS_Store
Thumbs.db

# IDE
.vscode
.idea
*.swp

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Test artifacts
coverage
.vitest-cache

# Misc
*.tsbuildinfo
.turbo
```

- [ ] **Step 3: First commit**

```bash
git add base.txt .gitignore docs/
git commit -m "chore: initial repo with mockup base.txt and design docs"
```

Expected: commit created on `main`.

### Task 0.2: Create GitHub repo and push

- [ ] **Step 1: Create GitHub repo**

Manually via GitHub UI or `gh` CLI :

```bash
gh repo create synthcamp --private --source=. --remote=origin --push
```

If `gh` not available, create the repo at github.com/new (name: `synthcamp`, private), then:

```bash
git remote add origin https://github.com/<username>/synthcamp.git
git push -u origin main
```

- [ ] **Step 2: Verify**

Check the repo exists on GitHub and shows the initial commit.

### Task 0.3: Create Railway project connected to GitHub

- [ ] **Step 1: Create Railway project**

Via Railway UI (railway.app) :
1. New Project → Deploy from GitHub repo → select `synthcamp`
2. Let Railway fail the first build (package.json doesn't exist yet) — this is expected.

- [ ] **Step 2: Verify integration**

- GitHub integration active on the Railway project
- Railway will re-deploy on each push to `main`
- PR preview deploys will be created automatically

No commit needed for this step.

---

## Milestone 1 — Next.js bootstrap

### Task 1.1: Create Next.js app

**Files:**
- Create: entire `package.json`, `tsconfig.json`, `next.config.ts`, `app/`, etc.

- [ ] **Step 1: Run create-next-app**

From `C:\Projets\SynthCamp-marketplace\`:

```bash
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --no-turbopack --use-pnpm
```

When prompted about overwriting, confirm. When prompted for merging into non-empty dir, accept.

- [ ] **Step 2: Verify Next version is 15+**

Run: `pnpm list next`
Expected: `next 15.x.x` or higher. If < 15, run `pnpm add next@latest react@latest react-dom@latest`.

- [ ] **Step 3: Verify Node 22**

Run: `node --version`
Expected: `v22.x.x`. If not, install Node 22 LTS first.

- [ ] **Step 4: Test dev server runs**

Run: `pnpm dev`
Expected: server starts at `http://localhost:3000`, default Next.js welcome page renders. Stop server with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: bootstrap Next.js 15 app with pnpm + TypeScript + Tailwind"
```

### Task 1.2: Enable TypeScript strict mode

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Update tsconfig.json**

Ensure `compilerOptions` contains at minimum :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm build`
Expected: build succeeds with no TS errors.

- [ ] **Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "chore: enable strict TypeScript config"
```

### Task 1.3: Configure Prettier with Tailwind plugin

**Files:**
- Create: `.prettierrc`
- Create: `.prettierignore`
- Modify: `package.json` (add scripts)

- [ ] **Step 1: Install Prettier**

```bash
pnpm add -D prettier prettier-plugin-tailwindcss
```

- [ ] **Step 2: Create .prettierrc**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 3: Create .prettierignore**

```
.next
node_modules
build
dist
coverage
public
pnpm-lock.yaml
```

- [ ] **Step 4: Add scripts to package.json**

In `package.json`, update the `scripts` field to include:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 5: Run initial format pass**

Run: `pnpm format`
Expected: files reformatted consistently.

- [ ] **Step 6: Commit**

```bash
git add .prettierrc .prettierignore package.json pnpm-lock.yaml
git commit -m "chore: add Prettier with Tailwind class sorting"
```

### Task 1.4: Configure Vitest + Testing Library

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Modify: `package.json` (add scripts + deps)

- [ ] **Step 1: Install test dependencies**

```bash
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

- [ ] **Step 3: Create tests/setup.ts**

```typescript
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 4: Add test scripts to package.json**

Update `scripts`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

Merge with existing scripts (keep previous ones).

- [ ] **Step 5: Verify test command runs**

Run: `pnpm test`
Expected: "No test files found" — this is expected, Foundation has no tests written.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/ package.json pnpm-lock.yaml
git commit -m "chore: configure Vitest + Testing Library (no tests yet)"
```

### Task 1.5: Install runtime dependencies

**Files:**
- Modify: `package.json` via pnpm add

- [ ] **Step 1: Install Radix UI primitives**

```bash
pnpm add @radix-ui/react-dialog @radix-ui/react-slot
```

- [ ] **Step 2: Install Lucide React**

```bash
pnpm add lucide-react
```

- [ ] **Step 3: Install React Three Fiber + drei + three**

```bash
pnpm add three @react-three/fiber @react-three/drei
pnpm add -D @types/three
```

- [ ] **Step 4: Install Supabase clients (stubs usage)**

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 5: Install class merging helper**

```bash
pnpm add clsx tailwind-merge
```

- [ ] **Step 6: Verify build still passes**

Run: `pnpm build`
Expected: build succeeds, no type errors.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: install runtime deps (Radix, Lucide, R3F, Supabase, clsx)"
```

### Task 1.6: Upgrade Tailwind to v4

**Files:**
- Modify: `package.json`, `app/globals.css`, `postcss.config.mjs`
- Delete: `tailwind.config.ts` (v4 is CSS-first, no JS config needed)

- [ ] **Step 1: Install Tailwind v4**

```bash
pnpm add -D tailwindcss@latest @tailwindcss/postcss@latest
pnpm remove @tailwindcss/typography autoprefixer
```

If `tailwindcss-animate` is present from create-next-app, keep it for now.

- [ ] **Step 2: Update postcss.config.mjs**

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 3: Replace app/globals.css with v4 syntax**

Overwrite `app/globals.css`:

```css
@import 'tailwindcss';

@theme {
  --color-bg: #050507;
  --color-accent: #6366f1;
  --font-outfit: 'Outfit', sans-serif;
}

@layer base {
  html {
    overflow-y: scroll;
  }

  body {
    font-family: var(--font-outfit);
    background-color: var(--color-bg);
    color: #ffffff;
    margin: 0;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }

  *:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
    border-radius: 4px;
  }
}
```

- [ ] **Step 4: Delete old tailwind.config.ts if present**

```bash
rm -f tailwind.config.ts tailwind.config.js
```

- [ ] **Step 5: Verify dev server renders**

Run: `pnpm dev`
Expected: server runs, default page renders (Tailwind still works).

- [ ] **Step 6: Commit**

```bash
git add app/globals.css postcss.config.mjs package.json pnpm-lock.yaml
git commit -m "chore: migrate Tailwind to v4 with CSS-first config"
```

### Task 1.7: Setup .env.example + Supabase stubs

**Files:**
- Create: `.env.example`
- Create: `.env.local` (gitignored)
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

- [ ] **Step 1: Create .env.example**

```bash
# Supabase (self-host Railway, phase 2)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cloudflare R2 (audio streaming, phase 3)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 2: Create .env.local (copy of .env.example with placeholder values, gitignored)**

```bash
cp .env.example .env.local
```

Edit `.env.local` to set `NEXT_PUBLIC_APP_URL=http://localhost:3000`. Leave Supabase/R2 empty.

- [ ] **Step 3: Create lib/supabase/client.ts**

```typescript
// Stub for phase 2. Will wire @supabase/ssr createBrowserClient when backend is live.
// Foundation does NOT connect to Supabase; this export is a placeholder that throws if called.

export function getSupabaseBrowserClient(): never {
  throw new Error(
    'Supabase browser client is a stub in Foundation. Wire in phase 2.',
  );
}
```

- [ ] **Step 4: Create lib/supabase/server.ts**

```typescript
// Stub for phase 2. Will wire @supabase/ssr createServerClient when backend is live.

export function getSupabaseServerClient(): never {
  throw new Error(
    'Supabase server client is a stub in Foundation. Wire in phase 2.',
  );
}
```

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add .env.example lib/supabase/
git commit -m "feat: add env scaffold and Supabase client stubs for phase 2"
```

---

## Milestone 2 — Design foundation (fonts, globals, cn helper)

### Task 2.1: Setup next/font Outfit local

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Use Google fonts loader (local subset)**

Update `app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '600', '900'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SynthCamp — The AI Music Marketplace',
  description: 'Marketplace where the creative process is celebrated, not hidden.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // NOTE: user-scalable intentionally omitted (a11y WCAG 1.4.4)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={outfit.variable}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Verify font loads**

Run: `pnpm dev`
Visit http://localhost:3000, inspect font-family on `body` — should reference `var(--font-outfit)` via Tailwind config (or native CSS variable).

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: load Outfit via next/font with a11y-compliant viewport"
```

### Task 2.2: Port custom classes from base.txt to globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add custom classes from mockup**

Append to `app/globals.css`:

```css
@layer components {
  .glass-panel {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(25px);
    -webkit-backdrop-filter: blur(25px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 28px;
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05);
  }

  .btn-primary {
    background: #ffffff;
    color: #000000;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .btn-primary:active {
    transform: scale(0.96);
  }
}

@layer utilities {
  .ui-overlay {
    position: relative;
    z-index: 10;
    min-height: 100vh;
    background: radial-gradient(circle at center, transparent 0%, rgba(5, 5, 7, 0.6) 100%);
  }

  .album-shadow {
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  .live-glow {
    box-shadow: 0 0 25px rgba(99, 102, 241, 0.3);
  }

  .grain {
    pointer-events: none;
    position: absolute;
    inset: 0;
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  }

  .sidebar-transition {
    transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .view-enter {
    animation: fadeIn 0.6s ease-out forwards;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes wave {
  0%,
  100% {
    height: 4px;
  }
  50% {
    height: 16px;
  }
}
```

- [ ] **Step 2: Build to verify no CSS errors**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: port mockup custom classes to globals.css (glass-panel, grain, etc.)"
```

### Task 2.3: Create lib/cn.ts helper

**Files:**
- Create: `lib/cn.ts`

- [ ] **Step 1: Create cn.ts**

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/cn.ts
git commit -m "feat: add cn() helper (clsx + tailwind-merge)"
```

### Task 2.4: Create lib/device.ts hooks

**Files:**
- Create: `lib/device.ts`

- [ ] **Step 1: Create device.ts**

```typescript
'use client';

import { useEffect, useState } from 'react';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

export function useIsLowEndDevice(): boolean {
  const [lowEnd, setLowEnd] = useState(false);

  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 8;
    // deviceMemory is experimental; fallback to 4
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    setLowEnd(isMobile && (cores < 4 || memory < 4));
  }, []);

  return lowEnd;
}

export function useBackground3DEnabled(): boolean {
  const reduced = usePrefersReducedMotion();
  const lowEnd = useIsLowEndDevice();
  return !reduced && !lowEnd;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/device.ts
git commit -m "feat: add device hooks for conditional Background3D rendering"
```

---

## Milestone 3 — UI primitives

### Task 3.1: Create Button component

**Files:**
- Create: `components/ui/button.tsx`

- [ ] **Step 1: Create button.tsx**

```typescript
'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'ghost' | 'glass' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-white text-black hover:bg-gray-200 active:scale-95',
  ghost: 'bg-white/5 text-white border border-white/10 hover:bg-white/10',
  glass: 'bg-white/10 backdrop-blur-md text-white border border-white/10 hover:bg-white/20',
  accent: 'bg-indigo-500 text-black hover:bg-indigo-400 active:scale-95',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-[10px] min-h-[44px]',
  md: 'px-6 py-3 text-xs min-h-[44px]',
  lg: 'px-8 py-4 text-xs min-h-[48px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'rounded-2xl font-black uppercase tracking-widest transition-all',
        'focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-2',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
```

- [ ] **Step 2: Verify typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add components/ui/button.tsx
git commit -m "feat: add Button primitive with primary/ghost/glass/accent variants"
```

### Task 3.2: Create GlassPanel component

**Files:**
- Create: `components/ui/glass-panel.tsx`

- [ ] **Step 1: Create glass-panel.tsx**

```typescript
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const GlassPanel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('glass-panel', className)} {...props} />
  ),
);
GlassPanel.displayName = 'GlassPanel';
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/glass-panel.tsx
git commit -m "feat: add GlassPanel primitive"
```

### Task 3.3: Create LogoS component

**Files:**
- Create: `components/branding/logo-s.tsx`

- [ ] **Step 1: Create logo-s.tsx**

Port the SVG from `base.txt:122-133`:

```typescript
export interface LogoSProps {
  size?: number;
  className?: string;
}

export function LogoS({ size = 32, className }: LogoSProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SynthCamp logo"
      role="img"
    >
      <path
        d="M30 25C30 20 35 15 45 15H70C75 15 80 19 80 24C80 29 76 33 71 33H45C40 33 38 35 38 38C38 41 40 43 45 43H70C85 43 90 53 90 63C90 73 85 85 70 85H30C25 85 20 81 20 76C20 71 24 67 29 67H70C75 67 77 65 77 62C77 59 75 57 70 57H45C30 57 25 47 25 37C25 32 27 28 30 25Z"
        fill="url(#logoGradient)"
      />
      <defs>
        <linearGradient id="logoGradient" x1="20" y1="15" x2="90" y2="85" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/branding/logo-s.tsx
git commit -m "feat: port LogoS SVG with gradient fill"
```

### Task 3.4: Create ModeToggle pill with a11y

**Files:**
- Create: `components/ui/mode-toggle.tsx`

- [ ] **Step 1: Create mode-toggle.tsx**

```typescript
'use client';

import { cn } from '@/lib/cn';

export type Mode = 'explore' | 'artist';

export interface ModeToggleProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Mode"
      className="glass-panel relative flex h-10 w-40 flex-shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5 p-1"
    >
      <div
        className={cn(
          'absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-full transition-all duration-500',
          mode === 'explore' ? 'bg-white' : 'bg-indigo-600',
        )}
        style={{ transform: mode === 'artist' ? 'translateX(100%)' : 'translateX(0)' }}
        aria-hidden="true"
      />
      <button
        type="button"
        aria-pressed={mode === 'explore'}
        onClick={() => onChange('explore')}
        className={cn(
          'relative z-10 flex-1 text-[9px] font-black uppercase tracking-widest transition-colors duration-300 min-h-[44px]',
          mode === 'explore' ? 'text-black' : 'text-white/60 hover:text-white/80',
        )}
      >
        Explore
      </button>
      <button
        type="button"
        aria-pressed={mode === 'artist'}
        onClick={() => onChange('artist')}
        className={cn(
          'relative z-10 flex-1 text-[9px] font-black uppercase tracking-widest transition-colors duration-300 min-h-[44px]',
          mode === 'artist' ? 'text-white' : 'text-white/60 hover:text-white/80',
        )}
      >
        Artist
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/mode-toggle.tsx
git commit -m "feat: add ModeToggle pill with aria-pressed + 44px touch targets"
```

### Task 3.5: Create Sheet (Radix drawer) component

**Files:**
- Create: `components/ui/sheet.tsx`

- [ ] **Step 1: Create sheet.tsx**

```typescript
'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/cn';
import { type ReactNode } from 'react';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  side?: 'left' | 'right';
  title?: string;
}

export function Sheet({ open, onOpenChange, children, side = 'left', title = 'Menu' }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed bottom-0 top-0 z-[70] w-72 border-white/10 bg-[#050507]/90 backdrop-blur-3xl',
            side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            side === 'left'
              ? 'data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left'
              : 'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
            'data-[state=open]:shadow-[20px_0_60px_rgba(0,0,0,0.8)]',
          )}
          aria-label={title}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Install tailwindcss-animate if not already**

```bash
pnpm add tailwindcss-animate
```

- [ ] **Step 3: Enable tailwindcss-animate in globals.css**

Prepend to `app/globals.css` (after `@import 'tailwindcss';`):

```css
@plugin 'tailwindcss-animate';
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add components/ui/sheet.tsx app/globals.css package.json pnpm-lock.yaml
git commit -m "feat: add Sheet drawer (Radix Dialog) with slide animations"
```

---

## Milestone 4 — Layout components

### Task 4.1: Create SidebarItem

**Files:**
- Create: `components/layout/sidebar-item.tsx`

- [ ] **Step 1: Create sidebar-item.tsx**

```typescript
'use client';

import { cn } from '@/lib/cn';
import { type ReactNode } from 'react';

export interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export function SidebarItem({ icon, label, active, onClick }: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-5 px-8 py-5 transition-all min-h-[44px]',
        active
          ? 'border-l-4 border-indigo-500 bg-white/5 text-white'
          : 'text-white/60 hover:bg-white/[0.02] hover:text-white/80',
      )}
    >
      <div className={cn(active ? 'text-indigo-400' : '')}>{icon}</div>
      <span className="text-xs font-black uppercase tracking-[0.25em]">{label}</span>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/sidebar-item.tsx
git commit -m "feat: add SidebarItem with active state and accessible contrast"
```

### Task 4.2: Create Sidebar component

**Files:**
- Create: `components/layout/sidebar.tsx`

- [ ] **Step 1: Create sidebar.tsx**

```typescript
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, Library, LayoutGrid, Upload, Users, DollarSign } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { SidebarItem } from '@/components/layout/sidebar-item';
import { LogoS } from '@/components/branding/logo-s';

export interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isExplore = pathname.startsWith('/explore');

  const go = (path: string) => {
    router.push(path);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="left" title="SynthCamp menu">
      <div className="p-8 pb-12">
        <div className="flex items-start gap-4">
          <LogoS />
          <div className="flex flex-col">
            <h2 className="text-xl font-black italic uppercase leading-none tracking-tighter">
              SynthCamp
            </h2>
            <p className="mt-1 text-[9px] font-bold italic uppercase leading-none tracking-[0.3em] text-white/60">
              Menu
            </p>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100%-120px)] flex-col justify-between">
        <nav aria-label="Primary">
          {isExplore ? (
            <>
              <SidebarItem
                icon={<Home size={18} strokeWidth={2.5} />}
                label="Home"
                active={pathname === '/explore/home'}
                onClick={() => go('/explore/home')}
              />
              <SidebarItem
                icon={<Search size={18} strokeWidth={2.5} />}
                label="Search"
                active={pathname === '/explore/search'}
                onClick={() => go('/explore/search')}
              />
              <SidebarItem
                icon={<Library size={18} strokeWidth={2.5} />}
                label="Library"
                active={pathname === '/explore/library'}
                onClick={() => go('/explore/library')}
              />
            </>
          ) : (
            <>
              <SidebarItem
                icon={<LayoutGrid size={18} strokeWidth={2.5} />}
                label="My Music"
                active={pathname === '/artist/catalog'}
                onClick={() => go('/artist/catalog')}
              />
              <SidebarItem
                icon={<Upload size={18} strokeWidth={2.5} />}
                label="New Release"
                active={pathname === '/artist/upload'}
                onClick={() => go('/artist/upload')}
              />
              <SidebarItem
                icon={<Users size={18} strokeWidth={2.5} />}
                label="Live Parties"
                active={pathname === '/artist/parties'}
                onClick={() => go('/artist/parties')}
              />
              <SidebarItem
                icon={<DollarSign size={18} strokeWidth={2.5} />}
                label="Earnings"
                active={pathname === '/artist/sales'}
                onClick={() => go('/artist/sales')}
              />
            </>
          )}
        </nav>

        <div className="space-y-4 border-t border-white/5 p-8">
          <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black">
              JD
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">John Doe</span>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/sidebar.tsx
git commit -m "feat: add Sidebar drawer with mode-based nav and Lucide icons"
```

### Task 4.3: Create Header component

**Files:**
- Create: `components/layout/header.tsx`

- [ ] **Step 1: Create header.tsx**

```typescript
'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { LogoS } from '@/components/branding/logo-s';
import { ModeToggle, type Mode } from '@/components/ui/mode-toggle';
import { Sidebar } from '@/components/layout/sidebar';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentMode: Mode = pathname.startsWith('/artist') ? 'artist' : 'explore';

  const handleModeChange = (mode: Mode) => {
    router.push(mode === 'explore' ? '/explore/home' : '/artist/catalog');
  };

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 bg-gradient-to-b from-[#050507] via-[#050507]/90 to-transparent p-8 pb-24 pt-10">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Menu size={20} strokeWidth={2.5} />
            </button>
            <div className="flex items-start gap-4">
              <div className="mt-0.5">
                <LogoS />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-black italic uppercase leading-none tracking-tighter">
                  SynthCamp
                </h1>
                <p className="mt-2 text-[10px] font-bold italic uppercase leading-none tracking-[0.3em] text-white/60">
                  The AI Music Marketplace
                </p>
              </div>
            </div>
          </div>
          <ModeToggle mode={currentMode} onChange={handleModeChange} />
        </div>
      </header>

      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/header.tsx
git commit -m "feat: add Header with sidebar toggle, logo, mode switcher"
```

---

## Milestone 5 — 3D background

### Task 5.1: Create Blob mesh (R3F)

**Files:**
- Create: `components/three/blob.tsx`

- [ ] **Step 1: Create blob.tsx**

```typescript
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Mesh } from 'three';
import type { Mode } from '@/components/ui/mode-toggle';

export interface BlobProps {
  mode: Mode;
}

export function Blob({ mode }: BlobProps) {
  const meshRef = useRef<Mesh>(null);
  const targetColor = useRef(new THREE.Color(0x6366f1));

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const desiredColor = mode === 'explore' ? 0x6366f1 : 0x4f46e5;
    targetColor.current.set(desiredColor);

    const material = mesh.material as THREE.MeshStandardMaterial;
    material.color.lerp(targetColor.current, 0.03);
    mesh.rotation.y += 0.001;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2.8, 64, 64]} />
      <meshStandardMaterial
        color={0x6366f1}
        transparent
        opacity={0.25}
        roughness={0.2}
        metalness={0.1}
        emissive={0x6366f1}
        emissiveIntensity={0.05}
      />
    </mesh>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/three/blob.tsx
git commit -m "feat: add Blob R3F mesh (color lerp on mode change)"
```

### Task 5.2: Create Background3D wrapper

**Files:**
- Create: `components/three/background-3d.tsx`

- [ ] **Step 1: Create background-3d.tsx**

```typescript
'use client';

import { Canvas } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import { Blob } from '@/components/three/blob';
import { useBackground3DEnabled } from '@/lib/device';
import type { Mode } from '@/components/ui/mode-toggle';

export function Background3D() {
  const pathname = usePathname();
  const enabled = useBackground3DEnabled();

  const mode: Mode = pathname.startsWith('/artist') ? 'artist' : 'explore';

  if (!enabled) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 60%)',
        }}
      />
    );
  }

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 opacity-60">
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 0, 6] }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <pointLight color={0xffffff} intensity={1.2} distance={50} position={[5, 5, 5]} />
        <ambientLight color={0x222222} />
        <Blob mode={mode} />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Verify build (R3F SSR concern)**

Run: `pnpm build`
Expected: passes. If SSR errors occur, the `'use client'` directive should handle them.

- [ ] **Step 3: Commit**

```bash
git add components/three/background-3d.tsx
git commit -m "feat: add Background3D with fallback gradient for low-end/reduced-motion"
```

---

## Milestone 6 — Visualizers

### Task 6.1: Create LiveVisualizer

**Files:**
- Create: `components/visualizers/live-visualizer.tsx`

- [ ] **Step 1: Create live-visualizer.tsx**

```typescript
export function LiveVisualizer() {
  return (
    <div className="flex h-4 items-center gap-[2px]" aria-hidden="true">
      <div className="w-[2px] rounded-[1px] bg-white animate-[wave_1s_infinite_ease-in-out_0.1s]" />
      <div className="w-[2px] rounded-[1px] bg-white animate-[wave_1s_infinite_ease-in-out_0.3s]" />
      <div className="w-[2px] rounded-[1px] bg-white animate-[wave_1s_infinite_ease-in-out_0.2s]" />
      <div className="w-[2px] rounded-[1px] bg-white animate-[wave_1s_infinite_ease-in-out_0.4s]" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/visualizers/live-visualizer.tsx
git commit -m "feat: add LiveVisualizer (4 animated bars)"
```

### Task 6.2: Create StatusTimer

**Files:**
- Create: `components/visualizers/status-timer.tsx`

- [ ] **Step 1: Create status-timer.tsx**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

export interface StatusTimerProps {
  baseTime: number;
  isCountdown?: boolean;
  small?: boolean;
}

function formatTime(diff: number): string {
  const abs = Math.abs(diff);
  const seconds = Math.floor((abs / 1000) % 60);
  const minutes = Math.floor((abs / (1000 * 60)) % 60);
  const hours = Math.floor((abs / (1000 * 60 * 60)) % 24);

  const parts: string[] = [];
  if (hours > 0) parts.push(hours.toString().padStart(2, '0'));
  parts.push(minutes.toString().padStart(2, '0'));
  parts.push(seconds.toString().padStart(2, '0'));
  return parts.join(':');
}

export function StatusTimer({ baseTime, isCountdown = false, small = false }: StatusTimerProps) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const diff = isCountdown ? baseTime - now : now - baseTime;
      if (isCountdown && diff <= 0) {
        setTime('LIVE');
        return;
      }
      setTime(formatTime(diff));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [baseTime, isCountdown]);

  return (
    <div
      className={cn(
        'pointer-events-none absolute z-20',
        small ? 'right-4 top-2' : 'right-5 top-5',
      )}
    >
      <span
        className={cn(
          'inline-flex items-center rounded-full border border-white/10 bg-black/60 px-2.5 py-1.5 font-black uppercase tracking-[0.15em] text-white/60 backdrop-blur-md',
          small ? 'text-[7px]' : 'text-[8px]',
        )}
      >
        {isCountdown ? 'Starts in' : 'Started'}
        <span
          className={cn(
            'ml-1.5 font-mono tabular-nums text-indigo-400',
            small ? 'text-[9px]' : 'text-[11px]',
          )}
        >
          {time}
        </span>
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/visualizers/status-timer.tsx
git commit -m "feat: add StatusTimer (countdown or elapsed, two sizes)"
```

---

## Milestone 7 — Catalog + Rooms data and components

### Task 7.1: Create lib/pricing.ts

**Files:**
- Create: `lib/pricing.ts`

- [ ] **Step 1: Create pricing.ts**

```typescript
export function getPrice(trackCount: number): string {
  const calculated = Math.ceil(trackCount * 0.6);
  return `${calculated - 0.01}`;
}

export function getReleaseLabel(trackCount: number): string {
  let type = 'Album';
  if (trackCount === 1) type = 'Single';
  else if (trackCount <= 5) type = 'EP';
  return `${trackCount} ${trackCount > 1 ? 'tracks' : 'track'} • ${type}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/pricing.ts
git commit -m "feat: extract pricing + release label helpers from mockup"
```

### Task 7.2: Download Unsplash mock covers to local

**Files:**
- Create: `public/mock-covers/cover-01.jpg` through `cover-06.jpg`
- Create: `public/mock-covers/hero.jpg`

- [ ] **Step 1: Download mock covers**

Run from project root (bash):

```bash
mkdir -p public/mock-covers
curl -L -o public/mock-covers/cover-01.jpg "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=500&auto=format&fit=crop"
curl -L -o public/mock-covers/cover-02.jpg "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=500&auto=format&fit=crop"
curl -L -o public/mock-covers/cover-03.jpg "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=500&auto=format&fit=crop"
curl -L -o public/mock-covers/cover-04.jpg "https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=500&auto=format&fit=crop"
curl -L -o public/mock-covers/cover-05.jpg "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=500&auto=format&fit=crop"
curl -L -o public/mock-covers/cover-06.jpg "https://images.unsplash.com/photo-1619983081563-430f63602796?q=80&w=500&auto=format&fit=crop"
curl -L -o public/mock-covers/hero.jpg "https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=1200&auto=format&fit=crop"
curl -L -o public/mock-covers/room-bg.jpg "https://images.unsplash.com/photo-1514525253361-bee8a48790c3?q=80&w=1200&auto=format&fit=crop"
```

- [ ] **Step 2: Verify files are under 300 KB each**

Run: `ls -la public/mock-covers/`
Expected: 8 files, each 30-100 KB.

- [ ] **Step 3: Commit**

```bash
git add public/mock-covers/
git commit -m "chore: download Unsplash mock covers for autonomy"
```

### Task 7.3: Create lib/mock-data.ts with types

**Files:**
- Create: `lib/mock-data.ts`

- [ ] **Step 1: Create mock-data.ts**

```typescript
export type CreditCategory = 'acoustic' | 'hybrid' | 'ai_crafted';

export interface Release {
  id: number;
  title: string;
  artist: string;
  trackCount: number;
  cover: string;
  category?: CreditCategory; // placeholder for phase 2 Creative Credits
}

export interface SoundRoom {
  id: number;
  title: string;
  artist: string;
  listeners: number;
  baseTime: number;
  isCountdown: boolean;
  cover: string;
  countries: string;
}

export const NEW_RELEASES: Release[] = [
  { id: 1, title: 'Neural Drift', artist: 'Alexia V.', trackCount: 12, cover: '/mock-covers/cover-01.jpg' },
  { id: 2, title: 'Soil Echoes', artist: 'Root System', trackCount: 4, cover: '/mock-covers/cover-02.jpg' },
  { id: 3, title: 'Binary Folk', artist: 'Ghost Patch', trackCount: 1, cover: '/mock-covers/cover-03.jpg' },
  { id: 4, title: 'Latent Voice', artist: 'Neuro-Choral', trackCount: 8, cover: '/mock-covers/cover-04.jpg' },
  { id: 5, title: 'Static Wind', artist: 'Amber', trackCount: 5, cover: '/mock-covers/cover-05.jpg' },
  { id: 6, title: 'Silicon Soul', artist: 'The Core', trackCount: 14, cover: '/mock-covers/cover-06.jpg' },
];

export const HERO_RELEASE: Release = {
  id: 100,
  title: 'Aura Genesis',
  artist: 'Sylvan Woods',
  trackCount: 12,
  cover: '/mock-covers/hero.jpg',
};

// Times are computed relative to module load; good enough for mockup fidelity.
const now = Date.now();
export const MAIN_ROOM_START = now - (45 * 60 * 1000 + 23 * 1000);
export const SECONDARY_ROOM_1_START = now - 12 * 60 * 1000;
export const SECONDARY_ROOM_2_START = now + (5 * 60 * 1000 + 42 * 1000);

export const MAIN_ROOM = {
  title: 'Latent Spaces Premiere',
  artist: 'Sylvan Woods',
  listeners: 1200,
  cover: '/mock-covers/room-bg.jpg',
  channel: 'Global Master Channel',
  tagline: 'Experience the master cut with 1.2k listeners',
  countries: 'London, Paris, Tokyo, Berlin, NYC...',
};

export const SECONDARY_ROOMS: SoundRoom[] = [
  {
    id: 1,
    title: 'Neural Drift Jam',
    artist: 'Alexia V.',
    listeners: 840,
    baseTime: SECONDARY_ROOM_1_START,
    isCountdown: false,
    cover: '/mock-covers/cover-02.jpg',
    countries: 'France, United Kingdom, Germany',
  },
  {
    id: 2,
    title: 'Binary Soundscape',
    artist: 'Ghost Patch',
    listeners: 420,
    baseTime: SECONDARY_ROOM_2_START,
    isCountdown: true,
    cover: '/mock-covers/cover-03.jpg',
    countries: 'Japan, United States, Canada',
  },
];

export const ARTIST_RELEASES: Release[] = [
  { id: 201, title: 'Echoes of the Soil', artist: 'John Doe', trackCount: 12, cover: '/mock-covers/cover-04.jpg' },
  { id: 202, title: 'Neural Folk EP', artist: 'John Doe', trackCount: 4, cover: '/mock-covers/cover-05.jpg' },
];
```

- [ ] **Step 2: Commit**

```bash
git add lib/mock-data.ts
git commit -m "feat: add typed mock data (releases, rooms) referencing local covers"
```

### Task 7.4: Configure next.config for local images

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Update next.config.ts**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Pravatar avatars still loaded from remote in mock data; add here if needed
      { protocol: 'https', hostname: 'i.pravatar.cc' },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Commit**

```bash
git add next.config.ts
git commit -m "chore: allow pravatar.cc for mock avatars, local covers default"
```

### Task 7.5: Create HeroRelease component

**Files:**
- Create: `components/catalog/hero-release.tsx`

- [ ] **Step 1: Create hero-release.tsx**

```typescript
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { getPrice, getReleaseLabel } from '@/lib/pricing';
import type { Release } from '@/lib/mock-data';

export interface HeroReleaseProps {
  release: Release;
  editorsChoice?: boolean;
  tagline?: string;
}

export function HeroRelease({
  release,
  editorsChoice = true,
  tagline = "The world's first fully AI-orchestrated folk symphony.",
}: HeroReleaseProps) {
  return (
    <section className="album-shadow group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-[3rem] sm:aspect-video">
      <Image
        src={release.cover}
        alt={`${release.title} cover`}
        fill
        sizes="(max-width: 768px) 100vw, 66vw"
        className="object-cover transition-transform duration-1000 group-hover:scale-105"
        priority
      />
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/20 to-transparent" />
      <div className="absolute bottom-10 left-10 z-20 space-y-2 text-left text-white">
        {editorsChoice && (
          <span className="inline-block rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-lg">
            Editor&apos;s Choice
          </span>
        )}
        <h2 className="text-4xl font-black italic uppercase leading-none">{release.title}</h2>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/90">
          By {release.artist}
        </p>
        <p className="max-w-xs text-sm italic leading-tight text-white/80">{tagline}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
          {getReleaseLabel(release.trackCount)}
        </p>
        <div className="flex gap-4 pt-4">
          <Button variant="primary" size="md">
            Listen Now
          </Button>
          <Button variant="glass" size="md">
            ${getPrice(release.trackCount)}
          </Button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/catalog/hero-release.tsx
git commit -m "feat: add HeroRelease card for Editor's Choice"
```

### Task 7.6: Create ReleaseCard component

**Files:**
- Create: `components/catalog/release-card.tsx`

- [ ] **Step 1: Create release-card.tsx**

```typescript
import Image from 'next/image';
import { Play } from 'lucide-react';
import { getPrice, getReleaseLabel } from '@/lib/pricing';
import type { Release } from '@/lib/mock-data';

export interface ReleaseCardProps {
  release: Release;
}

export function ReleaseCard({ release }: ReleaseCardProps) {
  return (
    <article className="group cursor-pointer space-y-3 text-left">
      <div className="glass-panel relative aspect-square overflow-hidden rounded-[2rem] border-white/5 transition-transform active:scale-95">
        <Image
          src={release.cover}
          alt={`${release.title} cover`}
          fill
          sizes="(max-width: 640px) 50vw, 33vw"
          className="object-cover opacity-80 transition-all duration-1000 group-hover:scale-110 group-hover:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-xl">
            <Play size={20} fill="currentColor" />
          </div>
        </div>
      </div>
      <div>
        <p className="truncate text-sm font-bold italic leading-none tracking-tight text-white">
          {release.title}
        </p>
        <p className="mt-1 text-[10px] font-medium leading-none text-white/80">
          by {release.artist}
        </p>
        <div className="mt-2.5 flex items-center justify-between px-0.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">
            {getReleaseLabel(release.trackCount)}
          </p>
          <span className="font-mono text-[11px] font-black tracking-tighter text-indigo-400">
            ${getPrice(release.trackCount)}
          </span>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/catalog/release-card.tsx
git commit -m "feat: add ReleaseCard component for grid display"
```

### Task 7.7: Create SoundRoomMain component

**Files:**
- Create: `components/rooms/sound-room-main.tsx`

- [ ] **Step 1: Create sound-room-main.tsx**

```typescript
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { LiveVisualizer } from '@/components/visualizers/live-visualizer';
import { StatusTimer } from '@/components/visualizers/status-timer';
import { MAIN_ROOM, MAIN_ROOM_START } from '@/lib/mock-data';

export function SoundRoomMain() {
  return (
    <article className="glass-panel group relative cursor-pointer overflow-hidden rounded-[2.5rem] border-white/10 p-1 transition-transform duration-500 active:scale-[0.99]">
      <StatusTimer baseTime={MAIN_ROOM_START} />
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-indigo-900/40 via-transparent to-transparent" />
      <Image
        src={MAIN_ROOM.cover}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 66vw"
        className="z-0 object-cover opacity-40 mix-blend-screen blur-2xl transition-transform duration-1000 group-hover:scale-110"
      />
      <div className="grain z-0" />
      <div className="relative z-10 flex flex-col items-center justify-between gap-6 p-5 text-left md:flex-row">
        <div className="flex flex-1 items-center gap-6">
          <div className="relative shrink-0">
            <div className="live-glow relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 backdrop-blur-md">
              <Image src={MAIN_ROOM.cover} alt="" fill className="object-cover opacity-40" />
              <div className="relative z-10">
                <LiveVisualizer />
              </div>
            </div>
            <div className="absolute right-1 top-1 h-3.5 w-3.5 animate-pulse rounded-full border-2 border-[#050507] bg-red-500 shadow-[0_0_10px_red]" />
          </div>
          <div className="space-y-1">
            <div className="mb-0.5 flex items-center gap-3 text-white/70">
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-indigo-400">
                On Air
              </span>
              <div className="h-[1px] w-6 bg-white/30" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/80">
                {MAIN_ROOM.channel}
              </span>
            </div>
            <h3 className="text-3xl font-black italic uppercase leading-none tracking-tight text-white drop-shadow-lg">
              {MAIN_ROOM.title}
            </h3>
            <p className="pt-0.5 text-[13px] font-bold uppercase tracking-[0.2em] text-indigo-300">
              by {MAIN_ROOM.artist}
            </p>
            <p className="pt-0.5 text-sm font-medium italic text-white">{MAIN_ROOM.tagline}</p>
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center gap-3 text-white/80">
                <div className="flex -space-x-2">
                  {[11, 12, 13, 14].map((id) => (
                    <Image
                      key={id}
                      src={`https://i.pravatar.cc/100?u=${id}`}
                      alt=""
                      width={24}
                      height={24}
                      className="rounded-full border border-black/40"
                    />
                  ))}
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/20 text-[7px] font-bold backdrop-blur-md">
                    +1.2k
                  </div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-300">
                  Live Worldwide
                </span>
              </div>
              <span className="block text-[8px] font-bold italic uppercase tracking-[0.1em] text-white/70 drop-shadow-md">
                {MAIN_ROOM.countries}
              </span>
            </div>
          </div>
        </div>
        <Button variant="primary" size="lg" className="w-full shrink-0 md:w-auto">
          Enter Now
        </Button>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/rooms/sound-room-main.tsx
git commit -m "feat: add SoundRoomMain (large on-air card)"
```

### Task 7.8: Create SoundRoomCompact component

**Files:**
- Create: `components/rooms/sound-room-compact.tsx`

- [ ] **Step 1: Create sound-room-compact.tsx**

```typescript
import Image from 'next/image';
import { DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LiveVisualizer } from '@/components/visualizers/live-visualizer';
import { StatusTimer } from '@/components/visualizers/status-timer';
import type { SoundRoom } from '@/lib/mock-data';

export interface SoundRoomCompactProps {
  room: SoundRoom;
}

export function SoundRoomCompact({ room }: SoundRoomCompactProps) {
  return (
    <article className="glass-panel group relative flex min-h-[95px] cursor-pointer flex-col justify-center overflow-hidden rounded-[2rem] border-white/5 p-4 transition-colors hover:bg-white/[0.05]">
      <StatusTimer baseTime={room.baseTime} isCountdown={room.isCountdown} small />
      <div className="relative z-10 mt-2 flex w-full items-center justify-between gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-5">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
            <Image src={room.cover} alt="" fill className="object-cover opacity-20" />
            {!room.isCountdown ? (
              <LiveVisualizer />
            ) : (
              <DollarSign size={18} strokeWidth={2} className="text-white/80" />
            )}
          </div>
          <div className="min-w-0 flex-1 pr-4">
            <div className="mb-1 flex items-baseline gap-3">
              <h4 className="truncate text-lg font-bold italic leading-none text-white">
                {room.title}
              </h4>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                by {room.artist}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-[0.1em] text-white/70">
                <span className="whitespace-nowrap text-white">
                  {room.listeners} {room.isCountdown ? 'waiting' : 'listeners'}
                </span>
                <span className="h-0.5 w-0.5 rounded-full bg-white/30" />
                <span className="italic">{room.countries}</span>
              </div>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="self-end shrink-0">
          {room.isCountdown ? 'Wait' : 'Enter'}
        </Button>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/rooms/sound-room-compact.tsx
git commit -m "feat: add SoundRoomCompact (secondary rooms list)"
```

---

## Milestone 8 — Player stub

### Task 8.1: Create MiniPlayer stub

**Files:**
- Create: `components/player/mini-player.tsx`

- [ ] **Step 1: Create mini-player.tsx**

```typescript
// Stub for phase 3. Foundation reserves `pb-24` space on pages but renders nothing.
export function MiniPlayer() {
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/player/mini-player.tsx
git commit -m "feat: add MiniPlayer stub (null render, pb-24 reserved on main)"
```

---

## Milestone 9 — Root layout and pages

### Task 9.1: Rewrite root layout with shell

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace app/layout.tsx**

```typescript
import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import { Background3D } from '@/components/three/background-3d';
import { Header } from '@/components/layout/header';
import { MiniPlayer } from '@/components/player/mini-player';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '600', '900'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SynthCamp — The AI Music Marketplace',
  description: 'Marketplace where the creative process is celebrated, not hidden.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={outfit.variable}>
      <body>
        <Background3D />
        <div className="ui-overlay pb-32">
          <Header />
          <div className="h-40" aria-hidden="true" />
          {children}
        </div>
        <MiniPlayer />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: wire root layout with Background3D + Header + MiniPlayer shell"
```

### Task 9.2: Create root redirect

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace app/page.tsx**

```typescript
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/explore/home');
}
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: redirect / to /explore/home"
```

### Task 9.3: Create (explore) layout and home page

**Files:**
- Create: `app/(explore)/layout.tsx`
- Create: `app/(explore)/home/page.tsx`

- [ ] **Step 1: Create (explore)/layout.tsx**

```typescript
export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Create (explore)/home/page.tsx**

```typescript
import { HeroRelease } from '@/components/catalog/hero-release';
import { ReleaseCard } from '@/components/catalog/release-card';
import { SoundRoomMain } from '@/components/rooms/sound-room-main';
import { SoundRoomCompact } from '@/components/rooms/sound-room-compact';
import { NEW_RELEASES, HERO_RELEASE, SECONDARY_ROOMS } from '@/lib/mock-data';

export default function ExploreHomePage() {
  return (
    <main className="view-enter mx-auto max-w-4xl space-y-12 px-6 pb-32">
      <HeroRelease release={HERO_RELEASE} />

      <section>
        <div className="mb-6 flex items-center justify-between text-white/80">
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em]">New Releases</h3>
          <div className="ml-6 h-[1px] flex-1 bg-white/20" />
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {NEW_RELEASES.map((release) => (
            <ReleaseCard key={release.id} release={release} />
          ))}
        </div>
      </section>

      <section className="pb-20">
        <div className="mb-6 flex items-center justify-between text-white/80">
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em]">Active Sound Rooms</h3>
          <div className="ml-6 h-[1px] flex-1 bg-white/20" />
        </div>
        <div className="space-y-6">
          <SoundRoomMain />
          <div className="grid grid-cols-1 gap-4">
            {SECONDARY_ROOMS.map((room) => (
              <SoundRoomCompact key={room.id} room={room} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Verify dev server renders the home page**

Run: `pnpm dev`
Visit http://localhost:3000
Expected: redirects to `/explore/home`, renders hero + grid + rooms.

- [ ] **Step 4: Commit**

```bash
git add "app/(explore)/"
git commit -m "feat: explore/home page with hero, releases grid, sound rooms"
```

### Task 9.4: Create explore placeholders (search, library)

**Files:**
- Create: `app/(explore)/search/page.tsx`
- Create: `app/(explore)/library/page.tsx`

- [ ] **Step 1: Create search/page.tsx**

```typescript
export default function SearchPage() {
  return (
    <main className="view-enter mx-auto max-w-4xl px-6 pb-32 pt-10 text-center">
      <h2 className="text-3xl font-black italic uppercase leading-none text-white">Search</h2>
      <p className="mt-4 text-sm italic text-white/60">Coming soon.</p>
    </main>
  );
}
```

- [ ] **Step 2: Create library/page.tsx**

```typescript
export default function LibraryPage() {
  return (
    <main className="view-enter mx-auto max-w-4xl px-6 pb-32 pt-10 text-center">
      <h2 className="text-3xl font-black italic uppercase leading-none text-white">Library</h2>
      <p className="mt-4 text-sm italic text-white/60">Coming soon.</p>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(explore)/search/" "app/(explore)/library/"
git commit -m "feat: explore placeholders for search and library"
```

### Task 9.5: Create (artist) layout and catalog page

**Files:**
- Create: `app/(artist)/layout.tsx`
- Create: `app/(artist)/catalog/page.tsx`

- [ ] **Step 1: Create (artist)/layout.tsx**

```typescript
export default function ArtistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Create (artist)/catalog/page.tsx**

```typescript
import Image from 'next/image';
import { GlassPanel } from '@/components/ui/glass-panel';
import { getPrice, getReleaseLabel } from '@/lib/pricing';
import { ARTIST_RELEASES } from '@/lib/mock-data';

export default function ArtistCatalogPage() {
  return (
    <main className="view-enter mx-auto max-w-md space-y-8 px-6 pb-32">
      <div className="flex items-end justify-between text-white/90">
        <h2 className="text-4xl font-black italic uppercase leading-none tracking-tighter text-white">
          My Music
        </h2>
        <p className="mb-1 text-[10px] font-bold italic uppercase tracking-widest">
          2 active releases
        </p>
      </div>

      <div className="space-y-4">
        {ARTIST_RELEASES.map((release, idx) => (
          <GlassPanel
            key={release.id}
            className="flex cursor-pointer items-center gap-5 p-4 transition-transform hover:bg-white/[0.05] active:scale-[0.98]"
          >
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <Image src={release.cover} alt={`${release.title} cover`} fill className="object-cover" />
            </div>
            <div className="flex-1 overflow-hidden text-sm text-white/90">
              <h3 className="truncate text-lg font-bold italic leading-tight text-white">
                {release.title}
              </h3>
              <p className="mb-1 text-[10px] font-medium">by {release.artist}</p>
              <p className="text-[9px] font-bold italic uppercase tracking-widest text-white/70">
                {getReleaseLabel(release.trackCount)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[12px] font-bold italic leading-none text-white">
                ${getPrice(release.trackCount)}
              </p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-tighter text-indigo-400">
                {idx === 0 ? '842' : '12'} Sales
              </p>
            </div>
          </GlassPanel>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 text-white/90">
        <GlassPanel className="p-6">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">
            Total Revenue
          </p>
          <p className="font-mono text-2xl font-black leading-none tracking-tighter text-white">
            $3,240.50
          </p>
        </GlassPanel>
        <GlassPanel className="border-indigo-500/20 bg-indigo-500/5 p-6">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">
            Fan Base
          </p>
          <p className="text-2xl font-black leading-none tracking-tighter text-white">12.8k</p>
        </GlassPanel>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(artist)/layout.tsx" "app/(artist)/catalog/"
git commit -m "feat: artist catalog page (my music) with revenue stats"
```

### Task 9.6: Create artist upload page with relabelled slider

**Files:**
- Create: `app/(artist)/upload/page.tsx`

- [ ] **Step 1: Create upload/page.tsx**

```typescript
'use client';

import { useState } from 'react';
import { Upload as UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';

export default function ArtistUploadPage() {
  const [creditsLevel, setCreditsLevel] = useState(50);

  return (
    <main className="view-enter mx-auto max-w-md space-y-8 px-6 pb-32 text-white/90">
      <h2 className="text-center text-4xl font-black italic uppercase leading-none tracking-tighter text-white">
        New
        <br />
        <span className="text-sm italic underline tracking-widest text-white/60 not-italic">
          Release
        </span>
      </h2>

      <GlassPanel className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center border-2 border-dashed border-white/10 p-10 transition-transform hover:bg-white/[0.05] active:scale-[0.98]">
        <UploadIcon size={48} strokeWidth={1.5} className="mb-6 text-white/60" />
        <p className="text-sm font-bold uppercase tracking-widest text-white/80">
          Select Audio Files
        </p>
      </GlassPanel>

      <GlassPanel className="space-y-8 p-8 text-left">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xl font-bold italic leading-none tracking-tight text-white">
              Creative Credits
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
              Coming soon — full form in next phase
            </p>
          </div>
          <p className="font-mono text-4xl font-black leading-none tracking-tighter text-indigo-400">
            {creditsLevel}%
          </p>
        </div>
        <input
          type="range"
          aria-label="Creative credits placeholder slider (non-functional)"
          className="w-full cursor-pointer accent-indigo-500"
          value={creditsLevel}
          onChange={(e) => setCreditsLevel(Number(e.target.value))}
        />
        <Button variant="primary" size="lg" className="w-full shadow-xl shadow-white/5">
          Publish Release
        </Button>
      </GlassPanel>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(artist)/upload/"
git commit -m "feat: artist upload page with Creative Credits placeholder slider"
```

### Task 9.7: Create artist sales and parties pages

**Files:**
- Create: `app/(artist)/sales/page.tsx`
- Create: `app/(artist)/parties/page.tsx`

- [ ] **Step 1: Create sales/page.tsx**

```typescript
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';

export default function ArtistSalesPage() {
  return (
    <main className="view-enter mx-auto max-w-md space-y-8 px-6 pb-32 text-left">
      <h2 className="text-4xl font-black italic uppercase leading-none tracking-tighter text-indigo-400">
        Earnings
      </h2>

      <GlassPanel className="border-indigo-500/20 bg-indigo-500/5 p-8 text-center">
        <p className="mb-3 text-[10px] font-black uppercase leading-none tracking-[0.3em] text-indigo-400">
          Withdrawable Balance
        </p>
        <p className="font-mono text-6xl font-black italic leading-none tracking-tighter text-white">
          $3,240<span className="text-2xl text-white/70">.50</span>
        </p>
        <Button variant="accent" size="md" className="mt-8">
          Request Payout
        </Button>
      </GlassPanel>

      <GlassPanel className="p-6">
        <h3 className="mb-4 border-b border-white/5 pb-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/60">
          Recent Sales
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/80">Neural Drift #1</span>
            <span className="font-mono text-indigo-400">+$14.99</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/80">Echoes of the Soil (Album)</span>
            <span className="font-mono text-indigo-400">+$24.99</span>
          </div>
        </div>
      </GlassPanel>
    </main>
  );
}
```

- [ ] **Step 2: Create parties/page.tsx**

```typescript
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ArtistPartiesPage() {
  return (
    <main className="view-enter mx-auto max-w-md space-y-8 px-6 pb-32 pt-10 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-indigo-500/20 bg-indigo-600/20">
        <Users size={32} strokeWidth={2} className="text-indigo-400" />
      </div>
      <h2 className="text-3xl font-black italic uppercase leading-none text-white">
        Listening Parties
      </h2>
      <p className="text-sm italic text-white/60">Scheduled sessions with your fans appear here.</p>
      <Button variant="ghost" size="sm" className="mt-4">
        Schedule Party
      </Button>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(artist)/sales/" "app/(artist)/parties/"
git commit -m "feat: artist sales (earnings) and parties (placeholder) pages"
```

---

## Milestone 10 — Error pages

### Task 10.1: Create branded not-found page

**Files:**
- Create: `app/not-found.tsx`

- [ ] **Step 1: Create not-found.tsx**

```typescript
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LogoS } from '@/components/branding/logo-s';

export default function NotFound() {
  return (
    <main className="view-enter mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-6 pb-32">
      <GlassPanel className="flex flex-col items-center space-y-6 p-12 text-center">
        <LogoS size={48} />
        <h2 className="text-3xl font-black italic uppercase leading-none text-white">
          Signal perdu
        </h2>
        <p className="text-sm italic text-white/70">Cette fréquence n&apos;existe pas.</p>
        <Link href="/explore/home">
          <Button variant="primary" size="md">
            Retour à l&apos;Explore
          </Button>
        </Link>
      </GlassPanel>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/not-found.tsx
git commit -m "feat: branded 404 page with SynthCamp shell"
```

### Task 10.2: Create branded error page

**Files:**
- Create: `app/error.tsx`

- [ ] **Step 1: Create error.tsx**

```typescript
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LogoS } from '@/components/branding/logo-s';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="view-enter mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-6 pb-32">
      <GlassPanel className="flex flex-col items-center space-y-6 p-12 text-center">
        <LogoS size={48} />
        <h2 className="text-3xl font-black italic uppercase leading-none text-white">
          Fréquence brouillée
        </h2>
        <p className="text-sm italic text-white/70">
          Une erreur inattendue est survenue pendant la lecture.
        </p>
        <div className="flex gap-3">
          <Button variant="primary" size="md" onClick={() => reset()}>
            Réessayer
          </Button>
          <Link href="/explore/home">
            <Button variant="ghost" size="md">
              Retour
            </Button>
          </Link>
        </div>
      </GlassPanel>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/error.tsx
git commit -m "feat: branded 500 error boundary with reset and home CTA"
```

---

## Milestone 11 — Deploy + validate

### Task 11.1: Create railway.json

**Files:**
- Create: `railway.json`

- [ ] **Step 1: Create railway.json**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install --frozen-lockfile && pnpm build"
  },
  "deploy": {
    "startCommand": "pnpm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

- [ ] **Step 2: Commit + push**

```bash
git add railway.json
git commit -m "chore: configure Railway build + start commands"
git push origin main
```

- [ ] **Step 3: Verify Railway deploy succeeds**

Check Railway dashboard — build should succeed, preview URL should be accessible. If build fails, inspect logs.

### Task 11.2: Run full build and lint locally

- [ ] **Step 1: Run build**

```bash
pnpm build
```

Expected: succeeds with no errors.

- [ ] **Step 2: Run lint and typecheck**

```bash
pnpm lint && pnpm typecheck && pnpm format:check
```

Expected: all pass.

- [ ] **Step 3: Start prod build locally to smoke-test**

```bash
pnpm start
```

Visit http://localhost:3000. Verify:
- Redirect to `/explore/home`
- Hero renders with local cover
- Releases grid renders 6 cards
- Main Sound Room renders with timer
- Secondary rooms render with countdowns
- Mode toggle switches to Artist (URL becomes `/artist/catalog`)
- Sidebar drawer opens, navigation works
- No console errors

### Task 11.3: A11y audit

- [ ] **Step 1: Contrast audit**

Open DevTools → Lighthouse → Accessibility audit. Expected Lighthouse A11y score ≥ 95. Fix any contrast fails (text-white/40 should have been upgraded to text-white/60+ in components).

- [ ] **Step 2: Keyboard navigation manual test**

Press `Tab` repeatedly from page load. Verify:
- Menu button (header) focusable
- ModeToggle Explore/Artist buttons focusable, `aria-pressed` correct
- All nav items focusable
- Focus ring visible on every interactive element
- `Enter` / `Space` triggers buttons
- Sidebar drawer: `Escape` closes, focus returns to menu button

- [ ] **Step 3: Pinch-zoom test (DevTools mobile emulation)**

Set DevTools to iPhone SE simulation. Pinch-zoom must work (viewport meta allows it).

- [ ] **Step 4: Fix any issues found**

If A11y score < 95 or manual issues found, fix inline and re-verify. Commit fixes:

```bash
git add -A
git commit -m "fix: a11y corrections from Lighthouse + keyboard audit"
```

### Task 11.4: Lighthouse Performance audit

- [ ] **Step 1: Run Lighthouse on mobile simulation**

DevTools → Lighthouse → Performance → Mobile → Moto G Power → Analyze.

- [ ] **Step 2: Verify score ≥ 85**

If score ≥ 85 → done.

If score < 85, inspect the slowest metrics:
- **LCP**: ensure `priority` on hero image (already set)
- **TBT** (Total Blocking Time): R3F Canvas may be the culprit — consider tightening `useBackground3DEnabled()` criteria (e.g., `hardwareConcurrency < 6` for mobile)
- **CLS**: verify all images have explicit `width`/`height` or `fill`
- **Bundle**: run `pnpm build` output inspection, consider dynamic import of Canvas

- [ ] **Step 3: Apply adjustments if needed, commit**

```bash
git add -A
git commit -m "perf: tighten Background3D disable criteria for mobile Lighthouse ≥ 85"
```

### Task 11.5: Final push + Railway preview verification

- [ ] **Step 1: Push final state**

```bash
git push origin main
```

- [ ] **Step 2: Wait for Railway deploy to finish**

Railway dashboard shows green deployment.

- [ ] **Step 3: Open preview URL and run full manual smoke test**

Visit the Railway preview URL. Repeat Task 11.2 step 3 checklist on the deployed version. Verify everything works in production build.

- [ ] **Step 4: Tag the milestone**

```bash
git tag -a v0.1.0-foundation -m "Foundation milestone complete"
git push origin v0.1.0-foundation
```

---

## Acceptance checklist (final)

Before declaring Foundation done, verify every spec criterion:

### Fonctionnels
- [ ] UI aligned visually with `base.txt` (aux correctifs a11y près).
- [ ] Navigation URL: all 7 routes render (explore home/search/library, artist catalog/upload/parties/sales).
- [ ] Mode toggle switches URL and pill state.
- [ ] Sidebar drawer opens/closes with overlay, transitions, focus trap, Escape.
- [ ] `not-found` and `error` pages render at SynthCamp look.

### Qualité code
- [ ] `pnpm build` passes (no TS / ESLint errors).
- [ ] `pnpm lint` and `pnpm format:check` clean.
- [ ] `pnpm typecheck` clean.
- [ ] Railway deploy green.

### Performance
- [ ] Lighthouse Performance ≥ 85 on `/explore/home` mobile (Moto G Power).

### A11y
- [ ] Contrast: all info text ≥ 4.5:1.
- [ ] Keyboard nav complete (Tab / Shift+Tab / Enter / Space / Escape).
- [ ] `:focus-visible` ring visible and consistent.
- [ ] Viewport allows pinch-zoom.
- [ ] Touch targets ≥ 44×44 px audited.
- [ ] Background3D respects `prefers-reduced-motion`.

---

## Next phase

Foundation complete. Phase 2 brainstorm topic: Creative Credits formal UX + database schema + Identity + Catalog (Supabase self-host stand-up).
