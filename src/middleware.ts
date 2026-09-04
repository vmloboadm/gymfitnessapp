import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "~/lib/types/database";

/**
 * Middleware autenticação + role check (blueprint §2).
 * Nota: rotas de grupo ((app), (trainer), (admin)) são organizacionais no
 * Next.js App Router, não aparecem na URL. Por isso mapeamos os paths reais.
 */

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/day-pass",
];

/** Prefijos por área (paths de fato, sem duplicação de grupo). */
const STUDENT_PATHS = [
  "/treino",
  "/checkin",
  "/equipamento",
  "/progresso",
  "/metricas",
  "/feed",
  "/ranking",
  "/squads",
  "/conquistas",
  "/playlist",
  "/premium",
  "/perfil",
  "/notificacoes",
];

/** Áreas exclusivas do personal (o gestor também pode ver alunos/equipamentos). */
const TRAINER_ONLY_PATHS = [
  "/biblioteca",
  "/ia",
];

/** Áreas exclusivas do gestor/admin. */
const MANAGER_ONLY_PATHS = [
  "/dashboard",
  "/personais",
  "/matriculas",
  "/financeiro",
  "/relatorios",
  "/feed-moderacao",
];

/** Compartilhadas entre trainer e manager. */
/** Rotas legadas da área do personal: todos caem no novo endereço. */
const LEGACY_REDIRECTS: Record<string, string> = {
  "/alunos": "/personal/alunos",
  "/treinos": "/personal/treinos",
  "/biblioteca": "/personal/exercicios",
  "/ia": "/personal/treinos",
};

const STAFF_SHARED_PATHS = ["/personal"];

const HOME_BY_ROLE: Record<string, string> = {
  student: STUDENT_PATHS[0],
  trainer: "/personal/dashboard",
  manager: "/dashboard",
};

function pathAllowed(role: string | undefined, pathname: string): string | null {
  // rotas públicas sempre liberadas aqui; a não-auth já foi tratada
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  // Rotas antigas do personal viram redirect permanente pro novo endereço
  const legacy = LEGACY_REDIRECTS[pathname];
  if (legacy) return legacy;

  // Raiz: aluno fica, staff cai na home da própria área (nunca na home do aluno)
  if (pathname === "/") {
    if (!role || role === "student") return null;
    return HOME_BY_ROLE[role] ?? "/";
  }

  const onBoarding = pathname.startsWith("/onboarding");
  if (onBoarding) return null;

  // Conteúdo compartilhado entre aluno, personal e gestor (mesmo feed e ranking nas 3 áreas)
  if (pathname === "/feed" || pathname.startsWith("/feed/") || pathname === "/ranking") {
    return null;
  }

  if (STUDENT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return role === "student" ? null : HOME_BY_ROLE[role ?? "student"] ?? "/login";
  }
  if (TRAINER_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (role === "trainer") return null;
    return HOME_BY_ROLE[role ?? "student"] ?? "/login";
  }
  if (MANAGER_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (role === "manager" || role === "admin") return null;
    return HOME_BY_ROLE[role ?? "student"] ?? "/login";
  }
  if (STAFF_SHARED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (role === "trainer" || role === "manager" || role === "admin") return null;
    return HOME_BY_ROLE[role ?? "student"] ?? "/login";
  }

  // fallback: rotas sem área definida (dashboard raiz), libera logado
  return null;
}

/**
 * Redirect basePath-safe: clona nextUrl e troca o pathname.
 * new URL("/x", request.url) PERDE o basePath /app no deploy → 404.
 * O clone preserva: Next re-adiciona o basePath ao serializar.
 */
function redirectTo(request: NextRequest, path: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = path;
  return NextResponse.redirect(url);
}

function redirectToWithNext(request: NextRequest, path: string, next: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Modo demo (NEXT_PUBLIC_DEMO_MODE=1): pula auth e deixa testar todas as telas.
  // A raiz abre no LOGIN; após entrar pelo login de teste (cookie gf_test),
  // a raiz vira o DASHBOARD normal do papel.
  // ISOLAMENTO: o papel vem do cookie gf_role (setado no login de teste) e o
  // mesmo pathAllowed de produção é aplicado — aluno NÃO acessa área do personal.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "1") {
    if (request.nextUrl.pathname === "/" && !request.cookies.get("gf_test")) {
      return redirectTo(request, "/login");
    }
    if (request.cookies.get("gf_test")) {
      const demoRole = request.cookies.get("gf_role")?.value ?? "student";
      const redirectToPath = pathAllowed(demoRole, request.nextUrl.pathname);
      if (redirectToPath) {
        return redirectTo(request, redirectToPath);
      }
    }
    return response;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Logado em rotas de auth → home da role (ou onboarding se sem profile)
  if (user && (pathname === "/login" || pathname === "/register" || pathname === "/forgot-password")) {
    const { data: p } = await supabase
      .from("profiles")
      .select("role, onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();

    if (!p) return redirectTo(request, "/onboarding");
    if (p.role === "student" && !p.onboarding_completed) {
      return redirectTo(request, "/onboarding");
    }
    return redirectTo(request, HOME_BY_ROLE[p.role] ?? "/");
  }

  // Sem login e em rota protegida → login com next param
  if (!user && !PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (pathname === "/") {
      // produção: visitante não vê a home do aluno — vai pro login
      return redirectTo(request, "/login");
    }
    return redirectToWithNext(request, "/login", pathname);
  }

  if (user) {
    const { data: p } = await supabase
      .from("profiles")
      .select("role, onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();

    // Falta profile → force onboarding
    if (!p && !pathname.startsWith("/onboarding")) {
      return redirectTo(request, "/onboarding");
    }

    // Aluno com onboarding incompleto → força onboarding
    if (p && p.role === "student" && !p.onboarding_completed && !pathname.startsWith("/onboarding")) {
      return redirectTo(request, "/onboarding");
    }

    // Role check
    const redirectToPath = pathAllowed(p?.role, pathname);
    if (redirectToPath) {
      return redirectTo(request, redirectToPath);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|sounds|icons|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3)$).*)",
  ],
};