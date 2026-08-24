import { supabaseBrowser } from "./client";
import type { EquipmentSessions } from "~/lib/types/models";

export async function checkEquipments(gymId: string) {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("equipment")
    .select("*")
    .eq("gym_id", gymId)
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: "temp-session-" + Date.now(),
    equipment_id: data.id,
    variation_id: null,
    name: data.name,
    variation_name: null,
    student_id: "temp-student",
    status: "active" as const,
    type: "regular" as const,
    started_at: new Date().toISOString(),
    ended_at: null,
    meta: null,
  };
}

export async function startEquipmentSession(
  studentId: string,
  equipmentId: string,
  gymId: string,
  variationId?: string
): Promise<EquipmentSessions | null> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("equipment_sessions")
    .insert({
      gym_id: gymId,
      equipment_id: equipmentId,
      variation_id: variationId ?? null,
      student_id: studentId,
      status: "active" as const,
      type: "regular" as const,
      started_at: new Date().toISOString(),
      ended_at: null,
      meta: null,
    } as never)
    .select("*")
    .maybeSingle();
  if (error) return null;
  return data as EquipmentSessions;
}