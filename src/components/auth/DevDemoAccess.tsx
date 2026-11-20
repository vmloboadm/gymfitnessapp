"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "~/lib/supabase/client";
import { setDevDemo } from "~/lib/dev-demo";

const PAPEIS = [
  { id: "aluno", label: "Aluno" },
  { id: "personal", label: "Personal" },
  { id: "gestor", label: "Gestor" },
] as const;

/** Acesso demo discreto na tela de login. Só entra com a senha do dono. */
export function DevDemoAccess() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<(typeof PAPEIS)[number]["id"]>("aluno");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);

  const entrar = async () => {
    if (!senha || enviando) return;
    setEnviando(true);
    setErro(false);
    try {
      const res = await fetch("/api/dev-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha, papel }),
      });
      if (!res.ok) throw new Error("negado");
      const j = (await res.json()) as { access_token: string; refresh_token: string };
      const { error } = await supabaseBrowser().auth.setSession({
        access_token: j.access_token,
        refresh_token: j.refresh_token,
      });
      if (error) throw error;
      setDevDemo(true);
      router.replace("/");
    } catch {
      setErro(true);
      setSenha("");
    } finally {
      setEnviando(false);
    }
  };

  if (!aberto) {
    return (
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="text-[10px] tracking-widest text-muted-foreground/40 transition-opacity hover:text-muted-foreground/70"
        >
          · acesso
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card/60 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Acesso demo</p>
      <div className="mt-3 flex gap-2">
        {PAPEIS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPapel(p.id)}
            className={`flex-1 rounded-xl border px-2 py-2 text-[12px] font-semibold ${
              papel === p.id ? "border-[#F4711E] bg-[#F4711E]/10" : "border-border"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && entrar()}
        placeholder="Senha"
        autoComplete="off"
        className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-[#F4711E]"
      />
      {erro ? <p className="mt-2 text-[11px] text-destructive">Não foi possível entrar.</p> : null}
      <button
        type="button"
        onClick={entrar}
        disabled={enviando || !senha}
        className="mt-3 w-full rounded-xl bg-[#F4711E] py-2.5 text-[13px] font-black text-black disabled:opacity-50"
      >
        {enviando ? "Entrando..." : "Entrar em demo"}
      </button>
      <p className="mt-2 text-center text-[10px] text-muted-foreground/70">Nesta sessão nada é gravado.</p>
    </div>
  );
}
