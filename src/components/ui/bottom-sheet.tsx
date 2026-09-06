"use client";

import { X } from "lucide-react";
import { AnimatePresence,m } from "framer-motion";

/** Bottom Sheet deslizante de baixo (mobile-first), fecha no backdrop. */
export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <m.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 md:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <m.div
            role="dialog"
            aria-modal="true"
            className="max-h-[86vh] w-full max-w-md overflow-y-auto rounded-t-[24px] border border-border bg-background p-5 pb-9 md:rounded-[24px] md:pb-5"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" aria-hidden />
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="tactile absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
