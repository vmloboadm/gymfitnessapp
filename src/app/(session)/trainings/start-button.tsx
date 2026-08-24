"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QrCode, LogOut } from "lucide-react";
import { useSessionContext } from "~/context/SessionContext";
import { checkEquipments } from "~/lib/supabase/equipment-checkin";

interface StartButtonProps {
  gymId: string;
}

/**
 * Botão de início de sessão de equipamento (check-in por NFC/QR).
 * Em produção usa o Supabase (checkEquipments); em demo mostra sessão ativa.
 */
export default function StartButton({ gymId }: StartButtonProps) {
  const { session, setSession } = useSessionContext();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
    if (demo && !session) {
      // demo: injeta uma sessão fake para mostrar o fluxo
      const fake = {
        id: "demo-session-" + Date.now(),
        equipment_id: "eq-demo-001",
        variation_id: null,
        name: "Supino Reto",
        variation_name: null,
        student_id: "00000000-0000-0000-0000-000000000099",
        status: "active" as const,
        type: "regular" as const,
        started_at: new Date().toISOString(),
        ended_at: null,
        meta: null,
        active: true,
      };
      setSession(fake as any);
    }
  }, [session, setSession]);

  const startSession = async () => {
    const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
    if (demo) {
      router.push("/checkin");
      return;
    }
    setLoading(true);
    try {
      const result = await checkEquipments(gymId);
      if (result && typeof result === "object") {
        setSession(result as any);
        router.push("/checkin");
      } else {
        alert("Nenhum equipamento disponível");
      }
    } catch (error) {
      console.error("Falha ao buscar equipamentos:", error);
      alert("Erro ao conectar equipamento");
    } finally {
      setLoading(false);
    }
  };

  const endSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSession(null);
  };

  if (session && session.status === "active") {
    return (
      <button
        onClick={endSession}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm text-muted-foreground"
      >
        <LogOut className="h-4 w-4" />
        Encerrar sessão: {session.name || "Equipamento"}
      </button>
    );
  }

  return (
    <button
      onClick={startSession}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-brand-foreground shadow-lg shadow-brand/30 disabled:opacity-60"
    >
      <QrCode className="h-4 w-4" />
      {loading ? "Conectando..." : "Iniciar treino na máquina"}
    </button>
  );
}