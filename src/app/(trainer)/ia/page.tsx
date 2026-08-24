"use client";

import { useState } from "react";
import { Sparkles, Wand2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { generate, isAiConfigured } from "~/lib/ai/omniroute";

/**
 * Assistente com IA do personal (blueprint IA). Sempre passa pelo
 * gateway OmniRoute (REGRA 0.2) — nunca por provider direto.
 */
export default function IaPage() {
  const { user, profile } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ text: string; model: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configured = isAiConfigured();

  const run = async () => {
    if (!prompt.trim() || !user) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const out = await generate({
      purpose: "generate_workout",
      system:
        "Você é um personal trainer brasileiro. Monte um programa de treino claro, com exercícios, séries e descanso.",
      prompt: prompt.trim(),
    });

    setLoading(false);
    if (out.ok) {
      setResult({ text: out.text, model: out.model });
    } else {
      setError(out.error);
    }
  };

  const saveAsProgram = async () => {
    if (!result || !user || !profile) return;
    const seed = result.text.slice(0, 200);
    await supabaseBrowser()
      .from("workout_programs")
      .insert({
        gym_id: profile.gym_id,
        trainer_id: user.id,
        name: "Programa sugerido",
        objective: "sugerido pelo Personal Digital",
        created_via: "ia" as const,
        ai_draft: seed,
      } as never)
      .then(() => {});
  };

  return (
    <>
      <TopBar title="Personal Digital" subtitle="Sugestões de treino para seus alunos" />
      <div className="space-y-4 p-4">
        <div
          className={
            "flex items-start gap-3 rounded-xl border p-4 " +
            (configured ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/10")
          }
        >
          {configured ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          )}
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {configured ? "Gateway OmniRoute ativo" : "Gateway OmniRoute não configurado"}
            </p>
            <p className="text-xs text-muted-foreground">
              {configured
                ? "As chamadas usam a chave OMNIRoute_API_KEY do servidor."
                : "Adicione OMNIRoute_API_KEY no .env.local para habilitar a geração."}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/50 p-4">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Seu pedido</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex.: programa 4x para ganho de massa, foco em pernas, aluno iniciante..."
            rows={3}
            className="resize-none"
          />
          <Button className="mt-3 w-full" onClick={run} disabled={loading || !prompt.trim()}>
            <Wand2 className="mr-1.5 h-4 w-4" />
            {loading ? "Gerando..." : "Gerar programa"}
          </Button>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Resultado</p>
              <Badge variant="secondary">{result.model}</Badge>
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{result.text}</pre>
            <Button variant="outline" size="sm" className="mt-3" onClick={saveAsProgram}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Salvar rascunho como programa
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
