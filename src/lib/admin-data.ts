import { supabaseAdmin } from "~/lib/supabase/admin";
import { localDayKey, localDayStartDaysAgoISO } from "~/lib/utils/local-date";

/**
 * Carga de dados do painel interno (/admin) — só server (service role).
 * Fontes: page_views (QR dos banners), profiles (ficha dos alunos),
 * checkins, workout_logs, body_metrics e ai_generation_logs.
 */

export const BANNERS = [
  { path: "/bem-vindo", label: "Conheça o app" },
  { path: "/parceiros", label: "Parceiros" },
  { path: "/evolucao", label: "Evolução" },
  { path: "/vantagens", label: "Vantagens" },
  { path: "/day-pass", label: "Day-pass" },
] as const;

export type AdminStudent = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  approved: boolean;
  objetivo: string | null;
  nivel: string | null;
  sexo: string | null;
  plan_type: string | null;
  vencimento: string | null;
  origin: string;
  lastCheckin: string | null;
  lastWorkout: string | null;
  checkins30: number;
  workouts30: number;
  weight: number | null;
  /** ativo = teve check-in ou treino nos últimos 7 dias */
  active7: boolean;
};

export type AdminErrorGroup = {
  fingerprint: string;
  event: string;
  level: "error" | "toast";
  source: "client" | "server";
  message: string | null;
  lastPath: string | null;
  lastStack: string | null;
  lastBuild: string | null;
  lastAt: string;
  firstAt: string;
  count: number;
  count24h: number;
  users: number;
  userNames: string[];
};

export type AdminErrors = {
  /** false = tabela app_errors inacessível (migration não aplicada etc.) */
  available: boolean;
  total24h: number;
  total7d: number;
  users7d: number;
  groups: AdminErrorGroup[];
};

export type AdminData = {
  generatedAt: string;
  errors: AdminErrors;
  banners: Array<{ path: string; label: string; views: number; clicks: number; unique: number }>;
  daily: Array<{ day: string; scans: number; students: number; checkins: number; workouts: number }>;
  origins: Array<{ label: string; students: number }>;
  students: AdminStudent[];
  totals: {
    scansToday: number;
    scans7: number;
    scans30: number;
    clicks7: number;
    studentsToday: number;
    students7: number;
    students30: number;
    pendingApprovals: number;
    checkinsToday: number;
    checkins7: number;
    workouts7: number;
    aiPlans7: number;
    activeStudents7: number;
    idleStudents: number;
    expiringSoon: number;
    withPhone: number;
    avgWeight30: number | null;
  };
};

type PvRow = { path: string; kind: string; cta: string | null; visitor_id: string; user_id: string | null; created_at: string };
type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  approved_at: string | null;
  goal: string | null;
  objetivo: string | null;
  experience_level: string | null;
  sex: string | null;
  plan_type: string | null;
  vencimento: string | null;
};

const day = (n: number) => new Date(Date.now() - n * 86_400_000);
const dayKey = (iso: string) => localDayKey(iso);
const shortDay = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

