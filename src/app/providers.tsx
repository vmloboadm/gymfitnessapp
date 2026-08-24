"use client";

import { ReactNode } from "react";
import { Providers } from "~/components/providers";
import { SessionProvider } from "~/context/SessionContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <Providers>{children}</Providers>
    </SessionProvider>
  );
}