# SynthCamp — Sous-projet 1 : Fondation

**Date :** 2026-04-21
**Statut :** Design validé, prêt pour rédaction du plan d'implémentation.
**Auteur :** SynthCamp team (brainstormé avec Claude Code)

---

## 1. Contexte

SynthCamp est un marketplace de musique positionné sur la **transparence du process créatif**, dans une ère où l'IA musicale se banalise. Le produit complet sera bâti en 6 sous-projets indépendants. Ce document spécifie le sous-projet 1 — la **Fondation technique**.

Point de départ : `base.txt`, un prototype HTML de 500 lignes contenant React 18 + Tailwind + Three.js via CDN et Babel à la volée. Toute la logique métier est hardcodée, aucun backend.

Point d'arrivée Foundation : un projet Next.js 15 maintenable, déployable, reproduisant visuellement et fonctionnellement l'UI du mockup. Aucun backend n'est wiré. Le scaffold backend (Supabase + R2) est présent en stubs pour préparer la phase 2.

## 2. Prérequis (Step 0)

Avant toute ligne de code Next.js :

1. **`git init`** à la racine `C:\Projets\SynthCamp-marketplace\`, `.gitignore` aligné sur Next.js + Node + OS.
2. **Premier commit** incluant le `base.txt` actuel (préservation du mockup de référence).
3. **Création d'un repo GitHub** `synthcamp` (private), push de `main`.
4. **Connexion Railway au repo GitHub** pour preview deploys automatiques par PR.
5. **Projet Railway vide créé** avec le service Next.js en attente (build command `pnpm build`, start `pnpm start`).

Ces étapes doivent figurer explicitement dans le plan d'implémentation comme la première milestone.

## 3. Scope

### Inclus dans la Foundation

- Conversion du mockup monolithique en projet Next.js 15 (App Router) structuré.
- Design-system extrait en composants réutilisables.
- Routing par URL pour les modes et tabs (source de vérité).
- Portage du 3D background en React Three Fiber.
- Pipeline dev/build/deploy sur Railway.
- Outillage : ESLint, Prettier, Vitest (installés, pas de tests écrits).
- Stubs Supabase et variables d'env R2 (non connectés).
- Layout mobile-first, espace réservé pour futur player bar.
- Pages `not-found.tsx` et `error.tsx` au look SynthCamp (glass-panel + logo + CTA retour), pas les défauts Next.
- Correctifs a11y portés dès maintenant (voir § 5.5).

### Exclus de la Foundation

- Backend, auth, base de données.
- Lecture audio réelle et player fonctionnel.
- Stripe, payouts, commerce.
- Sound Rooms temps réel.
- Système de Creative Credits côté UI (le slider du mockup est relabellisé « Creative Credits — coming soon » mais reste non-fonctionnel ; le vrai design passe en phase 2).
- Tests métier (l'infra Vitest est prête, les tests commencent phase 2).
- Analytics, monitoring, Sentry.
- Multilingue, thème clair, SSR pour SEO (phase 2+).

### Livrable

`pnpm dev` lance une UI visuellement alignée avec `base.txt` (aux correctifs a11y près), avec navigation par URL fonctionnelle (bookmark, refresh, back button), déployée en preview sur Railway.

## 4. Stack technique

| Couche | Choix | Raison synthétique |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | SSR/SEO anticipés, écosystème auth/image/Stripe, Railway-compatible |
| Langage | TypeScript strict | Standard pour projet de cette taille |
| Package manager | pnpm | Rapide, économe en disque |
| Runtime | Node 22 LTS | Requis par Next 15 |
| Styling | Tailwind CSS v4 (CSS-first config) | Version courante, migration naturelle des tokens du mockup |
| Composants | Radix UI primitives + Tailwind custom | Accessibilité des composants complexes + contrôle total du look glass-morphism |
| Typographie | `next/font` local (Outfit) | Remplace le CDN Google Fonts, améliore LCP |
| Icônes | Lucide React | Tree-shakable, cohérent avec les SVG inline actuels |
| 3D | `@react-three/fiber` + `@react-three/drei` | Three.js déclaratif, extensible pour visualisations futures |
| Tests | Vitest + Testing Library | Moderne, compatible Vite/Next |
| Lint | ESLint (config Next) | Standard |
| Format | Prettier + `prettier-plugin-tailwindcss` | Tri auto des classes Tailwind |
| Déploiement front | Railway | Preview par PR, même projet que les futurs services backend |
| Backend (phase 2+) | Supabase **self-host** sur Railway | Les 2 slots Supabase Cloud free de l'utilisateur sont occupés ; self-host accepté comme dette tech |
| Storage audio (phase 3+) | Cloudflare R2 | Egress gratuit, ~5-10× moins cher que S3/Supabase pour streaming |

## 5. Architecture

### 5.1 Principe général

Single Next.js app en App Router. Tout est rendu côté client (`'use client'` par défaut) en Foundation — aucun data fetching réel. Server Components seront introduits graduellement en phase 2 quand apparaîtra de la vraie data.

### 5.2 Arborescence

```
synthcamp/
├── app/
│   ├── layout.tsx                  # Root: Background3D, Header, Sidebar, MiniPlayer stub, pb-24 reservation
│   ├── page.tsx                    # Redirect → /explore/home
│   ├── globals.css                 # Tokens Tailwind v4 @theme + classes custom du mockup
│   ├── not-found.tsx               # 404 branded SynthCamp
│   ├── error.tsx                   # 500 branded SynthCamp
│   ├── (explore)/
│   │   ├── layout.tsx              # Layout explore (no-op initial)
│   │   ├── home/page.tsx           # Hero + releases grid + Sound Rooms section
│   │   ├── search/page.tsx         # Placeholder
│   │   └── library/page.tsx        # Placeholder
│   └── (artist)/
│       ├── layout.tsx              # Layout artist
│       ├── catalog/page.tsx        # My Music
│       ├── upload/page.tsx         # New Release (slider relabellé "Creative Credits — coming soon")
│       ├── parties/page.tsx        # Placeholder
│       └── sales/page.tsx          # Earnings
├── components/
│   ├── ui/                         # Primitives : button, glass-panel, mode-toggle, sheet, pill-badge
│   ├── layout/                     # header, sidebar, sidebar-item
│   ├── branding/                   # logo-s (SVG)
│   ├── three/                      # background-3d, blob
│   ├── visualizers/                # live-visualizer, status-timer
│   ├── catalog/                    # hero-release, release-card (releases uniquement)
│   ├── rooms/                      # sound-room-main, sound-room-compact (Sound Rooms uniquement)
│   └── player/
│       └── mini-player.tsx         # Stub renvoyant null — rempli phase 3
├── lib/
│   ├── pricing.ts                  # getPrice, getReleaseLabel
│   ├── mock-data.ts                # Releases & Sound Rooms hardcodés (temporaire)
│   ├── cn.ts                       # classNames helper
│   ├── device.ts                   # useIsLowEndDevice, usePrefersReducedMotion, useBackground3DEnabled
│   └── supabase/
│       ├── client.ts               # Stub browser client, non-connecté
│       └── server.ts               # Stub server client, non-connecté
├── public/
│   ├── fonts/                      # Outfit local
│   └── mock-covers/                # Pochettes Unsplash téléchargées en local (autonomie, ~300 KB)
├── tests/
│   └── setup.ts                    # Config Vitest
├── .env.example                    # Variables Supabase + R2 (stubs)
├── .env.local                      # Réel, gitignoré
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json                   # Strict mode
├── eslint.config.js
├── .prettierrc
├── vitest.config.ts
├── package.json
└── railway.json                    # Build + start commands
```

### 5.3 Flux de données

- **Mode (`explore` / `artist`)** : dérivé du segment de route. Toggle pill fait `router.push('/explore/home')` ou `/artist/catalog`.
- **Tab actif** : dérivé du segment suivant.
- **Releases et Sound Rooms** : importés depuis `lib/mock-data.ts`. Typés (`Release`, `SoundRoom`). Pochettes référencées par chemin local (`/mock-covers/*.jpg`). Remplacés par fetchs réels en phase 2.
- **UI state éphémère** : `useState` local aux composants (sidebar ouverte, valeur slider, hover).
- **Background3D** : reçoit `mode` via `usePathname()` dans le root layout, le passe au composant Blob qui interpole couleur + position caméra.

### 5.4 Design tokens

Les tokens du mockup migrent dans `globals.css` via directive Tailwind v4 `@theme` :

```css
@theme {
  --color-bg: #050507;
  --color-accent: #6366f1;
  --font-outfit: 'Outfit', sans-serif;
}
```

Les classes custom du mockup sont conservées dans `globals.css` :

- `.glass-panel` → `@layer components`
- `.btn-primary` → `@layer components`
- `.live-glow`, `.grain`, `.view-enter`, `.sidebar-transition` → `@layer utilities`
- Animation `wave` pour les barres du visualizer → `@keyframes` global
- Animation `fadeIn` pour transitions de vue → `@keyframes` global

Aucun theme provider. Aucun dark/light toggle — le design EST dark.

### 5.5 A11y : correctifs portés dès la Foundation

Le mockup contient des patterns inaccessibles qu'on **ne porte pas aveuglément** :

- **Viewport** : `user-scalable=no` retiré (bloque le pinch-zoom, fail WCAG 1.4.4). Le `meta viewport` Foundation est `width=device-width, initial-scale=1`.
- **Contrastes texte** : certains éléments du mockup utilisent `text-white/40` (contraste ~2.5:1, fail WCAG AA qui exige 4.5:1). Audit à passer : **remonter à `text-white/60` minimum** pour le texte informatif, `text-white/80` pour les contenus lisibles. Exception acceptée : labels purement décoratifs (lignes de séparation, compteurs très discrets).
- **Navigation clavier** : `Tab` doit parcourir tous les interactifs dans un ordre logique. Radix garantit ça pour les composants complexes. Pour le `ModeToggle` pill custom, implémenter clavier + `aria-pressed`. Pour la sidebar drawer, utiliser Radix Dialog (gère focus trap + Escape).
- **Focus visible** : `:focus-visible` avec un ring indigo (2 px, offset 2 px) sur tous les boutons, liens, inputs. Ne pas utiliser `outline: none` sans remplacement.
- **Sémantique** : `<nav>`, `<main>`, `<aside>`, `<button>` respectés. Éviter les `<div onClick>` non-interactifs.

### 5.6 Mobile-first strict

- Breakpoints Tailwind `sm/md/lg` vers le haut. Point de référence : iPhone SE 375 px.
- Touch targets ≥ 44×44 px sur tous les éléments interactifs.
- Background3D conditionnel : un hook `useBackground3DEnabled()` renvoie `false` si `prefers-reduced-motion: reduce` OU si `navigator.hardwareConcurrency < 4` OU si mobile détecté avec faible mémoire. Dans ce cas, fallback = dégradé CSS radial statique.
- Sidebar en drawer sur toutes tailles pour Foundation. Passage à sidebar permanente desktop optionnel plus tard.

### 5.7 Espace réservé pour le player

Tous les `<main>` ont `pb-24` (96 px). Un composant `<MiniPlayer />` est rendu dans le root layout mais retourne `null` en Foundation. Phase 3 remplit le composant, aucune page à retoucher.

### 5.8 Pages d'erreur

`not-found.tsx` et `error.tsx` utilisent le même shell que les pages normales (Header + Background3D) avec au centre une `glass-panel` contenant :

- Logo `LogoS`
- Message court italique uppercase (« Signal perdu » / « Fréquence introuvable »)
- CTA `Button` retour à `/explore/home`

## 6. Décisions produit portées dans la Foundation

Ces décisions ont été prises pendant le brainstorming ; certaines n'affectent pas directement le code Foundation mais le cadrent.

### Creative Credits (AI attribution)

Le produit ne « déclare » pas l'IA (framing punitif), il **célèbre le process** via des **Creative Credits** de style liner notes.

- Taxonomie DB (appliquée phase 2) : catégorie `acoustic | hybrid | ai_crafted` + tags optionnels `[melody, lyrics, vocals, arrangement, mastering, stems]` + `verification_status` pour phase 6+.
- UI Foundation : le slider du mockup reste visible mais **relabellisé « Creative Credits — coming soon »** et non-fonctionnel. Le vrai formulaire (catégorie + tags + narrative courte) est designé en début de phase 2.

### Sound Rooms — échelle hybride avec gravité sociale

- Échelle cible : 40-50 personnes par room en norme, extensible ponctuellement à plusieurs centaines.
- **Différenciateur UX** : hiérarchie d'affichage des rooms dynamique par user, priorisant les rooms où sont présents les followed/amis.
- Implique un follow graph minimal en phase 5 (prévu initialement phase 6).
- UI Foundation : les cartes Sound Room du mockup sont portées telles quelles. Le redesign intime + social passe en phase 5.

### Self-host Supabase sur Railway

Dette technique acceptée et historisée. Triggers de bascule vers Supabase Cloud Pro listés dans `memory/synthcamp-tech-debt.md`.

## 7. Critères d'acceptation

### Fonctionnels

- `pnpm dev` rend une UI alignée avec `base.txt` (aux correctifs a11y près), vérifié côte à côte.
- Navigation par URL fonctionne : `/explore/home`, `/explore/search`, `/explore/library`, `/artist/catalog`, `/artist/upload`, `/artist/parties`, `/artist/sales`. Bookmark, refresh, back button OK.
- Toggle mode Explore ↔ Artist change l'URL et l'état visuel du pill.
- Sidebar drawer ouvre/ferme correctement, avec overlay, transitions, focus trap et Escape.
- Pages `not-found` et `error` s'affichent au look SynthCamp sur URL invalide et exception.

### Qualité code

- `pnpm build` passe sans erreur TypeScript ni warning ESLint.
- `pnpm lint` et `pnpm format:check` propres.
- Déploiement Railway réussi, preview URL accessible publiquement.

### Performance

- **Objectif** : Lighthouse Performance ≥ 85 sur `/explore/home` en simulation mobile (Moto G Power).
- **Stratégie si non atteint** : élargir le critère de désactivation du Background3D (cut-off plus strict sur `hardwareConcurrency` ou `deviceMemory`), revoir la taille de la sphere (réduire segments), tree-shake R3F/drei. Le critère reste 85, la méthode s'adapte.

### A11y

- Audit de contraste passé : tout texte informatif ≥ 4.5:1 (WCAG AA).
- Navigation clavier complète : `Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape` fonctionnent sur sidebar, ModeToggle, tous les boutons.
- `:focus-visible` visible et cohérent sur tous les interactifs.
- Viewport permet le pinch-zoom (pas de `user-scalable=no`).
- Touch targets ≥ 44×44 px audités manuellement.
- Background3D respecte `prefers-reduced-motion`.

## 8. Dette technique carried

Documentée dans `memory/synthcamp-tech-debt.md` :

1. Self-host Supabase — ops à charge, triggers de bascule listés.
2. Aucun test écrit en Foundation — rattrapage dès phase 2.
3. UX Creative Credits à prototyper début phase 2.
4. Sound Rooms mockup non aligné avec l'échelle cible — redesign en phase 5.

## 9. Annexe — variables d'environnement

Contenu attendu de `.env.example` en Foundation (stubs, valeurs à remplir en phase 2 et 3) :

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

Aucune variable n'est lue en Foundation (les stubs `lib/supabase/*` n'appellent pas Supabase). Les déclarer maintenant évite à la phase 2 de revenir sur la config env.

## 10. Prochaine étape

Rédaction du plan d'implémentation détaillé (skill `superpowers:writing-plans`) : liste des tâches ordonnées, estimation, dépendances, checkpoints de validation.
