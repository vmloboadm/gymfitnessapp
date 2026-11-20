"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { supabaseBrowser } from "~/lib/supabase/client";
import { iconSvg } from "~/lib/avatar-icon";
import { cn } from "~/lib/utils";

/**
 * Privacidade da foto: foto para todos os alunos, ou um ícone para os alunos
 * (a equipe da academia continua vendo a foto real).
 */
export function FotoPrivacidade() {
  const { profile, refreshProfile } = useAuth();
  const [publica, setPublica] = useState<boolean>(profile?.foto_publica ?? true);
  const [icone, setIcone] = useState<number>(profile?.avatar_icone ?? 1);
  const [saving, setSaving] = useState(false);

  const salvar = async (nextPublica: boolean, nextIcone: number) => {
    setSaving(true);
    try {
      const { data, error } = await supabaseBrowser().rpc("set_foto_privacidade" as never, {
        p_publica: nextPublica,
        p_icone: nextPublica ? null : nextIcone,
      } as never);
      if (error || !(data as { ok?: boolean } | null)?.ok) throw new Error(error?.message ?? "falhou");
      setPublica(nextPublica);
      setIcone(nextIcone);
      await refreshProfile();
      toast.success(nextPublica ? "Sua foto aparece para a galera." : "Agora os alunos veem seu ícone.");
    } catch {
      toast.error("Não consegui salvar. Tenta de novo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card/50 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {publica ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} Quem vê minha foto
      </p>
      <p className="mt-2 text-[12px] text-muted-foreground">
        A equipe da academia (gestor e personal) sempre vê sua foto real, para acompanhar seu treino.
      </p>

      <div className="mt-3 grid gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => salvar(true, icone)}
          className={cn(
            "rounded-xl border px-4 py-3 text-left text-[13px] font-semibold transition-colors",
            publica ? "border-[#F4711E] bg-[#F4711E]/10" : "border-border bg-white/[0.02]"
          )}
        >
          Mostrar minha foto para os alunos
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => salvar(false, icone)}
          className={cn(
            "rounded-xl border px-4 py-3 text-left text-[13px] font-semibold transition-colors",
            !publica ? "border-[#F4711E] bg-[#F4711E]/10" : "border-border bg-white/[0.02]"
          )}
        >
          Usar um ícone para os alunos
        </button>
      </div>

      {!publica ? (
        <div className="mt-3 flex items-center justify-center gap-3">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              disabled={saving}
              onClick={() => salvar(false, n)}
              aria-pressed={icone === n}
              className={cn(
                "h-16 w-16 overflow-hidden rounded-full border-2 transition-transform active:scale-95",
                icone === n ? "border-[#F4711E] scale-105" : "border-transparent opacity-70"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconSvg(n)} alt={`Ícone ${n}`} className="h-full w-full" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
