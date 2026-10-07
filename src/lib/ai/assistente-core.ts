import { NextResponse } from "next/server";

/**
 * POST /api/assistente — rota unificada de inteligência do app (REGRA 0.2).
 *
 * O OmniRoute é o roteador: ele já faz fallback entre provedores. Aqui
 * adicionamos a segunda camada de resiliência:
 *   1. cadeia de modelos (AI_MODEL → AI_MODEL_FALLBACKS)
 *   2. timeout por tentativa (AbortSignal)
 *   3. sanitização de resposta (vazamento de raciocínio/regras = descarta)
 *   4. falha total → mensagem amigável, nunca quebra a tela do usuário
 *
 * Contextos:
 *  - "aluno": conversa natural do Assistente de Treino (texto curto, motivacional)
 *  - "personal": geração de plano de treino (APENAS JSON padronizado)
 *
 * Stream: se body.stream === true, faz proxy do SSE do roteador token a token.
 * Se o stream não vier (roteador sem SSE), responde em JSON normal e o
 * frontend anima com efeito de digitação.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const AI_URL = (process.env.AI_API_URL ?? process.env.OPENAI_BASE_URL ?? "").replace(/\/$/, "");
const AI_KEY = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";

/** Cadeia de modelos: primário + fallbacks. */
function modelChain(): string[] {
  const primary = process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? "testev1";
  const fallbacks = (process.env.AI_MODEL_FALLBACKS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return [primary, ...fallbacks].filter((m, i, arr) => arr.indexOf(m) === i);
}

/** System prompt por contexto (fonte única: lib/ai/prompts). */
async function systemFor(context: string, extras?: Record<string, string>): Promise<string> {
  const extra = extras
    ? Object.entries(extras)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    : "";

  if (context === "personal") {
    const { WORKOUT_PLAN_SYSTEM } = await import("~/lib/ai/prompts");
    return extra ? `${WORKOUT_PLAN_SYSTEM}\n\nContexto do aluno recebido:\n${extra}` : WORKOUT_PLAN_SYSTEM;
  }
  if (context === "edit") {
    const { EDIT_WORKOUT_SYSTEM } = await import("~/lib/ai/prompts");
    return extra ? `${EDIT_WORKOUT_SYSTEM}\n\nContexto recebido:\n${extra}` : EDIT_WORKOUT_SYSTEM;
  }
  const { COACH_SYSTEM } = await import("~/lib/ai/prompts");
  return extra ? `${COACH_SYSTEM}\n\nDados do aluno (use para personalizar suas respostas):\n${extra}` : COACH_SYSTEM;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Validação estruturada da resposta de plano (contexto personal/edit).
 * Devolve a lista de erros (vazia = aprovado). Usada pelo loop de
 * auto-correção: erro vira feedback e o modelo reescreve o JSON.
 */
async function validatePlanReply(text: string, extras?: Record<string, string>): Promise<string[]> {
  const { extractJson, validateWorkoutPlan } = await import("~/lib/ai/validate");
  const parsed = extractJson(text);
  if (parsed == null) return ["A resposta não contém JSON válido (nem dentro de ```json)."];
  const v = validateWorkoutPlan(parsed);
  if (!v.ok) return v.details;

  const errors: string[] = [];
  const plan = parsed as {
    dias?: Array<{ exercicios?: Array<{ exercicio?: unknown }> }>;
  };
  const dias = Array.isArray(plan.dias) ? plan.dias : [];

  // quantidade exata de dias pedida pelo front
  const daysKey = Object.keys(extras ?? {}).find((k) => /quantidade exata de dias/i.test(k));
  const expected = daysKey ? Number(extras![daysKey]) : NaN;
  if (Number.isFinite(expected) && expected > 0 && dias.length !== expected) {
    errors.push(`O plano tem ${dias.length} dias, mas o pedido pede exatamente ${expected}. Corrija para ${expected}.`);
  }

  // exercícios precisam existir na biblioteca informada
  const libKey = Object.keys(extras ?? {}).find((k) => /biblioteca de exerc/i.test(k));
  if (libKey && extras![libKey]) {
    const library = extras![libKey].split("|").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (library.length > 0) {
      const unknown = new Set<string>();
      for (const d of dias) {
        for (const e of d.exercicios ?? []) {
          const name = typeof e.exercicio === "string" ? e.exercicio.trim().toLowerCase() : "";
          if (!name) continue;
          if (!library.includes(name)) unknown.add(String(e.exercicio));
        }
      }
      if (unknown.size > 0) {
        errors.push(
          `Exercícios fora da biblioteca da academia: ${[...unknown].join(", ")}. Substitua por nomes EXATOS da lista "EXERCÍCIOS VÁLIDOS" enviada.`
        );
      }
    }
  }
  return errors;
}

/** Respostas que vazam raciocínio/regras do sistema = descarta e cai pro próximo modelo. */
function isLeaky(text: string): boolean {
  return (
    !text ||
    /(check rules|rules\/constraints|system prompt|analyze user)/i.test(text)
  );
}

/**
 * Remove raciocínio vazado da resposta. Modelos da família Nemotron/deepseek
 * às vezes devolvem blocos <think>...</think> ou um preâmbulo em inglês
 * ("Here's a thinking process:...") antes da resposta real.
 */
function stripThinking(text: string): string {
  if (!text) return text;
  let out = text;
  // bloco <think> completo → remove
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // <think> sem fechamento → tudo a partir dele é raciocínio, descarta o início
  if (/<think>/i.test(out) && !out.includes("</think>")) {
    out = out.slice(out.lastIndexOf("</think>") + 8 || 0);
    if (!out.includes("</think>")) return "";
  }
  // preâmbulo de raciocínio em inglês → mantém só o último parágrafo
  if (/^\s*(here'?s?|okay|ok,|hmm|we need|let'?s|i'll)\b/i.test(out)) {
    const parts = out.split(/\n\n+/);
    if (parts.length > 1) out = parts[parts.length - 1];
  }
  return out.trim();
}

async function callModel(
  model: string,
  messages: ChatMessage[],
  stream: boolean,
  timeoutMs?: number,
  cancel?: AbortSignal
): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs ?? (stream ? 45000 : 30000));
  return fetch(`${AI_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream,
      temperature: 0.7,
      // reasoning consome budget fora do content: 10k cobre reasoning + plano
      max_tokens: stream ? 900 : 10000,
    }),
    signal: cancel ? AbortSignal.any([timeout, cancel]) : timeout,
  });
}

const OFFLINE_MESSAGE = "O Assistente está offline no momento. Tente novamente.";

/**
 * Handler compartilhado: usado por /api/assistente (rota principal) e
 * /api/coach (legado que delega pra cá).
 */
export async function handleAssistente(request: Request) {
  if (!AI_URL || !AI_KEY) {
    return NextResponse.json({ ok: false, error: OFFLINE_MESSAGE }, { status: 500 });
  }

  let body: {
    message?: unknown;
    context?: unknown;
    history?: unknown;
    extras?: unknown;
    stream?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: OFFLINE_MESSAGE }, { status: 500 });
  }

  const message = typeof body.message === "string" ? body.message.slice(0, 12000).trim() : "";
  const context = body.context === "personal" ? "personal" : body.context === "edit" ? "edit" : "aluno";
  const structured = context === "personal" || context === "edit";
  const stream = body.stream === true;
  const extras =
    body.extras && typeof body.extras === "object" && !Array.isArray(body.extras)
      ? (body.extras as Record<string, string>)
      : undefined;

  if (!message) {
    return NextResponse.json({ ok: false, error: OFFLINE_MESSAGE }, { status: 500 });
  }

  // histórico curto do chat do aluno (máx 8 trocas)
  const history: ChatMessage[] = Array.isArray(body.history)
    ? (body.history as Array<{ role?: unknown; content?: unknown }>)
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-8)
        .map((m) => ({ role: m.role as "user" | "assistant", content: (m.content as string).slice(0, 1000) }))
    : [];

  const system = await systemFor(context, extras);
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...history,
    { role: "user", content: message },
  ];

  // ===== MODO STREAM: proxy do SSE token a token =====
  if (stream) {
    for (const model of modelChain()) {
      try {
        const upstream = await callModel(model, messages, true);
        if (!upstream.ok || !upstream.body) continue;

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const readable = new ReadableStream({
          async start(controller) {
            const reader = upstream.body!.getReader();
            let buffer = "";
            let sent = 0;
            let pendingText = "";
            let emitBuffer = "";
            let inThink = false;
            // máquina de estados do raciocínio vazado: tokens dentro de
            // <think>...</think> (ou antes de </think> solto) nunca chegam ao usuário
            const emit = (t: string) => {
              if (!t) return;
              sent += t.length;
              controller.enqueue(encoder.encode(t));
            };
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const payload = trimmed.slice(5).trim();
                  if (payload === "[DONE]") continue;
                  try {
                    const json = JSON.parse(payload) as {
                      choices?: Array<{ delta?: { content?: string } }>;
                    };
                    const token = json.choices?.[0]?.delta?.content;
                    if (!token) continue;
                    // processa caractere a caractere com o estado de <think>
                    pendingText += token;
                    let _idx: number;
                    while ((pendingText.length > 0)) {
                      if (inThink) {
                        const close = pendingText.indexOf("</think>");
                        if (close === -1) {
                          // ainda dentro do raciocínio: fica retendo (mas libera
                          // texto seguro se já passou do tamanho de um </think>)
                          if (pendingText.length > 8) pendingText = pendingText.slice(-8);
                          break;
                        }
                        pendingText = pendingText.slice(close + 8);
                        inThink = false;
                        continue;
                      }
                      const open = pendingText.indexOf("<think>");
                      if (open === -1) {
                        // sem tag aberta: libera, mas retém sufixo que pode ser "<thi..."
                        const safe = pendingText.length > 7 ? pendingText.slice(0, -7) : "";
                        emitBuffer += safe;
                        pendingText = pendingText.length > 7 ? pendingText.slice(-7) : pendingText;
                        break;
                      }
                      emitBuffer += pendingText.slice(0, open);
                      pendingText = pendingText.slice(open + 7);
                      inThink = true;
                    }
                    if (emitBuffer) {
                      // filtra tag solta no fim
                      const safe = emitBuffer.replace(/<\/?(?:thi(?:nk)?)?$/i, "");
                      emitBuffer = "";
                      sent += safe.length;
                      emit(safe);
                    }
                  } catch {
                    // chunk parcial: ignora
                  }
                }
              }
            } catch {
              // upstream caiu no meio: encerra o que deu
            }
            // esgota o resto se não estiver em <think>
            if (!inThink && pendingText) emit(pendingText);
            controller.close();
            if (sent === 0) {
              // stream vazio: o cliente tratará como vazio e tenta novamente sem stream
            }
          },
        });

        return new Response(readable, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Model": model,
          },
        });
      } catch {
        continue; // próximo modelo da cadeia
      }
    }
    return NextResponse.json({ ok: false, error: OFFLINE_MESSAGE }, { status: 500 });
  }

  // ===== MODO NORMAL: CORRIDA de modelos (o primeiro plano válido vence) =====
  // Modelos free levam ~15-25s cada: em série, o segundo nem chegava a
  // responder antes dos 60s do serverless. Cada candidato tem a própria
  // cópia das messages (o feedback de validação não vaza entre modelos) e,
  // quando um vence, os demais são abortados (economia de cota free).
  const deadline = Date.now() + 56_000;
  const MIN_SLACK = 5_000; // menos que isso não dá pra começar uma chamada
  let lastErrors: string[] = [];
  let lastReply = "";

  const runCandidate = async (
    model: string,
    cancel: AbortSignal
  ): Promise<{ reply: string; model: string; attempt: number }> => {
    const msgs: ChatMessage[] = [...messages];
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < MIN_SLACK) throw new Error("sem orçamento");
      const t0 = Date.now();
      try {
        const res = await callModel(model, msgs, false, Math.min(50_000, remaining - 1_500), cancel);
        if (!res.ok) throw new Error(`http ${res.status}`); // 429/outro → candidato fora
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        let reply = data.choices?.[0]?.message?.content?.trim() ?? "";
        reply = stripThinking(reply);
        if (!reply) throw new Error("reply vazio"); // reasoning esgotou o budget
        if (isLeaky(reply)) throw new Error("vazou o system prompt");

        // validação estruturada (personal/edit): erro vira feedback e reescreve
        if (structured) {
          const errors = await validatePlanReply(reply, extras);
          if (errors.length > 0) {
            lastErrors = errors;
            lastReply = reply;
            console.log(JSON.stringify({
              audit: true,
              purpose: context === "edit" ? "edit_workout" : "generate_workout",
              model,
              attempt,
              latency_ms: Date.now() - t0,
              reply_len: reply.length,
              is_json: false,
              errors,
            }));
            msgs.push(
              { role: "assistant", content: reply.slice(0, 6000) },
              {
                role: "user",
                content:
                  `Sua resposta anterior foi REJEITADA pela validação automática:\n` +
                  errors.map((e) => `- ${e}`).join("\n") +
                  `\n\nReescreva o plano CORRIGIDO atendendo TODOS os pontos acima. ` +
                  `Responda APENAS com o JSON completo e válido, sem texto fora dele e sem repetir os erros.`,
              }
            );
            continue; // tenta de novo com o feedback
          }
        }

        // P1.7: Audit log (purpose, model, tokens, latency)
        try {
          const { extractJson } = await import("~/lib/ai/validate");
          const jsonPayload = structured ? extractJson(reply) : null;
          console.log(JSON.stringify({
            audit: true,
            purpose: context === "edit" ? "edit_workout" : context === "personal" ? "generate_workout" : "coach_chat",
            model,
            attempt,
            latency_ms: Date.now() - t0,
            reply_len: reply.length,
            is_json: !!jsonPayload,
            corrections: attempt,
          }));
        } catch {
          // audit é best-effort
        }
        return { reply, model, attempt };
      } catch (e) {
        if (!(e instanceof Error && /REJEITADA|validação insistiu/.test(e.message))) {
          console.log(JSON.stringify({
            audit: true,
            purpose: "candidate_fail",
            model,
            attempt,
            latency_ms: Date.now() - t0,
            reason: e instanceof Error ? e.message : String(e),
          }));
        }
        throw e;
      }
    }
    throw new Error("validação insistiu nas 2 tentativas");
  };

  const controllers = new Map<string, AbortController>();
  const tasks = modelChain().map((m) => {
    const ctrl = new AbortController();
    controllers.set(m, ctrl);
    return runCandidate(m, ctrl.signal);
  });

  try {
    const winner = await Promise.any(tasks);
    for (const [m, ctrl] of controllers) {
      if (m !== winner.model) ctrl.abort();
    }
    return NextResponse.json({ ok: true, model: winner.model, text: winner.reply, corrections: winner.attempt });
  } catch {
    // Todos os modelos falharam: se houve reply com erros conhecidos,
    // devolve o detalhe; senão o aviso genérico (front cai no gerador local).
    if (structured && lastReply && lastErrors.length > 0) {
      return NextResponse.json({
        ok: false,
        error: `A IA gerou um plano inválido (${lastErrors[0]}). Tente de novo ou ajuste o pedido.`,
      }, { status: 502 });
    }
    return NextResponse.json({ ok: false, error: OFFLINE_MESSAGE }, { status: 500 });
  }
}
