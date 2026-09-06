"use client";

import { useEffect } from "react";
import { AnimatePresence,m } from "framer-motion";
import { X } from "lucide-react";

/**
 * Lightbox · amplia a ilustração do exercício em tela cheia.
 * Fundo claro (ilustrações line-art são pretas no branco) + fecha com X,
 * clique fora ou ESC.
 */
export function ImageLightbox({
  src,
  alt,
  open,
  onClose,
}: {
  src: string | null;
  alt?: string;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && src ? (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-5 backdrop-blur-sm"
          onClick={onClose}
        >
          <button
            onClick={onClose}
            aria-label="Fechar imagem"
            className="gf-touch absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
          >
            <X className="h-5 w-5" />
          </button>
          <m.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={alt ?? "Ilustração do exercício"} className="absolute inset-0 h-full w-full object-contain p-3" />
            </div>
            {alt ? (
              <p className="mt-3 text-center text-sm font-bold text-white/90">{alt}</p>
            ) : null}
            <p className="mt-1 text-center text-[10px] text-white/40">Toque fora pra fechar</p>
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
