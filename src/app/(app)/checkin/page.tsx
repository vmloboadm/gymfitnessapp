"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ScanLine, Check, X, LogIn, LogOut, Dumbbell, HeartPulse, Zap, Wrench } from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { toast } from "sonner";
import type { Equipment, EquipmentSessions } from "~/lib/types/models";
import { useSessionTimeout } from "~/hooks/useSessionTimeout";
import { WorkoutLogModal } from "~/components/workout-log-modal";
import {
  isDemoMode,
  demoFallback,
  demoFallbackOne,
  demoVariationsFor,
} from "~/lib/demo-bridge";
import { cn } from "~/lib/utils";

type CategoryMeta = { icon: any; label: string };

const categoryMeta: Record<string, CategoryMeta> = {
  strength: { icon: Dumbbell, label: "Força" },
  cardio: { icon: HeartPulse, label: "Cardio" },
  functional: { icon: Zap, label: "Funcional" },
  flexibility: { icon: Zap, label: "Flexibilidade" },
};

export default function CheckinPage() {
  const { user, profile } = useAuth();
  const [session, setSession] = useState<EquipmentSessions | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [variationPicker, setVariationPicker] = useState<string | null>(null);
  /** Aparelho detectado por deep link de tag NFC (iPhone/Android) aguardando confirmação. */
  const [pendingEq, setPendingEq] = useState<Equipment | null>(null);
  const demo = isDemoMode();

  const { data, loading, error, refetch } = useAsyncQuery<{
    equipment: Equipment[];
    activeSession: EquipmentSessions | null;
  }>(
    async () => {
      // Modo demo: entrega dados ricos direto.
      if (demo) {
        const equipment = demoFallback("equipment") as Equipment[];
        const active = demoFallbackOne("equipment") ? null : null;
        return {
          data: { equipment, activeSession: active },
          error: null,
        };
      }

      const supabase = supabaseBrowser();
      if (!user || !profile) return { data: null, error: { message: "Sessão indisponível" } };

      const [equip, active] = await Promise.all([
        supabase.from("equipment").select("*").eq("gym_id", profile.gym_id).order("name", { ascending: true }).limit(30),
        supabase.from("equipment_sessions").select("*").eq("student_id", user.id).eq("status", "active").maybeSingle(),
      ]);
      if (equip.error) return { data: null, error: equip.error };
      return {
        data: {
          equipment: equip.data as Equipment[],
          activeSession: active.data as EquipmentSessions | null,
        },
        error: null,
      };
    },
    [user?.id, profile?.id, demo]
  );

  // Sincroniza sessão ativa vinda do banco
  useEffect(() => {
    if (data?.activeSession && !session) {
      setSession(data.activeSession);
    }
  }, [data?.activeSession, session]);

  // ---------------------------------------------------------------------------
  // Deep link de tag NFC (/checkin?maquina=ID): iPhone lê a tag em segundo
  // plano pelo sistema e abre este link; Android também pode. Reconhece o
  // aparelho pelo id, slug do nome ou nfc_tag_url/qr_url.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!data?.equipment || session || pendingEq) return;
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get("maquina") ?? params.get("eq") ?? "").trim();
    if (!raw) return;

    const norm = (s: string | null | undefined) =>
      (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const target = decodeURIComponent(raw).toLowerCase();
    const eq = data.equipment.find((e) => {
      const candidates = [
        e.id,
        e.nfc_tag_url ?? "",
        e.qr_url ?? "",
        norm(e.name).replace(/\s+/g, "-"),
        norm(e.name).replace(/\s+/g, ""),
      ];
      return candidates.some((c) => c && (c.toLowerCase() === target || c.toLowerCase().endsWith(target)));
    });

    if (eq) {
      setPendingEq(eq);
      navigator.vibrate?.(60);
      // limpa a query da barra de endereço para não reabrir no refresh
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.equipment]);

  // Auto-close após 5 min inativo
  const closeSession = useCallback(async (confirm = false) => {
    if (!session) return;
    if (confirm) {
      const ok = window.confirm("Deseja finalizar a sessão e registrar o treino?");
      if (!ok) return;
    }
    setShowWorkoutModal(true);
    setSession(session);
  }, [session]);

  const { remainingLabel, resetTimer } = useSessionTimeout(
    session?.id ?? null,
    () => closeSession(true),
    5 * 60 * 1000
  );

  const startSession = async (equipmentId: string, variationId?: string) => {
    if (demo) {
      const eq = (data?.equipment ?? []).find((e) => e.id === equipmentId);
      const fakeSession: EquipmentSessions = {
        id: `demo-session-${Date.now()}`,
        gym_id: "00000000-0000-0000-0000-000000000001",
        equipment_id: equipmentId,
        variation_id: variationId ?? null,
        student_id: "00000000-0000-0000-0000-000000000099",
        status: "active",
        type: "regular",
        started_at: new Date().toISOString(),
        ended_at: null,
        meta: null,
      };
      setSession(fakeSession);
      toast.success(`${eq?.name ?? "Equipamento"} em uso`);
      resetTimer();
      return;
    }

    if (!user || !profile) return;
    // Fecha sessão anterior automaticamente
    if (session) {
      const supabase = supabaseBrowser();
      await supabase
        .from("equipment_sessions")
        .update({ status: "completed" as const, ended_at: new Date().toISOString() } as never)
        .eq("id", session.id);
      setSession(null);
    }

    const supabase = supabaseBrowser();
    const { data: inserted, error } = await supabase
      .from("equipment_sessions")
      .insert({
        gym_id: profile.gym_id,
        equipment_id: equipmentId,
        variation_id: variationId ?? null,
        student_id: user.id,
        status: "active" as const,
        type: "regular" as const,
      } as never)
      .select()
      .maybeSingle();
    if (error) {
      toast.error("Falha ao iniciar a sessão", { description: error.message });
      return;
    }
    setSession(inserted as EquipmentSessions);
    toast.success("Equipamento ocupado");
    resetTimer();
    refetch();
  };

  const endSession = async () => {
    if (!session) return;
    if (demo) {
      setSession(null);
      setShowWorkoutModal(false);
      toast.success("Sessão finalizada");
      return;
    }
    if (!user) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase
      .from("equipment_sessions")
      .update({ status: "completed" as const, ended_at: new Date().toISOString() } as never)
      .eq("id", session.id);
    if (error) {
      toast.error("Falha ao finalizar a sessão", { description: error.message });
      return;
    }
    setSession(null);
    toast.success("Equipamento liberado");
    refetch();
  };

  const scanSuccess = async (decodedText: string) => {
    // Procura equipamento (demo ou real)
    const code = decodedText.trim();
    const eq = (data?.equipment ?? []).find(
      (e) => e.qr_url === code || e.nfc_tag_url === code
    );
    if (eq) {
      const variations = demoVariationsFor(eq.id);
      if (variations.length > 0) {
        setVariationPicker(eq.id);
        setScannerActive(false);
        return;
      }
      await startSession(eq.id);
      setScannerActive(false);
      return;
    }
    toast.error("Código não corresponde a nenhum equipamento");
  };

  const startScanning = () => setScannerActive(true);
  const stopScanning = () => setScannerActive(false);

  // ---------------------------------------------------------------------------
  // NFC real (Web NFC / NDEFReader — Chrome no Android). A tag guarda a mesma
  // URL/código do campo nfc_tag_url do aparelho; a leitura cai no mesmo
  // scanSuccess do QR. Sem suporte → fallback explícito para QR.
  // ---------------------------------------------------------------------------
  const [nfcActive, setNfcActive] = useState(false);
  const nfcAbortRef = useRef<AbortController | null>(null);

  const todayLocalKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const startNfcScan = async () => {
    if (!("NDEFReader" in window)) {
      toast.info("No iPhone a leitura é do próprio sistema", {
        description: "Encoste o topo do iPhone na tag e toque na notificação da Apple.",
      });
      return;
    }
    try {
      const ndef = new (window as any).NDEFReader();
      navigator.vibrate?.(20);
      setNfcActive(true);
      nfcAbortRef.current = new AbortController();
      await ndef.scan({ signal: nfcAbortRef.current.signal });

      ndef.addEventListener("reading", ({ message }: any) => {
        const decoder = new TextDecoder();
        let text = "";
        for (const record of message.records ?? []) {
          text += decoder.decode(record.data ?? new ArrayBuffer(0));
        }
        setNfcActive(false);
        if (text) scanSuccess(text.trim());
      });

      ndef.addEventListener("readingerror", () => {
        setNfcActive(false);
        toast.error("Não deu para ler a tag. Aproxime de novo ou use o QR.");
      });
    } catch (err: any) {
      setNfcActive(false);
      if (err?.name !== "AbortError") {
        toast.error("Não foi possível iniciar o NFC.", { description: "Verifique a permissão e se o NFC está ligado." });
      }
    }
  };

  const stopNfcScan = () => {
    nfcAbortRef.current?.abort();
    setNfcActive(false);
  };

  // encerra leitor NFC ao desmontar
  useEffect(() => () => nfcAbortRef.current?.abort(), []);

  // QR scanning handler
