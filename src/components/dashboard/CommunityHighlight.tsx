"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import { ChevronRight, Flame, BellRing } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { supabaseBrowser } from "~/lib/supabase/client";
import { cn } from "~/lib/utils";
import type { CommunityFeat } from "./mocks";
import type { Notifications } from "~/lib/types/models";

/** Conquistas da Galera — feitos de colegas com foto de perfil e reação "Dar Fogo".
    A primeira reação 🔥 gera notificação real para o dono da conquista. */
export function CommunityHighlight({ feat }: { feat: CommunityFeat }) {
  const { user, profile } = useAuth();
  const [reacted, setReacted] = useState(false);
  const [count, setCount] = useState(18);

  const sendNotification = async () => {
    const supabase = supabaseBrowser();
    if (!user || !profile || !feat.ownerId) {
      // Demo / sem sessão — simula a notificação ao dono
      return;
    }
    const payload: Partial<Notifications> = {
      gym_id: profile.gym_id,
      user_id: feat.ownerId,
      channel: "push",
      title: "Você recebeu uma reação 🔥",
      body: `${profile.name?.split(" ")[0] ?? "Alguém"} deu fogo na sua conquista.`,
    };
    await supabase.from("notifications").insert(payload as Notifications);
  };

  const handleReact = () => {
    if (reacted) return;
    const newCount = count + 1;
    setCount(newCount);
    setReacted(true);
    void sendNotification().then(() => {
      toast.success("Reação enviada 🔥", {
        description: `${feat.author} foi notificado(a) sobre sua reação.`,
      });
    });
  };

  return (
    <motion.div variants={item} whileTap={{ scale: 0.985 }}>
      <Link href="/feed" className="pm-surface tactile block p-6">
        <span className="pointer-events-none absolute left-3 top-3 h-3 w-3 border-l border-t border-[#FF9A5C]/40" aria-hidden />
        <span className="pointer-events-none absolute right-3 top-3 h-3 w-3 border-r border-t border-[#FF9A5C]/40" aria-hidden />

        <div className="flex items-center justify-between">
          <p className="pm-mono flex items-center gap-2 text-[#FF9A5C]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF9A5C]" />
            conquistas da galera
          </p>
          <ChevronRight className="h-4 w-4 text-[#7E8AA0]" />
        </div>

        <p className="mt-4 font-display text-[15px] font-semibold leading-snug text-[#F4F6FB]">{feat.text}</p>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative inline-flex shrink-0">
              {feat.avatar ? (
                <Image
                  src={feat.avatar}
                  alt={`Foto de ${feat.author}`}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full border-2 border-[#4ADE80]/70 object-cover"
                  unoptimized
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#4ADE80]/70 bg-gradient-to-br from-[#FF8A3C]/40 to-[#E85D0E]/20 font-display text-xs font-bold text-[#F4F6FB]">
                  {feat.author.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ADE80] opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-[#050507] bg-[#4ADE80]" />
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#D6DCEC]">{feat.author}</p>
              <p className="pm-mono mt-0.5 text-[9px] text-[#7E8AA0]">{feat.role}</p>
            </div>
          </div>

          <button
            aria-pressed={reacted}
            aria-label={reacted ? "Você já deu fogo" : "Dar fogo"}
            disabled={reacted}
            onClick={handleReact}
            className={cn(
              "tactile flex items-center gap-1.5 rounded-full border px-3.5 py-2 transition-colors",
              reacted
                ? "border-[#FF6A3C]/40 bg-[#FF6A3C]/15"
                : "border-white/[0.08] bg-white/[0.03]"
            )}
          >
            <Flame className={cn("h-4 w-4 transition-colors", reacted ? "fill-[#FF6A3C] text-[#FF6A3C]" : "text-[#9AA5B8]")} />
            <span className="pm-num text-[13px] text-[#E6EAF3]">{count}</span>
            {reacted && <BellRing className="h-3 w-3 text-[#FF6A3C]/80" aria-hidden />}
          </button>
        </div>
      </Link>
    </motion.div>
  );
}

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } },
};