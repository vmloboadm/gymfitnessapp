"use client";

import { m } from "framer-motion";
import { MessageCircle, Star } from "lucide-react";
import { TopBar } from "~/components/layout/TopBar";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { demoPersonais } from "~/lib/demo-bridge";

/**
 * Personals da Casa, vitrine de monetização (piloto via WhatsApp).
 * Card vertical grande: foto, nome, especialidade, pitch e CTA laranja
 * que abre o WhatsApp com mensagem pré-preenchida.
 */

const EXTRA = [
  { specialty: "Consultoria em Hipertrofia", pitch: "Treino periodizado + ajuste de carga semanal por vídeo. Quem já subiu de nível não volta." },
  { specialty: "Emagrecimento & Condicionamento", pitch: "Plano realista pra rotina corrida, com evolução visível mês a mês." },
  { specialty: "Iniciantes & Adaptação", pitch: "Primeiros 90 dias sem lesão e sem medo de máquina. Acompanhamento de perto." },
];

const PHOTOS: (string | null)[] = [null, null, null];

export default function PersonaisMarketplacePage() {
  const personais = demoPersonais();

  return (
    <>
      <TopBar title="Personals da Casa" subtitle="Acompanhamento premium dentro do gym" />
      <div className="space-y-5 p-4">
        <m.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[20px] border border-brand/35 bg-gradient-to-br from-brand/15 via-card to-card p-5">
          <p className="text-sm font-bold text-foreground">Resultado mais rápido com quem faz isso por ofício</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Escolha um personal da casa, fale direto no WhatsApp e monte seu acompanhamento.
            Sem burocracia, sem mensalidade escondida.
          </p>
        </m.div>

        {personais.map((p, i) => {
          const extra = EXTRA[i % EXTRA.length];
          const msg = encodeURIComponent(
            `Olá ${p.trainer.name.split(" ")[0]}! Vi seu perfil no GymFitness e quero saber mais sobre: ${extra.specialty}.`
          );
          return (
            <m.article
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileTap={{ scale: 0.985 }}
              className="overflow-hidden rounded-[20px] border border-border bg-card/50"
            >
              <div className="flex items-center gap-4 p-4">
                <Avatar className="h-16 w-16 border-2 border-brand/40">
                  <AvatarImage src={PHOTOS[i % PHOTOS.length] ?? undefined} alt={p.trainer.name} />
                  <AvatarFallback className="bg-secondary text-lg font-bold text-secondary-foreground">
                    {p.trainer.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-foreground">{p.trainer.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-warning">
                    <Star className="h-3 w-3 fill-current" /> 4.{8 + (i % 2)} · {18 - i * 3 > 0 ? 15 + i : 15} alunos ativos
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-brand">{extra.specialty}</p>
                </div>
              </div>

              <div className="px-4 pb-1">
                <p className="text-[13px] leading-relaxed text-muted-foreground">{extra.pitch}</p>
              </div>

              <div className="p-4 pt-3">
                <m.a
                  href={`https://wa.me/552299999000${i + 1}?text=${msg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="gf-touch flex w-full items-center justify-center gap-2 rounded-xl bg-[#F4711E] py-3.5 text-sm font-black text-black shadow-[0_0_20px_rgba(244,113,30,0.4)]"
                >
                  <MessageCircle className="h-4 w-4" />
                  Quero Consultoria Premium
                </m.a>
              </div>
            </m.article>
          );
        })}

        <p className="pb-2 text-center text-[11px] text-muted-foreground">
          O contato é direto pelo WhatsApp do personal, sem intermediários.
        </p>
      </div>
    </>
  );
}
