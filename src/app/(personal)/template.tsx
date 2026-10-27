"use client";

import { m } from "framer-motion";

/** Mesma regra do app: sem transform/filter no wrapper de página. */
export default function PersonalTemplate({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {children}
    </m.div>
  );
}