export async function loadAdminData(): Promise<AdminData> {
  const sb = supabaseAdmin();

  const [pv, pend, st, chk, wl, ai, mt] = await Promise.all([
    sb.from("page_views")
      .select("path, kind, cta, visitor_id, user_id, created_at")
      .gte("created_at", day(30).toISOString())
      .limit(5000),
    sb.from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student")
      .is("approved_at", null),
    sb.from("profiles")
      .select(
        "id, name, email, phone, created_at, approved_at, goal, objetivo, experience_level, sex, plan_type, vencimento"
      )
      .eq("role", "student")
      .order("created_at", { ascending: false })
      .limit(500),
    sb.from("checkins")
      .select("student_id, checked_at")
      .gte("checked_at", localDayStartDaysAgoISO(30))
      .limit(8000),
    sb.from("workout_logs")
      .select("student_id, date")
      .gte("date", localDayStartDaysAgoISO(30))
      .limit(8000),
    sb.from("ai_generation_logs")
      .select("created_at")
      .gte("created_at", day(14).toISOString())
      .limit(2000),
    sb.from("body_metrics")
      .select("student_id, recorded_at, weight_kg")
      .gte("recorded_at", day(180).toISOString())
      .order("recorded_at", { ascending: false })
      .limit(2000),
  ]);

  const firstError = pv.error ?? pend.error ?? st.error ?? chk.error ?? wl.error ?? ai.error ?? mt.error;
  if (firstError) throw new Error(`Falha ao ler dados do painel: ${firstError.message}`);

  const views = (pv.data ?? []) as PvRow[];
  const profiles = (st.data ?? []) as ProfileRow[];
  const checkins = (chk.data ?? []) as { student_id: string; checked_at: string }[];
  const logs = (wl.data ?? []) as { student_id: string; date: string }[];
  const aiLogs = (ai.data ?? []) as { created_at: string }[];
  const metrics = (mt.data ?? []) as { student_id: string; recorded_at: string; weight_kg: number | null }[];

  const only = (kind: string) => views.filter((v) => v.kind === kind);
  const scanRows = only("view");
  const clickRows = only("click");
  const signupRows = only("signup");

  // banners (30d): visitas, cliques e visitantes únicos por QR
  const banners = BANNERS.map((b) => {
    const v = scanRows.filter((r) => r.path === b.path);
    return {
      path: b.path,
      label: b.label,
      views: v.length,
      clicks: clickRows.filter((r) => r.path === b.path).length,
      unique: new Set(v.map((r) => r.visitor_id)).size,
    };
  });

  // origem: primeiro banner visto pelo mesmo dispositivo (visitor_id)
  // antes do cadastro; ligamos signup.user_id → aluno
  const firstView = new Map<string, string>();
  for (const v of scanRows) if (!firstView.has(v.visitor_id)) firstView.set(v.visitor_id, v.path);
  const bannerLabel = (path?: string) =>
    (path && BANNERS.find((b) => b.path === path)?.label) || null;
  const originByUser = new Map<string, string>();
  for (const s of signupRows) {
    if (s.user_id && !originByUser.has(s.user_id)) {
      originByUser.set(s.user_id, bannerLabel(firstView.get(s.visitor_id)) ?? "Direto (sem banner)");
    }
  }
  const originCount = new Map<string, number>();
  for (const s of signupRows) {
    const banner = firstView.get(s.visitor_id);
    const label = banner ? bannerLabel(banner) ?? banner : "Direto (sem banner)";
    originCount.set(label, (originCount.get(label) ?? 0) + 1);
  }
  const origins = [...originCount.entries()]
    .map(([label, students]) => ({ label, students }))
    .sort((a, b) => b.students - a.students);

  // ficha por aluno: atividade (check-ins/treinos), peso e origem
  const since7 = Date.now() - 7 * 86_400_000;
  const weightByUser = new Map<string, number>();
  for (const m of metrics) {
    if (m.weight_kg && !weightByUser.has(m.student_id)) weightByUser.set(m.student_id, m.weight_kg);
  }

  const students: AdminStudent[] = profiles.map((p) => {
    const myCheckins = checkins.filter((c) => c.student_id === p.id);
    const myLogs = logs.filter((l) => l.student_id === p.id);
    const lastCheckin = myCheckins.map((c) => c.checked_at).sort().at(-1) ?? null;
    const lastWorkout = myLogs.map((l) => l.date).sort().at(-1) ?? null;
    const active7 =
      (!!lastCheckin && new Date(lastCheckin).getTime() >= since7) ||
      (!!lastWorkout && new Date(lastWorkout + "T12:00:00").getTime() >= since7);
    return {
      id: p.id,
      name: p.name?.trim() || "Sem nome",
      email: p.email ?? "",
      phone: p.phone,
      created_at: p.created_at,
      approved: !!p.approved_at,
      objetivo: p.objetivo || p.goal,
      nivel: p.experience_level,
      sexo: p.sex,
      plan_type: p.plan_type,
      vencimento: p.vencimento,
      origin: originByUser.get(p.id) ?? "—",
      lastCheckin,
      lastWorkout,
      checkins30: myCheckins.length,
      workouts30: myLogs.length,
      weight: weightByUser.get(p.id) ?? null,
      active7,
    };
  });

  // série diária (14 dias)
  const daily = [] as AdminData["daily"];
  for (let i = 13; i >= 0; i--) {
    const d = day(i);
    const key = dayKey(d.toISOString());
    daily.push({
      day: shortDay(d.toISOString()),
      scans: scanRows.filter((r) => dayKey(r.created_at) === key).length,
      students: profiles.filter((s) => dayKey(s.created_at) === key).length,
      checkins: checkins.filter((c) => dayKey(c.checked_at) === key).length,
      workouts: logs.filter((l) => dayKey(l.date) === key).length,
    });
  }

  const since = (n: number) => Date.now() - n * 86_400_000;
  const last7 = (iso: string) => new Date(iso).getTime() >= since(7);
  const todayKey = dayKey(new Date().toISOString());
  const soon = Date.now() + 7 * 86_400_000;
  const weights = [...weightByUser.values()];

  const errors = await loadErrors(profiles);

  return {
    generatedAt: new Date().toISOString(),
    errors,
    banners,
    daily,
    origins,
    students,
    totals: {
      scansToday: scanRows.filter((r) => dayKey(r.created_at) === todayKey).length,
      scans7: scanRows.filter((r) => last7(r.created_at)).length,
      scans30: scanRows.length,
      clicks7: clickRows.filter((r) => last7(r.created_at)).length,
      studentsToday: profiles.filter((s) => dayKey(s.created_at) === todayKey).length,
      students7: profiles.filter((s) => last7(s.created_at)).length,
      students30: profiles.length,
      pendingApprovals: pend.count ?? 0,
      checkinsToday: checkins.filter((c) => dayKey(c.checked_at) === todayKey).length,
      checkins7: checkins.filter((c) => last7(c.checked_at)).length,
      workouts7: logs.filter((l) => last7(l.date)).length,
      aiPlans7: aiLogs.filter((a) => last7(a.created_at)).length,
      activeStudents7: new Set([
        ...checkins.filter((c) => last7(c.checked_at)).map((c) => c.student_id),
        ...logs.filter((l) => last7(l.date)).map((l) => l.student_id),
      ]).size,
      idleStudents: students.filter((s) => s.approved && !s.active7).length,
      // Vencimento é autoinformado pelo aluno: data no passado não conta como
      // "vence em 7 dias" (evita alerta falso no painel do admin).
      expiringSoon: students.filter((s) => {
        if (!s.vencimento) return false;
        const t = new Date(s.vencimento + "T12:00:00").getTime();
        return t >= Date.now() && t <= soon;
      }).length,
      withPhone: students.filter((s) => !!s.phone).length,
      avgWeight30: weights.length > 0 ? Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10 : null,
    },
  };
}

