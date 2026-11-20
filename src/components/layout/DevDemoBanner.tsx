"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isDevDemo, setDevDemo } from "~/lib/dev-demo";
import { supabaseBrowser } from "~/lib/supabase/client";

/** Faixa discreta quando a sessão é demo: avisa que nada é gravado e permite sair. */
export function DevDemoBanner() {
  const router = useRouter();
  const [on, setOn] = useState(false);
  useEffect(() => setOn(isDevDemo()), []);
  if (!on) return null;

  /** Encerra a demo: apaga a conta descartável no servidor e sai. */
  const sair = async () => {
    try {
      const { data } = await supabaseBrowser().auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await fetch("/api/dev-demo/encerrar", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      }
    } catch {
      /* se falhar, a conta some sozinha em 3 horas */
    }
    setDevDemo(false);
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  };

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-2 bg-[#F4711E]/90 px-4 py-1.5 text-[11px] font-bold text-black">
      <span>Modo demo · nada é gravado</span>
      <button type="button" onClick={sair} className="rounded-full bg-black/80 px-3 py-1 text-[11px] font-black text-white">
        Encerrar demo
      </button>
    </div>
  );
}
