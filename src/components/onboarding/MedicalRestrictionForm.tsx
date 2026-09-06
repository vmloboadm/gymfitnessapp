"use client";

import { useState, useRef } from "react";
import { FileUp, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "~/components/ui/button";
import { supabaseBrowser } from "~/lib/supabase/client";
import { toast } from "sonner";
import type { Profiles } from "~/lib/types/models";

/**
 * STEP 4, Restrições médicas + upload de laudo.
 * Se medical_risk e laudo enviado → trigger do Postgres seta status = pending_clearance.
 * Finish é bloqueado até o gestor aprovar o laudo.
 */
export function MedicalRestrictionForm({
  profile,
  onSave,
}: {
  profile: Profiles;
  onSave: (patch: Partial<Profiles>, nextStep: number) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPending = profile.status === "pending_clearance";

  const handleFile = async (f: File) => {
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Arquivo grande demais", { description: "Envie um PDF ou imagem de até 5 MB." });
      return;
    }
    setFile(f);
    setUploading(true);
    const supabase = supabaseBrowser();

    const path = `clearances/${profile.id}/${Date.now()}-${f.name}`;
    const { error } = await supabase.storage
      .from("medical")
      .upload(path, f, { upsert: false });

    setUploading(false);
    if (error) {
      toast.error("Falha ao enviar laudo", { description: error.message });
      return;
    }

    const { data: urlData } = supabase.storage.from("medical").getPublicUrl(path);

    const { error: insertError } = await supabase.from("medical_clearances").insert({
      gym_id: profile.gym_id,
      student_id: profile.id,
      document_url: urlData?.publicUrl ?? path,
    } as never);
    if (insertError) {
      toast.error("Falha ao registrar laudo", { description: insertError.message });
      return;
    }

    setUploaded(true);
    toast.success("Laudo enviado, em análise pelo gestor");
  };

  const handleNext = async () => {
    await onSave({}, 5);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {isPending ? (
          <ShieldAlert className="h-4 w-4 text-warning" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-brand" />
        )}
        <h2 className="text-sm font-semibold text-foreground">
          {isPending ? "Aguardando aprovação do laudo" : profile.medical_risk ? "Restrição identificada, envie laudo" : "Saúde confirmada"}
        </h2>
      </div>

      {profile.medical_risk ? (
        <>
          {isPending ? (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 space-y-2">
              <p className="text-sm font-semibold text-warning">Laudo em análise</p>
              <p className="text-xs text-muted-foreground">
                Seu laudo médico foi enviado e está sendo analisado pelo gestor da academia.
                Assim que for aprovado, seu treino será liberado automaticamente.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nossa trava clínica detectou uma restrição. Para liberar treinos de alto
              impacto, envie um laudo médico recente. Um personal vai analisar.
            </p>
          )}

          {!isPending && (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-brand/50 bg-brand/5 p-6 text-center transition-colors hover:bg-brand/10"
              >
                <FileUp className="h-8 w-8 text-brand" />
                <span className="text-sm font-semibold text-foreground">
                  {uploaded ? "Laudo enviado, reenviar" : file ? file.name : "Enviar laudo médico"}
                </span>
                <span className="text-xs text-muted-foreground">
                  PDF ou imagem · máx 5 MB
                </span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </>
          )}

          {uploading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
            </div>
          )}

          <Button
            onClick={handleNext}
            className="w-full"
            size="lg"
            disabled={uploading}
          >
            {isPending ? "Aguardar aprovação" : "Continuar, Revisar"}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Maravilha! Você não sinalizou restrições. Pode seguir.
          </p>
          <Button onClick={handleNext} className="w-full" size="lg">
            Continuar, Revisar
          </Button>
        </>
      )}
    </div>
  );
}