useEffect(() => {
    if (!scannerActive) return;
    import("html5-qrcode").then((module) => {
      const codeReader = new (module.default as any)("scanner-reader");
      const onDecode = (result: string) => scanSuccess(result);
      codeReader
        .start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, onDecode, () => {})
        .catch(() => {
          toast.error("Câmera indisponível. Selecione uma máquina manualmente.");
          stopScanning();
        });
      return () => {
        codeReader.stop().catch(() => {});
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerActive]);

  const selectedEq = session
    ? (data?.equipment ?? []).find((e) => e.id === session.equipment_id)
    : null;

  // ---------------------------------------------------------------------------
  // Check-in de entrada / check-out de saída da academia (tabela checkins)
  // ---------------------------------------------------------------------------
  const [gymEntry, setGymEntry] = useState<{
    id: string;
    checked_at: string;
    source: string;
  } | null>(null);

  const doEntry = async (source: "nfc" | "qrcode" | "app" = "app") => {
    if (demo) {
      setGymEntry({ id: "ck-demo-" + Date.now(), checked_at: new Date().toISOString(), source });
      try { localStorage.setItem("gymfit_last_checkin", todayLocalKey()); } catch {}
      toast.success("Check-in de entrada realizado!");
      return;
    }
    if (!user || !profile) return;
    const supabase = supabaseBrowser();
    const { data: inserted, error } = await supabase
      .from("checkins")
      .insert({ gym_id: profile.gym_id, student_id: user.id, type: "entrada", source } as never)
      .select("id, checked_at, source")
      .maybeSingle();
    if (error) {
      toast.error("Falha no check-in", { description: error.message });
      return;
    }
    setGymEntry(inserted as any);
    try { localStorage.setItem("gymfit_last_checkin", todayLocalKey()); } catch {}
    toast.success("Check-in de entrada realizado!");
  };

  const doExit = async () => {
    // fecha qualquer sessão de equipamento ativa
    if (session) await endSession();
    if (demo) {
      setGymEntry(null);
      try { localStorage.removeItem("gymfit_last_checkin"); } catch {}
      toast.success("Check-out realizado. Treino concluído!");
      return;
    }
    if (!user || !profile) return;
    const supabase = supabaseBrowser();
    const { error } = await supabase
      .from("checkins")
      .insert({ gym_id: profile.gym_id, student_id: user.id, type: "saida", source: "app" } as never);
    if (error) {
      toast.error("Falha no check-out", { description: error.message });
      return;
    }
    setGymEntry(null);
    try { localStorage.removeItem("gymfit_last_checkin"); } catch {}
    toast.success("Check-out realizado. Treino concluído!");
  };

  if (loading) {
    return (
      <>
        <TopBar title="Check-in" subtitle="Equipamentos livres" />
        <div className="space-y-6 p-4">
          <div className="h-28 rounded-xl bg-card/40" />
          <SkeletonList rows={5} />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <TopBar title="Check-in" />
        <div className="space-y-6 p-4">
          <ErrorState message={error} onRetry={refetch} />
        </div>
      </>
    );
  }

  const equipment = data?.equipment ?? [];

  return (
    <>
      <TopBar
        title="Check-in"
        subtitle={session ? "Sessão em andamento" : `${equipment.length} máquinas na academia`}
      />

      {/* Check-in de entrada / check-out de saída da academia */}
      <div className="space-y-6 p-4">
        <div
          className={cn(
            "flex flex-col gap-3 rounded-2xl border p-4",
            gymEntry
              ? "border-success/40 bg-success/10"
              : "border-border bg-card/50"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-foreground">
                {gymEntry ? "Você está na academia" : "Entrada na academia"}
              </p>
              <p className="text-xs text-muted-foreground">
                {gymEntry
                  ? `Check-in ${gymEntry.source === "nfc" ? "via NFC" : gymEntry.source === "qrcode" ? "via QR" : "via app"}`
                  : "Escaneie o QR/NFC da entrada para iniciar seu treino"}
              </p>
            </div>
            {gymEntry ? (
              <Button size="sm" variant="outline" onClick={doExit}>
                <LogOut className="mr-1 h-3.5 w-3.5" />
                Fazer check-out
              </Button>
            ) : (
              <Button size="sm" onClick={() => doEntry("app")}>
                <LogIn className="mr-1 h-3.5 w-3.5" />
                Check-in agora
              </Button>
            )}
          </div>
          {gymEntry && (
            <div className="flex items-center gap-2 rounded-xl bg-card/50 px-3 py-2 text-xs text-success">
              <span className="hero-live-dot" />
              Treino em andamento — ao sair, o treino inteiro é finalizado.
            </div>
          )}
        </div>
      </div>

      {session && selectedEq && (
        <div className="tactile relative overflow-hidden rounded-2xl border border-brand/40 bg-gradient-to-br from-brand/20 via-brand/5 to-transparent p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand">
                <span className="hero-live-dot" />
                Sessão ativa
              </p>
              <h2 className="mt-1 text-lg font-black text-foreground">{selectedEq.name}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {selectedEq.category} · {selectedEq.capacity} vagas
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-card/70 px-3 py-1 text-xs font-semibold tabular-nums text-foreground">
                <span className="hero-live-dot" />
                fechamento em {remainingLabel || "5:00"}
              </div>
            </div>
            <Button size="sm" onClick={() => closeSession(true)}>
              <X className="mr-1 h-3.5 w-3.5" />
              Finalizar
            </Button>
          </div>
          <button
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/30 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => setScannerActive(true)}
          >
            <ScanLine className="h-4 w-4" />
            Escanear outro equipamento (encerra esta sessão)
          </button>
        </div>
      )}

      {/* Tag NFC detectada pelo link — pede confirmação antes de abrir sessão */}
      {pendingEq && !session ? (
        <div className="animate-fade-in rounded-[20px] border border-success/40 bg-gradient-to-br from-success/15 via-card to-card p-5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-success">
            <span className="hero-live-dot" /> Tag lida com sucesso
          </p>
          <h2 className="mt-1.5 text-lg font-black text-foreground">{pendingEq.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">É este aparelho que você vai usar?</p>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                startSession(pendingEq.id);
                setPendingEq(null);
              }}
              className="flex-1"
            >
              <Check className="mr-1.5 h-4 w-4" /> Confirmar e iniciar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPendingEq(null)}>
              Não é esse
            </Button>
          </div>
        </div>
      ) : null}

      {/* NFC — o diferencial GymFitness, explicado sem jargão */}
      <div className="relative overflow-hidden rounded-[20px] border border-brand/35 bg-gradient-to-br from-brand/15 via-card to-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand text-brand-foreground shadow-lg shadow-brand/30">
            <ScanLine className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-foreground">Toque e treine</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Os aparelhos da academia têm tag NFC.{" "}
              <span className="font-semibold text-foreground">Encoste o celular nela</span> e a
              sessão abre sozinha — seu uso já fica registrado, sem procurar nada na lista.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { n: "1", label: "Encoste no aparelho" },
            { n: "2", label: "Confirme na tela" },
            { n: "3", label: "Treine — fecha ao trocar" },
          ].map((s) => (
            <div key={s.n} className="rounded-xl border border-border bg-card/50 px-2 py-2.5">
              <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-brand/15 text-[10px] font-bold text-brand">
                {s.n}
              </span>
              <p className="mt-1 text-[10px] font-medium leading-tight text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">iPhone:</span> encoste o topo do aparelho na tag —
          aparece uma notificação da Apple; toque nela e a sessão abre aqui.
          <br />
          <span className="font-semibold text-foreground">Android:</span> use o botão abaixo (ou deixe a
          leitura automática do sistema ligada).
        </p>

        <div className="mt-4 flex items-center gap-2">
          {nfcActive ? (
            <Button size="sm" variant="outline" onClick={stopNfcScan} className="flex-1 border-warning/40 text-warning">
              Lendo NFC… toque para cancelar
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={startNfcScan} className="flex-1">
                <ScanLine className="mr-1.5 h-3.5 w-3.5" />
                Ler tag pelo app (Android)
              </Button>
              <Button size="sm" variant="outline" onClick={startScanning}>
                Ler QR Code
              </Button>
            </>
          )}
        </div>
      </div>


      {session ? (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-warning">
          <LogOut className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Ao escanear outra máquina, esta sessão fecha automaticamente e vira log de treino.
          </span>
        </div>
      ) : null}

      {/* Scanner overlay */}
      {scannerActive && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90 p-6"
          onClick={stopScanning}
        >
          <p className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold text-white">
            Aponte para o QR Code da máquina
          </p>
          <div
            id="scanner-reader"
            className="h-64 w-full max-w-xs overflow-hidden rounded-2xl border-2 border-brand"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="rounded-full bg-white/10 px-6 py-2 text-sm font-semibold text-white"
            onClick={stopScanning}
          >
            Fechar
          </button>
        </div>
      )}

      {/* Modal para registro de treino */}
      {showWorkoutModal && session && (
        <WorkoutLogModal
          open={showWorkoutModal}
          onOpenChange={setShowWorkoutModal}
          sessionId={session.id}
          equipmentName={selectedEq?.name ?? "Equipamento"}
          onClose={() => {
            setShowWorkoutModal(false);
            endSession();
          }}
        />
      )}

      {/* Seletor de variações */}
      {variationPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-6">
          <div className="w-full max-w-md rounded-t-2xl border border-border bg-background p-5 pb-8 md:rounded-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-foreground">Escolha a variação</h3>
                <p className="text-xs text-muted-foreground">
                  {
                    (data?.equipment ?? []).find((e) => e.id === variationPicker)
                      ?.name
                  }{" "}
                  tem várias variações de exercício.
                </p>
              </div>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
                onClick={() => setVariationPicker(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {demoVariationsFor(variationPicker).map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    startSession(variationPicker, v.id);
                    setVariationPicker(null);
                  }}
                  className="tactile flex w-full items-center justify-between rounded-xl border border-border bg-card/50 p-3.5 text-left transition-colors hover:border-brand/40"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{v.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.default_sets} séries × {v.default_reps} reps
                    </p>
                  </div>
                  <LogIn className="h-4 w-4 text-brand" />
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              className="mt-3 w-full"
              onClick={() => {
                startSession(variationPicker);
                setVariationPicker(null);
              }}
            >
              Sessão livre (sem variação)
            </Button>
          </div>
        </div>
      )}
    </>
  );
}