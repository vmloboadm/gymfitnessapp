"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "~/hooks/useAuth";
import { OfflineSyncListener } from "~/components/common/OfflineSyncListener";
import { StaffTour } from "~/components/staff/StaffTour";
import { StudentTour } from "~/components/student/StudentTour";
import { PageTracker } from "~/components/analytics/PageTracker";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <StaffTour />
        <StudentTour />
        <PageTracker />
      </AuthProvider>
      <OfflineSyncListener />
    </QueryClientProvider>
  );
}