# GymFitness-app — Checkpoint Fase 1 (Fundação)

> Data: 2026-08-17 | Local atual: `/root/.hermes/home/.hermes/gym-app` (alvo SSHFS)
> Estado: **DoD da Fase 1 atendido** — `npx tsc --noEmit` = 0 erros | `npm run build` = OK

## Stack
Next.js 14.2.35 App Router, TS, Tailwind v3, shadcn/ui-style, Supabase (client/server/admin), React Query, lucide-react, recharts, sonner, html5-qrcode. Cores: navy `#0B1426` + orange `#F26522`.

## Como chegamos aqui (até o DoD)
1. Scaffold Next 14 + git init + deps.
2. Migrations 001-005 (30 tabelas + RLS + triggers + seeds) em `supabase/migrations/`.
3. Libs: supabase (3 clientes), utils (cn/roles/format/calculations), types (enums/models/database).
4. Hooks: useAuth, useRealtime, useOnlineCount, useLocalStorage, useOfflineQueue, useNotifications.
5. Auth LGPD + onboarding 5 passos (salvo incremental, trava clínica) + layouts por role + PWA (manifest/sw/icons).

## Correções do typecheck (causa raiz do `never`)
1. `models.ts`: import `Role` → `~/lib/utils/roles` (estava apontando p/ `./enums`).
2. **31 interfaces → type aliases** em `models.ts`: interfaces não satisfazem `Record<string, unknown>` (sem index signature implícita) → resolvedor de tipos do supabase-js devolvia `never` em `.select("col")`. (É por isso que `supabase gen types` gera type aliases.)
3. `@supabase/ssr` 0.5.2 (3 generics) incompatível com `supabase-js` 2.112.3 (5 generics) → atualizado p/ **ssr 0.12.4**.
4. `RowTables` em `database.ts`: `Insert: T`, `Update: Partial<T>`, `Relationships: []`.
5. `tsconfig.json`: adicionado `"target": "ES2017"` (Set iteration em `calculations.ts`).
6. `tailwind.config.ts`: keyframes+animation `skeleton-shimmer`, `live-ping`, `fade-in-up`, `glow` (o CSS usava `@apply animate-skeleton-shimmer` sem token).
7. Lint: removidos imports mortos (LoginForm/RegisterForm/MedicalRestrictionForm/ProfileBasicForm); `InputProps`/`TextareaProps` → type aliases; `Sidebar` icon → `LucideIcon`.

## Próximos passos (pré-decísão de merge)
1. Preencher `.env.local` com credenciais reais do Supabase e rodar `npm run db:migrate`.
2. Rerodar `npm run build` como verificação final.
3. Gerar tipos reais com `supabase gen types typescript` e eliminar o `RowTables` manual.

## Decisão de merge (2026-08-17) — CONCLUÍDO
- **Mantido**: projeto Next (este). **Descartado**: projeto Vite do outro agente (não compilava; só esqueleto + tela de template).
- **Aproveitado do outro**: credenciais reais do Supabase (URL `https://jeixbpucnxrhizqpapyv.supabase.co` + anon key `sb_publishable_...`) agora no `.env.local`.
- **Backup do outro** em `_backup_outro_agente/` (dentro deste repo): `schema_stackgym.sql`, `identity/`, `supabase/`, `env_real_supabase.local`.
- **Movido para o alvo**: `/root/.hermes/home/.hermes/gym-app` (rsync + npm install + typecheck 0 + build OK). Cópia antiga em `/root/GymFitness-app` removida.

## Próximos passos (pré-decísão de merge)
1. Preencher `.env.local` com credenciais reais do Supabase e rodar `npm run db:migrate`. ✅ credenciais plugadas — **pendente: rodar db:migrate**
2. Rerodar `npm run build` como verificação final. ✅ (feito no novo local)
3. Gerar tipos reais com `supabase gen types typescript` e eliminar o `RowTables` manual.