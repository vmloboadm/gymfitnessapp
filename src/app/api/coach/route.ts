import { NextResponse } from "next/server";

/**
 * POST /api/coach — Personal Digital com IA real.
 * Usa OPENAI_API_KEY ou ANTHROPIC_API_KEY se configuradas; sem chave,
 * responde { ok:false } e o cliente usa o cérebro local (fallback honesto).
 * System prompt: personal trainer GymFitness — ajuda o aluno E sugere
 * upgrades (premium/consultoria) no momento certo para monetizar.
 */

const SYSTEM_PROMPT = `Você é o Personal Digital da GymFitness, academia brasileira.
Regras:
- NUNCA use travessão (—) nem hífen (-) nas respostas. Nunca.
- Personalidade: gentil, engraçado, direto e inteligente. Humor leve de academia.
- Responda SEMPRE em português brasileiro, direto e motivador.
- Máximo 3 frases curtas. NUNCA textão. Sem listas, sem introduções.
- O assunto é SEMPRE academia: treino, execução, carga, descanso, rotina, dieta básica.
- Papo furado (futebol, namoro, política, curiosidades)? Responda em 1 frase curta
  e puxe de volta: "bora focar no treino" + pergunta sobre o treino do dia.
- Segurança primeiro: dor articular ou lesão → reduza carga HOJE e mande o aluno procurar um personal na recepção pra relatar (fale do Claudeir). Nunca indique profissional externo.
- MONETIZAÇÃO: se o aluno mostrar evolução, estagnação ou querer acelerar resultados,
  sugira em 1 frase natural o plano Premium ou consultoria. Nunca duas vezes seguidas.
- Termine com uma pergunta curta sobre o treino quando fizer sentido (mantém o foco).
- Chame o aluno de "jogador" às vezes (apelido do dono da academia, Claudeir).
- A cada poucas respostas, encaixe a frase do dono: "A dor de hoje é o Sucesso de amanhã" (C.M).
- Se perguntarem sobre histórico, estatísticas ou progresso pessoal que você não
  tem acesso: NUNCA admita falha do sistema. De bronca brincando, como se o
  histórico vazio fosse culpa do aluno por faltar treino. Exemplo do tom:
  "Histórico? Olha, jogador, o banco de dados tá tão vazio quanto a academia
  num domingo... quem andou faltando treino foi você, hein! Bora resolver isso
  HOJE: qual treino vai fazer?" Sempre termina puxando pro treino do dia.`;

type Body = { message?: unknown };

export async function POST(request: Request) {
  let message = "";
  try {
    const body = (await request.json()) as Body;
    message = typeof body.message === "string" ? body.message.slice(0, 500) : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
  }
  if (!message.trim()) {
    return NextResponse.json({ ok: false, error: "Mensagem vazia." }, { status: 400 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  // Base configurável: qualquer endpoint compatível OpenAI (omniroute, etc.)
  const openaiBase = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

  try {
    if (openaiKey) {
      // Cadeia de modelos: se um upstream estiver caído, tenta o próximo.
      const chain = (
        process.env.OPENAI_MODELS ??
        process.env.OPENAI_MODEL ??
        "combofree,testev1,auto/best-free,oc/qwen3.6-plus-free"
      )
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      for (const model of chain) {
        try {
          const res = await fetch(`${openaiBase}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model,
              max_tokens: 140,
              temperature: 0.7,
              // omniroute e derivados fazem SSE por padrão — desligar explicitamente
              stream: false,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: message },
              ],
            }),
            signal: AbortSignal.timeout(20000),
          });
          if (!res.ok) continue; // upstream caído → próximo modelo
          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          let reply = data.choices?.[0]?.message?.content?.trim();
          // Nemotron às vezes vaza raciocínio: corta tudo antes do bloco final
          if (reply && /^(here|okay|hmm|\d+\.)/i.test(reply) && reply.includes("\n\n")) {
            const parts = reply.split("\n\n");
            reply = parts[parts.length - 1].trim();
          }
          // Vazamento de raciocínio/regras = descarta e tenta o próximo modelo
          if (!reply || /(check rules|rules\/constraints|system prompt|analyze user)/i.test(reply)) continue;
          return NextResponse.json({ ok: true, provider: `openai:${model}`, reply });
        } catch {
          continue; // timeout/rede → próximo modelo
        }
      }
      throw new Error("todos os modelos falharam");
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest",
          max_tokens: 140,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: message }],
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}`);
      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const reply = data.content?.find((c) => c.type === "text")?.text?.trim();
      if (reply) return NextResponse.json({ ok: true, provider: "anthropic", reply });
      throw new Error("anthropic vazio");
    }
  } catch (err) {
    // provedor falhou → cliente cai no cérebro local
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "provider error" },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: false, error: "IA não configurada." }, { status: 200 });
}
