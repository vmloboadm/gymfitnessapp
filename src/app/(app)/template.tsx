"use client";

import { motion } from "framer-motion";

/**
 * Transição premium de entrada em TODAS as telas do app:
 * fade + subida suave + saída de blur. Rápido (0.28s) pra não travar navegação.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
