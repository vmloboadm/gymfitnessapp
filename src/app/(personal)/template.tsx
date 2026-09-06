"use client";

import { m } from "framer-motion";

/**
 * Transição premium de entrada em TODAS as telas da área do personal,
 * idêntica à do app do aluno: fade + subida suave + saída de blur.
 */
export default function PersonalTemplate({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </m.div>
  );
}
