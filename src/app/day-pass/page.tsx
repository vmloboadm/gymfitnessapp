"use client";

import { useState } from "react";
import { ScanLine, QrCode, Ticket } from "lucide-react";
import { supabaseBrowser } from "~/lib/supabase/client";
import { GymLogo } from "~/components/layout/GymLogo";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { toast } from "sonner";
import { formatDate } from "~/lib/utils/format";
import type { DayPasses } from "~/lib/types/models";

/**
 * Day-pass público (blueprint day-pass): compra avulsa de acesso diário.
 * Público por design, o middleware já libera /day-pass sem login.
 */
export default function DayPassPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [buying, setBuying] = useState(false);

  // lista day-passes do usuário (query sem filtro é no futuro: precisa do gym ativo)
  const { data, loading, error, refetch } = useAsyncQuery<DayPasses[]>(
    async () => {
      const { data, error } = await supabaseBrowser()
        .from("day_passes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return { data: null, error };
      return { data: data as DayPasses[], error: null };
    },
    []
  );

  const buy = async () => {
    if (!name.trim()) {
      toast.error("Informe seu nome");
      return;
    }
    setBuying(true);
    const gymRes = await supabaseBrowser().from("gyms").select("id").limit(1).maybeSingle();
    const gymId = gymRes.data?.id ?? "00000000-0000-0000-0000-000000000001";
    const { error } = await supabaseBrowser()
      .from("day_passes")
      .insert({
        gym_id: gymId,
        code: `DP-${Date.now().toString(36).toUpperCase()}`,
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        status: "active" as const,
        expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
      } as never);
    setBuying(false);
    if (error) {
      toast.error("Falha ao gerar day-pass", { description: error.message });
      return;
    }
    toast.success("Day-pass gerado. Apresente o código na recepção.");
    setEmail("");
    setPhone("");
    refetch();
  };

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <div className="flex flex-col items-center gap-3 pt-6">
        <GymLogo className="h-14 w-14" />
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Day-pass</h1>
          <p className="text-sm text-muted-foreground">
            Treine hoje, pague avulso. Válido por 24h.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Ticket className="h-4 w-4 text-brand" />
          <p className="text-sm font-semibold text-foreground">Seus day-passes</p>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-16 rounded-lg bg-card/40" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : data?.length === 0 ? (
          <EmptyState
            title="Nenhum day-pass ainda"
            description="Compre um abaixo e apresente o código na recepção."
            icon={QrCode}
          />
        ) : (
          <div className="space-y-2">
            {data?.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">{p.code}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.name} · expira {formatDate(p.expires_at)}
                  </p>
                </div>
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-success">
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Comprar acesso</p>
        <div className="space-y-2">
          <Label htmlFor="dp-name">Nome completo</Label>
          <Input id="dp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="dp-email">E-mail (opcional)</Label>
            <Input id="dp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dp-phone">Telefone (opcional)</Label>
            <Input id="dp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(22) 99999-9999" />
          </div>
        </div>
        <Button className="w-full" onClick={buy} disabled={buying}>
          <ScanLine className="mr-1.5 h-4 w-4" />
          {buying ? "Gerando..." : "Gerar day-pass"}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Check-in rápido na recepção via QR ou NFC.
        </p>
      </div>
    </div>
  );
}
