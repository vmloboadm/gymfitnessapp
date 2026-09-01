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
  if (context === "personal") {
    const { WORKOUT_PLAN_SYSTEM } = await import("~/lib/ai/prompts");
    const extra = extras
      ? Object.entries(extras)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")
      : "";
    return extra ? `${WORKOUT_PLAN_SYSTEM}\n\nContexto do aluno recebido:\n${extra}` : WORKOUT_PLAN_SYSTEM;
  }
  const { COACH_SYSTEM } = await import("~/lib/ai/prompts");
  return COACH_SYSTEM;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

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
  stream: boolean
): Promise<Response> {
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
      max_tokens: stream ? 900 : 1200,
    }),
    signal: AbortSignal.timeout(stream ? 45000 : 30000),
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

  const message = typeof body.message === "string" ? body.message.slice(0, 4000).trim() : "";
  const context = body.context === "personal" ? "personal" : "aluno";
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
                    let idx: number;
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

  // ===== MODO NORMAL: cadeia de modelos, primeira resposta boa vence =====
  for (const model of modelChain()) {
    try {
      const res = await callModel(model, messages, false);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      let reply = data.choices?.[0]?.message?.content?.trim() ?? "";
      reply = stripThinking(reply);
      if (isLeaky(reply)) continue;
      return NextResponse.json({ ok: true, model, text: reply });
    } catch {
      continue; // timeout/rede → próximo modelo
    }
  }

  return NextResponse.json({ ok: false, error: OFFLINE_MESSAGE }, { status: 500 });
}
