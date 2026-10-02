import { supabaseAdmin } from "~/lib/supabase/admin";

/**
 * Carga de dados do painel interno (/admin) — só server (service role).
 * Fontes: page_views (QR dos banners), profiles (alunos), checkins,
 * workout_logs e ai_generation_logs. Tudo das últimas 2-4 semanas.
 */

export const BANNERS = [
  { path: "/bem-vindo", label: "Conheça o app" },
  { path: "/parceiros", label: "Parceiros" },
  { path: "/evolucao", label: "Evolução" },
  { path: "/vantagens", label: "Vantagens" },
  { path: "/day-pass", label: "Day-pass" },
] as const;

export type AdminData = {
  generatedAt: string;
  banners: Array<{ path: string; label: string; views: number; clicks: number; unique: number }>;
  daily: Array<{ day: string; scans: number; students: number; checkins: number; workouts: number }>;
  origins: Array<{ label: string; students: number }>;
  recent: Array<{ name: string; email: string; created_at: string; approved: boolean }>;
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
  };
};

type PvRow = { path: string; kind: string; cta: string | null; visitor_id: string; user_id: string | null; created_at: string };
type ProfileRow = { id: string; name: string | null; email: string | null; created_at: string; approved_at: string | null };

const day = (n: number) => new Date(Date.now() - n * 86_400_000);
const dayKey = (iso: string) => iso.slice(0, 10);
const shortDay = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

export async function loadAdminData(): Promise<AdminData> {
  const sb = supabaseAdmin();

  const [pv, pend, st, chk, wl, ai] = await Promise.all([
    sb.from("page_views")
      .select("path, kind, cta, visitor_id, user_id, created_at")
      .gte("created_at", day(30).toISOString())
      .limit(5000),
    sb.from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student")
      .is("approved_at", null),
    sb.from("profiles")
      .select("id, name, email, created_at, approved_at")
      .eq("role", "student")
      .gte("created_at", day(30).toISOString())
      .order("created_at", { ascending: false })
      .limit(2000),
    sb.from("checkins")
      .select("student_id, checked_at")
      .gte("checked_at", day(14).toISOString())
      .limit(8000),
    sb.from("workout_logs")
      .select("student_id, date")
      .gte("date", day(14).toISOString().slice(0, 10))
      .limit(8000),
    sb.from("ai_generation_logs")
      .select("created_at")
      .gte("created_at", day(14).toISOString())
      .limit(2000),
  ]);

  const firstError = pv.error ?? pend.error ?? st.error ?? chk.error ?? wl.error ?? ai.error;
  if (firstError) throw new Error(`Falha ao ler dados do painel: ${firstError.message}`);

  const views = (pv.data ?? []) as PvRow[];
  const students = (st.data ?? []) as ProfileRow[];
  const checkins = (chk.data ?? []) as { student_id: string; checked_at: string }[];
  const logs = (wl.data ?? []) as { date: string; student_id: string }[];
  const aiLogs = (ai.data ?? []) as { created_at: string }[];

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

  // origem dos alunos novos (30d): primeiro banner visto pelo mesmo
  // dispositivo (visitor_id) antes do cadastro
  const firstView = new Map<string, string>();
  for (const v of scanRows) if (!firstView.has(v.visitor_id)) firstView.set(v.visitor_id, v.path);
  const originCount = new Map<string, number>();
  for (const s of signupRows) {
    const banner = firstView.get(s.visitor_id);
    const label = banner ? BANNERS.find((b) => b.path === banner)?.label ?? banner : "Direto (sem banner)";
    originCount.set(label, (originCount.get(label) ?? 0) + 1);
  }
  const origins = [...originCount.entries()]
    .map(([label, students]) => ({ label, students }))
    .sort((a, b) => b.students - a.students);

  // série diária (14 dias)
  const daily = [] as AdminData["daily"];
  for (let i = 13; i >= 0; i--) {
    const d = day(i);
    const key = dayKey(d.toISOString());
    daily.push({
      day: shortDay(d.toISOString()),
      scans: scanRows.filter((r) => dayKey(r.created_at) === key).length,
      students: students.filter((s) => dayKey(s.created_at) === key).length,
      checkins: checkins.filter((c) => dayKey(c.checked_at) === key).length,
      workouts: logs.filter((l) => dayKey(l.date) === key).length,
    });
  }

  const since = (n: number) => Date.now() - n * 86_400_000;
  const last7 = (iso: string) => new Date(iso).getTime() >= since(7);
  const todayKey = dayKey(new Date().toISOString());

  const recent = students.slice(0, 8).map((s) => ({
    name: s.name?.trim() || "Sem nome",
    email: s.email ?? "",
    created_at: s.created_at,
    approved: !!s.approved_at,
  }));

  return {
    generatedAt: new Date().toISOString(),
    banners,
    daily,
    origins,
    recent,
    totals: {
      scansToday: scanRows.filter((r) => dayKey(r.created_at) === todayKey).length,
      scans7: scanRows.filter((r) => last7(r.created_at)).length,
      scans30: scanRows.length,
      clicks7: clickRows.filter((r) => last7(r.created_at)).length,
      studentsToday: students.filter((s) => dayKey(s.created_at) === todayKey).length,
      students7: students.filter((s) => last7(s.created_at)).length,
      students30: students.length,
      pendingApprovals: pend.count ?? 0,
      checkinsToday: checkins.filter((c) => dayKey(c.checked_at) === todayKey).length,
      checkins7: checkins.filter((c) => last7(c.checked_at)).length,
      workouts7: logs.filter((l) => last7(l.date)).length,
      aiPlans7: aiLogs.filter((a) => last7(a.created_at)).length,
      activeStudents7: new Set([
        ...checkins.filter((c) => last7(c.checked_at)).map((c) => c.student_id),
        ...logs.filter((l) => last7(l.date)).map((l) => l.student_id),
      ]).size,
    },
  };
}
