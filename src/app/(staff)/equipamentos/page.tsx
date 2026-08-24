"use client";

import { MapPin, Wrench, Plus } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { supabaseBrowser } from "~/lib/supabase/client";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import { isDemoMode, demoFallback } from "~/lib/demo-bridge";
import type { Equipment, EquipmentMaintenanceLogs } from "~/lib/types/models";

/**
 * Gestão de equipamentos (staff shared, personal e gestor).
 * Lista com status e pedidos de manutenção ativos.
 */
export default function EquipamentosPage() {
  const { user, profile } = useAuth();
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery<{
    equipment: Equipment[];
    maintenance: EquipmentMaintenanceLogs[];
  }>(
    async () => {
      if (demo) {
        return {
          data: {
            equipment: demoFallback("equipment") as Equipment[],
            maintenance: [
              {
                id: "mt-1", gym_id: "1", equipment_id: "eq-demo-008", requested_by: "u1",
                reason: "Eixo com folga e ruído", status: "open",
                created_at: new Date().toISOString(), resolved_at: null,
              },
            ] as EquipmentMaintenanceLogs[],
          },
          error: null,
        };
      }

      const supabase = supabaseBrowser();
      if (!profile) return { data: null, error: { message: "Perfil indisponível" } };

      const eqRes = await supabase
        .from("equipment")
        .select("*")
        .eq("gym_id", profile.gym_id)
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (eqRes.error) return { data: null, error: eqRes.error };

      const mtRes = await supabase
        .from("equipment_maintenance_logs")
        .select("*")
        .eq("gym_id", profile.gym_id)
        .neq("status", "resolved");
      if (mtRes.error) return { data: null, error: mtRes.error };

      return {
        data: {
          equipment: (eqRes.data ?? []) as Equipment[],
          maintenance: (mtRes.data ?? []) as EquipmentMaintenanceLogs[],
        },
        error: null,
      };
    },
    [profile?.id, demo]
  );

  const markMaintenance = async (id: string) => {
    if (demo) {
      toast.success("Chamado de manutenção aberto (demo)");
      return;
    }
    if (!user || !profile) return;
    const { error } = await supabaseBrowser()
      .from("equipment_maintenance_logs")
      .insert({
        gym_id: profile.gym_id,
        equipment_id: id,
        requested_by: user.id,
        reason: "Manutenção preventiva",
        status: "open" as const,
      } as never);
    if (error) {
      toast.error("Falha ao abrir manutenção", { description: error.message });
      return;
    }
    toast.success("Manutenção registrada");
    refetch();
  };

  const statusLabel: Record<Equipment["status"], string> = {
    available: "Livre",
    in_use: "Em uso",
    maintenance: "Manutenção",
  };

  return (
    <>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">Equipamentos</h1>
            <p className="text-xs text-muted-foreground">
              {data?.equipment.length ?? 0} cadastrados · {data?.maintenance.length ?? 0} em manutenção
            </p>
          </div>
          <Button size="sm">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Novo
          </Button>
        </div>

        {loading ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : data?.equipment.length === 0 ? (
          <EmptyState
            title="Nenhum equipamento cadastrado"
            description="Cadastre máquinas e pesos para aparecerem no app dos alunos."
            icon={MapPin}
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {data?.equipment.map((e) => (
              <div key={e.id} className="rounded-xl border border-border bg-card/40 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{e.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {e.category} · cap. {e.capacity}
                    </p>
                  </div>
                  <Badge variant={e.status === "available" ? "success" : e.status === "in_use" ? "default" : "warning"}>
                    {statusLabel[e.status]}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {e.nfc_tag_url ? (
                    <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">NFC</span>
                  ) : null}
                  {e.qr_url ? (
                    <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">QR</span>
                  ) : null}
                  {data.maintenance.some((m) => m.equipment_id === e.id) ? (
                    <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warning">
                      <Wrench className="h-3 w-3" />
                      Manutenção
                    </span>
                  ) : null}
                  <div className="ml-auto">
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => markMaintenance(e.id)}>
                      Abrir manutenção
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
