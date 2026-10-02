import { cookies } from "next/headers";
import { validAdminCookie } from "~/lib/admin-auth";
import { loadAdminData } from "~/lib/admin-data";
import { AdminLogin } from "~/components/admin/AdminLogin";
import { AdminDashboard } from "~/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

/**
 * Painel interno do dev (rota secreta /admin, senha na env ADMIN_PANEL_KEY).
 * Sem cookie válido → tela de senha. Com → dados via service role (server-only),
 * nenhum dado passa pelo client sem passar por aqui.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams?: { erro?: string };
}) {
  const cookie = cookies().get("gf_admin")?.value;
  if (!validAdminCookie(cookie)) {
    return <AdminLogin erro={searchParams?.erro === "1"} />;
  }

  try {
    const data = await loadAdminData();
    return <AdminDashboard data={data} />;
  } catch (e) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <div className="max-w-sm rounded-2xl border border-danger/40 bg-danger/[0.06] p-6 text-center">
          <p className="text-sm font-bold text-danger">Falha ao carregar os dados</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {e instanceof Error ? e.message : "Erro desconhecido"}
          </p>
        </div>
      </main>
    );
  }
}
