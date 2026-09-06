"use client";

import { AnimatePresence,m } from "framer-motion";
import { X } from "lucide-react";

/**
 * Player de vídeo SOB DEMANDA: o <video> só monta quando `open` é true
 * (preload="none" + montagem condicional = zero request antes do clique).
 */
export function ExerciseVideoModal({
  open,
  onClose,
  name,
  poster,
  videoUrl,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  poster?: string | null;
  videoUrl?: string | null;
}) {
  return (
    <AnimatePresence>
      {open && videoUrl ? (
        <m.div
          className="fixed inset-0 z-[60] flex flex-col bg-black/95"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="min-w-0 truncate text-sm font-bold text-white">{name}</p>
            <button
              onClick={onClose}
              aria-label="Fechar vídeo"
              className="gf-touch flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* vídeo */}
          <m.div
            className="flex flex-1 items-center justify-center px-2 pb-6"
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              key={videoUrl}
              controls
              preload="none"
              playsInline
              poster={poster ?? undefined}
              className="max-h-[72vh] w-full rounded-2xl border border-white/10 bg-black"
              src={videoUrl}
            />
          </m.div>

          <p className="pb-6 text-center text-[11px] text-white/50">
            Dica: gire o celular para ver em tela cheia.
          </p>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
