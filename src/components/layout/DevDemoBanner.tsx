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

  const sair = async () => {
    setDevDemo(false);
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  };

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-2 bg-[#F4711E]/90 px-4 py-1.5 text-[11px] font-bold text-black">
      <span>Modo demo · nada é gravado</span>
      <button type="button" onClick={sair} className="underline underline-offset-2">
        sair
      </button>
    </div>
  );
}