type ErrorRow = {
  created_at: string;
  source: "client" | "server";
  level: "error" | "toast";
  event: string;
  message: string | null;
  stack: string | null;
  path: string | null;
  user_id: string | null;
  build: string | null;
  fingerprint: string;
};

/** Erros dos últimos 7 dias agrupados por fingerprint (mais recentes no topo). */
async function loadErrors(profiles: ProfileRow[]): Promise<AdminErrors> {
  const empty: AdminErrors = { available: false, total24h: 0, total7d: 0, users7d: 0, groups: [] };
  try {
    const sb = supabaseAdmin() as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          gte: (c: string, v: string) => {
            order: (c: string, o: { ascending: boolean }) => {
              limit: (n: number) => PromiseLike<{ data: ErrorRow[] | null; error: { message: string } | null }>;
            };
          };
        };
      };
    };
    const { data, error } = await sb
      .from("app_errors")
      .select("created_at, source, level, event, message, stack, path, user_id, build, fingerprint")
      .gte("created_at", day(7).toISOString())
      .order("created_at", { ascending: false })
      .limit(3000);
    if (error) return empty;

    const rows = data ?? [];
    const names = new Map(profiles.map((p) => [p.id, p.name ?? p.email ?? "aluno"]));
    const since24 = Date.now() - 86_400_000;
    const groups = new Map<string, AdminErrorGroup & { ids: Set<string> }>();

    for (const r of rows) {
      let g = groups.get(r.fingerprint);
      if (!g) {
        // rows vêm do mais novo pro mais velho: o 1º é o "último visto"
        g = {
          fingerprint: r.fingerprint,
          event: r.event,
          level: r.level,
          source: r.source,
          message: r.message,
          lastPath: r.path,
          lastStack: r.stack,
          lastBuild: r.build,
          lastAt: r.created_at,
          firstAt: r.created_at,
          count: 0,
          count24h: 0,
          users: 0,
          userNames: [],
          ids: new Set(),
        };
        groups.set(r.fingerprint, g);
      }
      g.count++;
      g.firstAt = r.created_at;
      if (new Date(r.created_at).getTime() >= since24) g.count24h++;
      if (r.user_id) g.ids.add(r.user_id);
    }

    const list = [...groups.values()].map(({ ids, ...g }) => ({
      ...g,
      users: ids.size,
      userNames: [...ids].map((id) => names.get(id) ?? "equipe").slice(0, 5),
    }));
    // erros de verdade antes de avisos; depois quem afetou mais gente
    list.sort(
      (a, b) =>
        Number(b.count24h > 0) - Number(a.count24h > 0) ||
        Number(a.level === "toast") - Number(b.level === "toast") ||
        b.users - a.users ||
        b.count - a.count
    );

    return {
      available: true,
      total24h: rows.filter((r) => new Date(r.created_at).getTime() >= since24).length,
      total7d: rows.length,
      users7d: new Set(rows.map((r) => r.user_id).filter(Boolean)).size,
      groups: list.slice(0, 40),
    };
  } catch {
    return empty;
  }
}
