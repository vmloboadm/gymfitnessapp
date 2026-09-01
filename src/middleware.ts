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
const STAFF_SHARED_PATHS = [
  "/alunos",
  "/equipamentos",
  "/treinos",
];

const HOME_BY_ROLE: Record<string, string> = {
  student: STUDENT_PATHS[0],
  trainer: "/alunos",
  manager: "/dashboard",
};

function pathAllowed(role: string | undefined, pathname: string): string | null {
  // rotas públicas sempre liberadas aqui; a não-auth já foi tratada
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

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

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Modo demo (NEXT_PUBLIC_DEMO_MODE=1): pula auth e deixa testar todas as telas.
  // A raiz abre no LOGIN; após entrar pelo login de teste (cookie gf_test),
  // a raiz vira o DASHBOARD normal do papel.
  // ISOLAMENTO: o papel vem do cookie gf_role (setado no login de teste) e o
  // mesmo pathAllowed de produção é aplicado — aluno NÃO acessa área do personal.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "1") {
    if (request.nextUrl.pathname === "/" && !request.cookies.get("gf_test")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (request.cookies.get("gf_test")) {
      const demoRole = request.cookies.get("gf_role")?.value ?? "student";
      const redirectTo = pathAllowed(demoRole, request.nextUrl.pathname);
      if (redirectTo) {
        return NextResponse.redirect(new URL(redirectTo, request.url));
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
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!p) return NextResponse.redirect(new URL("/onboarding", request.url));
    return NextResponse.redirect(new URL(HOME_BY_ROLE[p.role] ?? "/", request.url));
  }

  // Sem login e em rota protegida → login com next param
  if (!user && !PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (pathname === "/" ) {
      // home raiz: landing ou redirect p/ login
      return NextResponse.next();
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: p } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    // Falta profile → force onboarding
    if (!p && !pathname.startsWith("/onboarding")) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    // Role check
    const redirectTo = pathAllowed(p?.role, pathname);
    if (redirectTo) {
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|sounds|icons|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3)$).*)",
  ],
};