"use client";

import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser } from "~/lib/supabase/client";

export type PendingClearance = {
  id: string;
  student_id: string;
  student_name: string;
  document_url: string;
  created_at: string;
  medications: string | null;
  surgery_history: string | null;
};

/**
 * Lista laudos médicos pendentes de aprovação para o gym.
 */
export function usePendingClearances(gymId: string | undefined) {
  const [clearances, setClearances] = useState<PendingClearance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!gymId) { setLoading(false); return; }
    const sb = supabaseBrowser();
    const { data } = await sb
      .from("medical_clearances")
      .select("id, student_id, document_url, created_at, profiles(name, medications, surgery_history)")
      .eq("gym_id", gymId)
      .eq("approved", false)
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as unknown as Array<{
      id: string;
      student_id: string;
      document_url: string;
      created_at: string;
      profiles: { name: string; medications: string | null; surgery_history: string | null } | null;
    }>;

    setClearances(
      rows.map((r) => ({
        id: r.id,
        student_id: r.student_id,
        student_name: r.profiles?.name ?? "Aluno",
        document_url: r.document_url,
        created_at: r.created_at,
        medications: r.profiles?.medications ?? null,
        surgery_history: r.profiles?.surgery_history ?? null,
      }))
    );
    setLoading(false);
  }, [gymId]);

  useEffect(() => { fetch(); }, [fetch]);

  const approve = useCallback(async (clearanceId: string, reviewerId: string) => {
    const sb = supabaseBrowser();
    const { error } = await sb
      .from("medical_clearances")
      .update({ approved: true, approved_at: new Date().toISOString(), reviewed_by: reviewerId } as never)
      .eq("id", clearanceId);
    if (error) throw new Error(error.message);
    await fetch();
  }, [fetch]);

  return { clearances, loading, approve, refetch: fetch };
}
