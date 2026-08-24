"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera } from "lucide-react";

/**
 * RewardModal — comemoração estilo Duolingo/Strava:
 * mascote em vídeo (autoplay loop muted, preload=metadata) + confete + share.
 */
export function RewardModal({
  open,
  onClose,
  icon,
  name,
  points,
  videoUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  shareText,
}: {
  open: boolean;
  onClose: () => void;
  icon?: string;
  name: string;
  points: number;
  videoUrl?: string;
  shareText: string;
}) {
  const pieces = Array.from({ length: 18 }, (_, i) => i);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-black/90 p-6 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* confete */}
          {pieces.map((i) => (
            <motion.span
              key={i}
              className="absolute top-[-10%] h-2 w-[6px] rounded-[2px]"
              style={{
                left: `${(i * 37) % 100}%`,
                background: ["#F4711E", "#FFC24D", "#4ADE80", "#67E8F9"][i % 4],
              }}
              initial={{ y: "-10vh", rotate: 0, opacity: 1 }}
              animate={{ y: "110vh", rotate: 360 + (i % 5) * 120, opacity: [1, 1, 0.4] }}
              transition={{ duration: 2.2 + (i % 5) * 0.35, delay: i * 0.07, ease: "easeIn" }}
            />
          ))}

          <motion.video
            src={videoUrl}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="relative z-10 h-44 w-44 rounded-full border-4 border-brand object-cover shadow-[0_0_40px_rgba(244,113,30,0.5)]"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 16 }}
          />

          <p className="relative z-10 text-[11px] font-black uppercase tracking-[0.25em] text-warning">
            Conquista Desbloqueada!
          </p>
          <h2 className="relative z-10 text-center font-display text-3xl font-black text-white">
            {icon} {name}
          </h2>
          <span className="relative z-10 rounded-full bg-brand px-4 py-1 text-xs font-black text-black">
            +{points} pts
          </span>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={async () => {
              try {
                if (navigator.share) await navigator.share({ title: "GymFitness", text: `${shareText} ${name}` });
                else {
                  await navigator.clipboard.writeText(`${shareText} ${name}`);
                }
              } catch {}
            }}
            className="gf-touch relative z-10 mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#E1306C] to-[#F77737] px-8 py-4 text-sm font-black text-white"
          >
            Compartilhar no Instagram
          </motion.button>

          <button
            onClick={onClose}
            className="relative z-10 text-xs font-bold text-white/60 underline-offset-2 hover:underline"
          >
            Continuar
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
