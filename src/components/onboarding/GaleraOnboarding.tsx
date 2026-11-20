"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "~/lib/supabase/client";
import { Bubble, type CheerMate } from "~/components/social/CheerStrip";

/**
 * Último passo do cadastro: mostra quem já treina na academia e ensina a mandar
 * força para um colega. Só leitura (usa o mesmo roster do ranking).
 */
export function GaleraOnboarding({ gymId, isDemo }: { gymId: string | null | undefined; isDemo: boolean }) {
  const [mates, setMates] = useState<CheerMate[]>([]);

  useEffect(() => {
    if (isDemo || !gymId) return;
    let vivo = true;
    void (async () => {
      const { data, error } = await supabaseBrowser().rpc("gym_roster", { p_gym_id: gymId });
      if (error || !vivo) return;
      const lista = ((data ?? []) as Array<{ id: string; name: string | null; avatar_url: string | null; role: string }>)
        .filter((m) => m.role === "student")
        .slice(0, 12)
        .map((m) => ({ student_id: m.id, name: m.name, avatar_url: m.avatar_url }));
      setMates(lista);
    })();
    return () => {
      vivo = false;
    };
  }, [gymId, isDemo]);

  return (
    <section className="rounded-2xl border border-[#F4711E]/30 bg-card/60 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#F4711E]">🟠 Olha quem já treina aqui</p>
      {mates.length > 0 ? (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1 pt-1" style={{ scrollbarWidth: "none" }}>
          {mates.map((mt, i) => (
            <div key={mt.student_id} className="flex shrink-0 flex-col items-center gap-1">
              <Bubble src={mt.avatar_url} name={mt.name} size={46} delay={i * 0.15} />
              <span className="max-w-[56px] truncate text-[10px] font-medium text-muted-foreground/80">
                {(mt.name ?? "Atleta").split(" ")[0]}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        Quando chegar na academia, manda <span className="font-black text-foreground">força 💪</span> pra um colega
        de treino. Ele recebe um aviso no app, e você ganha a mesma atenção de volta.
      </p>
    </section>
  );
}
