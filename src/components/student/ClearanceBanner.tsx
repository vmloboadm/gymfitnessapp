"use client";

import { useEffect, useRef, useState } from "react";
import { FileHeart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { supabaseBrowser } from "~/lib/supabase/client";
import { uploadClearance } from "~/lib/medical-upload";

/**
 * Aluno com restrição de saúde e sem laudo aprovado: aviso claro com o
 * envio do laudo (Home e aba Treino). O treino só libera depois que a equipe
 * aprova (regra no banco, migration 082).
 */
export function ClearanceBanner() {
  const { profile } = useAuth();
  const [sent, setSent] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pending = profile?.role === "student" && profile.status === "pending_clearance";

  useEffect(() => {
    if (!pending || !profile) return;
    void supabaseBrowser()
      .from("medical_clearances")
      .select("id", { count: "exact", head: true })
      .eq("student_id", profile.id)
      .then(({ count }) => setSent((count ?? 0) > 0));
  }, [pending, profile]);

  if (!pending || !profile || sent === null) return null;

  const onFile = async (f: File) => {
    setBusy(true);
    const r = await uploadClearance(profile, f);
    setBusy(false);
    if (!r.ok) return toast.error("Não foi possível enviar o laudo", { description: r.error });
    setSent(true);
    toast.success("Laudo enviado! A equipe vai analisar e liberar seu treino.");
  };

  return (
    <div className="gf-rise rounded-2xl border border-sky-400/40 bg-gradient-to-br from-sky-400/15 via-card to-card p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-sky-400">
        <FileHeart className="h-4 w-4" /> {sent ? "Laudo em análise" : "Falta seu laudo médico"}
      </p>
      <p className="mt-1 text-[14px] font-black text-foreground">
        {sent ? "Seu laudo foi enviado ✓" : "Envie seu laudo para liberar o treino"}
      </p>
      <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
        {sent
          ? "A equipe da academia está analisando. Assim que aprovar, seu treino é liberado e você recebe um aviso."
          : "No cadastro você marcou uma restrição de saúde. Pela sua segurança, o treino é liberado depois que a equipe vê o laudo. Pode ser foto ou PDF."}
      </p>
      {!sent ? (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="tactile mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 py-3 text-[14px] font-black text-black disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Enviando…" : "Enviar laudo"}
          </button>
        </>
      ) : null}
    </div>
  );
}
