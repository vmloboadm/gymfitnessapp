"use client";

import { ReactNode } from "react";
import { LazyMotion, domAnimation } from "framer-motion";
import { Providers } from "~/components/providers";
import { SessionProvider } from "~/context/SessionContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LazyMotion features={domAnimation} strict>
        <Providers>{children}</Providers>
      </LazyMotion>
    </SessionProvider>
  );
}