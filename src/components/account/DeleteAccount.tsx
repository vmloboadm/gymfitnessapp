"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "~/lib/supabase/client";

/**
 * Zona de perigo: exclusão total da conta.
 * Fluxo sério em 3 etapas: abrir → confirmar entendimento → senha → excluir.
 */
export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const reset = () => {
    setOpen(false);
    setConfirmText(false);
    setPassword("");
    setDeleting(false);
  };

  const handleDelete = async () => {
    if (!confirmText) {
      toast.error("Confirme que entende as consequências.");
      return;
    }
    if (!password) {
      toast.error("Digite sua senha para confirmar.");
      return;
    }
    setDeleting(true);
    try {
      const supabase = supabaseBrowser();
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess.session?.access_token ?? "";
      if (!jwt) throw new Error("Sessão expirada. Entre de novo.");

      const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const res = await fetch(`${base}/api/account/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Falha ao excluir.");

      await supabase.auth.signOut();
      toast.success("Conta excluída. Sentiremos sua falta!");
      router.replace("/login");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu excluir agora.");
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="tactile flex w-full items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/[0.05] p-3.5 text-left"
      >
        <Trash2 className="h-4 w-4 shrink-0 text-destructive" />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-bold text-destructive">Excluir minha conta</span>
          <span className="block text-[10px] text-muted-foreground">Apaga tudo permanentemente</span>
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={reset}
          role="dialog"
          aria-modal="true"
          aria-label="Excluir conta"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-center gap-2 text-[15px] font-black text-foreground">
                <TriangleAlert className="h-5 w-5 shrink-0 text-destructive" />
                Excluir conta?
              </p>
              <button
                onClick={reset}
                className="gf-touch flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              Isso apaga <span className="font-bold text-foreground">permanentemente</span> seu perfil,
              treinos, medidas, check-ins, conquistas e mensagens. Não tem como desfazer.
            </p>

            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-white/[0.03] p-3">
              <input
                type="checkbox"
                checked={confirmText}
                onChange={(e) => setConfirmText(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF453A]"
              />
              <span className="text-[11.5px] font-semibold text-foreground">
                Entendo que todos os meus dados serão apagados para sempre.
              </span>
            </label>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Confirme com sua senha
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha atual"
                autoComplete="current-password"
                className="h-11 w-full rounded-xl border border-border bg-white/[0.04] px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/60"
              />
            </label>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={reset}
                disabled={deleting}
                className="tactile rounded-xl border border-border py-3 text-[13px] font-bold text-foreground disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || !confirmText || !password}
                className="tactile rounded-xl bg-destructive py-3 text-[13px] font-black text-white disabled:opacity-40"
              >
                {deleting ? "Excluindo..." : "Excluir tudo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
