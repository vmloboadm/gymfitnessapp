"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ScanLine, Check, X, LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "~/hooks/useAuth";
import { supabaseBrowser } from "~/lib/supabase/client";
import { TopBar } from "~/components/layout/TopBar";
import { Button } from "~/components/ui/button";
import { SkeletonList, ErrorState } from "~/components/common/AsyncStates";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { toast } from "sonner";
import type { Equipment, EquipmentSessions } from "~/lib/types/models";
import { useSessionTimeout } from "~/hooks/useSessionTimeout";
import { useWorkoutSession, endWorkoutSession, readSessionProgress, formatMMSS, elapsedSeconds } from "~/lib/workout-session";
import { getTodayWorkout } from "~/lib/today-workout";
import { WorkoutLogModal } from "~/components/workout-log-modal";
import {
  isDemoMode,
  demoFallback,
  demoFallbackOne,
  demoVariationsFor,
} from "~/lib/demo-bridge";
import { cn } from "~/lib/utils";




export default function CheckinPage() {
  const { user, profile } = useAuth();
  const [session, setSession] = useState<EquipmentSessions | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [variationPicker, setVariationPicker] = useState<string | null>(null);
  /** Aparelho detectado por deep link de tag NFC (iPhone/Android) aguardando confirmação. */
  const [pendingEq, setPendingEq] = useState<Equipment | null>(null);
  const { session: daySession, start: startDaySession } = useWorkoutSession();
  const router = useRouter();
  /** Chegou via gate (?scan=1&from=...): scanner abre sozinho e qualquer leitura valida a entrada. */
  const [doorMode, setDoorMode] = useState(false);
  const [cameFrom, setCameFrom] = useState<string | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const [mockValidating, setMockValidating] = useState(false);
  const demo = isDemoMode();

  // ---- métricas "Sua sessão hoje" ----
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!daySession) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [daySession]);
  const sessionMetrics = useMemo(() => {
    const logs = getTodayWorkout().logs as Array<{ date: string }>;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const diasSemana = new Set(logs.filter((l) => l.date?.slice(0, 10) >= weekAgo).map((l) => l.date.slice(0, 10)));
    const hoje = new Date().toISOString().slice(0, 10);
    const treinouHoje = diasSemana.has(hoje);
    const progresso = readSessionProgress();
    const entrada = daySession ? new Date(daySession.startedAt) : null;
    return {
      entradaHora: entrada ? entrada.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null,
      tempoNa: daySession ? formatMMSS(elapsedSeconds(daySession.startedAt, nowTick)) : null,
      treinoHoje: progresso ? "Em andamento" : treinouHoje ? "Concluído" : "Não iniciado",
      semana: diasSemana.size,
    };
  }, [daySession, nowTick]);

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
      startDaySession();
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
      toast.success(`Treino liberado em ${eq?.name ?? "aparelho"}`);
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
    toast.success("Aparelho seu por agora. Bora!");
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
    if (doorMode) {
      // tag da PORTARIA: valida entrada e volta ao treino (aluno inicia quando quiser)
      navigator.vibrate?.([60, 40, 60]);
      startDaySession();
      stopScanning();
      toast.success("Entrada validada! Treino liberado");
      router.push("/treino");
      return;
    }
    toast.error("Código não corresponde a nenhum equipamento");
  };

  const startScanning = () => setScannerActive(true);
  const stopScanning = () => setScannerActive(false);

  // ---------------------------------------------------------------------------
  // NFC real (Web NFC / NDEFReader, Chrome no Android). A tag guarda a mesma
  // URL/código do campo nfc_tag_url do aparelho; a leitura cai no mesmo
  // scanSuccess do QR. Sem suporte → fallback explícito para QR.
  // ---------------------------------------------------------------------------
  const [nfcActive, setNfcActive] = useState(false);
  const nfcAbortRef = useRef<AbortController | null>(null);

  const backToOrigin = () => router.replace(cameFrom ?? "/");

  const startNfcScan = async () => {
    if (!("NDEFReader" in window)) {
      toast.info("No iPhone a leitura é do próprio sistema", {
        description: "Encoste o topo do iPhone na tag e toque na notificação da Apple.",
      });
      return;
    }
    // Tipagem mínima da Web NFC API (sem @types/web-nfc no projeto).
    type NdefRecord = { data?: ArrayBuffer };
    type NdefMessage = { records?: NdefRecord[] };
    type NdefReaderLike = {
      scan: (opts: { signal: AbortSignal }) => Promise<void>;
      addEventListener: (
        ev: "reading" | "readingerror",
        cb: (e?: { message?: NdefMessage }) => void
      ) => void;
    };

    try {
      const Ctor = (window as unknown as { NDEFReader: new () => NdefReaderLike })
        .NDEFReader;
      const ndef = new Ctor();
      navigator.vibrate?.(20);
      setNfcActive(true);
      nfcAbortRef.current = new AbortController();
      await ndef.scan({ signal: nfcAbortRef.current.signal });

      ndef.addEventListener("reading", (evt) => {
        const decoder = new TextDecoder();
        let text = "";
        for (const record of evt?.message?.records ?? []) {
          text += decoder.decode(record.data ?? new ArrayBuffer(0));
        }
        setNfcActive(false);
        if (text) scanSuccess(text.trim());
      });

      ndef.addEventListener("readingerror", () => {
        setNfcActive(false);
        toast.error("Não deu para ler a tag. Aproxime de novo ou use o QR.");
      });
    } catch (err: unknown) {
      setNfcActive(false);
      if ((err as { name?: string } | null)?.name !== "AbortError") {
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

  // Contexto do gate (?scan=1&from=/treino): abre câmera automaticamente
  useEffect(() => {
    if (autoOpened) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const scan = params.get("scan") === "1";
    const from = params.get("from");
    if (!scan && !from) return;
    setAutoOpened(true);
    setDoorMode(scan);
    if (from) setCameFrom(from);
    if (daySession) {
      // já liberado: devolve pra origem
      router.replace(from ?? "/");
      return;
    }
    if (scan) {
      const to = setTimeout(() => startScanning(), 350);
      return () => clearTimeout(to);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpened]);

  // QR scanning handler — store ref for cleanup to avoid camera leak
  const codeReaderRef = useRef<any>(null);
  useEffect(() => {
    if (!scannerActive) return;
    let alive = true;
    import("html5-qrcode")
      .then((module) => {
        if (!alive) return;
        const codeReader = new (module.default as any)("scanner-reader");
        codeReaderRef.current = codeReader;
        const onDecode = (result: string) => scanSuccess(result);
        codeReader
          .start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, onDecode, () => {})
          .catch(() => {
            if (!alive) return;
            toast.error("Câmera indisponível. Selecione uma máquina manualmente.");
            stopScanning();
          });
      })
      .catch(() => {
        if (!alive) return;
        toast.error("Falha ao carregar leitor QR. Tente novamente.");
        stopScanning();
      });
    return () => {
      alive = false;
      codeReaderRef.current?.stop().catch(() => {});
      codeReaderRef.current = null;
    };
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
      startDaySession();
      toast.success("Check-in de entrada realizado!");
      router.push("/treino");
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
    startDaySession();
    toast.success("Check-in de entrada realizado!");
  };

  const doExit = async () => {
    // fecha qualquer sessão de equipamento ativa
    if (session) await endSession();
    if (demo) {
      setGymEntry(null);
endWorkoutSession();
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
    endWorkoutSession();
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
                {gymEntry || session
                  ? `Check-in ${gymEntry?.source === "nfc" ? "via NFC" : gymEntry?.source === "qrcode" ? "via QR" : "validado"} · treino liberado`
                  : doorMode
                    ? "Aponte a câmera para o QR da portaria ou use o NFC"
                    : "Escaneie o QR/NFC da entrada para iniciar seu treino"}
              </p>
            </div>
            {gymEntry || daySession || session ? (
              <Button size="sm" variant="outline" onClick={doExit}>
                <LogOut className="mr-1 h-3.5 w-3.5" />
                Fazer check-out
              </Button>
            ) : mockValidating ? (
              <span className="flex shrink-0 items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-4 py-2 text-[12px] font-bold text-brand">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                Validando…
              </span>
            ) : (
              <div className="flex shrink-0 flex-col gap-1.5">
                <Button size="sm" onClick={() => doEntry("app")}>
                  <LogIn className="mr-1 h-3.5 w-3.5" />
                  Check-in agora
                </Button>
                {doorMode && demo ? (
                  <MockPortariaButton
                    onValidated={() => {
                      startDaySession();
                      toast.success("Entrada validada! Treino liberado");
                      backToOrigin();
                    }}
                  />
                ) : null}
              </div>
            )}
          </div>
          {gymEntry && (
            <div className="flex items-center gap-2 rounded-xl bg-card/50 px-3 py-2 text-xs text-success">
              <span className="hero-live-dot" />
              Treino em andamento, ao sair, o treino inteiro é finalizado.
            </div>
          )}
        </div>

        {/* Métricas da sessão de hoje */}
        <div className="rounded-2xl border border-border bg-card/50 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sua sessão hoje</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Entrada</p>
              <p className="pm-num mt-1 text-xl font-black text-foreground">{sessionMetrics.entradaHora ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Tempo na academia</p>
              <p className="pm-num mt-1 text-xl font-black tabular-nums text-brand">{sessionMetrics.tempoNa ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Treino de hoje</p>
              <p className={cn("mt-1 text-sm font-black", sessionMetrics.treinoHoje === "Em andamento" ? "text-warning" : sessionMetrics.treinoHoje === "Concluído" ? "text-success" : "text-muted-foreground")}>
                {sessionMetrics.treinoHoje}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Treinos na semana</p>
              <p className="pm-num mt-1 text-xl font-black text-foreground">{sessionMetrics.semana}<span className="text-xs text-muted-foreground">/7</span></p>
            </div>
          </div>
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

      {/* Tag NFC detectada pelo link, pede confirmação antes de abrir sessão */}
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

      {/* NFC, o diferencial GymFitness, explicado sem jargão */}
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
              sessão abre sozinha, seu uso já fica registrado, sem procurar nada na lista.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { n: "1", label: "Encoste no aparelho" },
            { n: "2", label: "Confirme na tela" },
            { n: "3", label: "Treine, fecha ao trocar" },
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
          <span className="font-semibold text-foreground">iPhone:</span> encoste o topo do aparelho na tag -
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

function MockPortariaButton({ onValidated }: { onValidated: () => void }) {
  const [validating, setValidating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleClick = () => {
    setValidating(true);
    timerRef.current = setTimeout(() => {
      setValidating(false);
      navigator.vibrate?.([60, 40, 60]);
      onValidated();
    }, 1000);
  };

  if (validating) {
    return (
      <span className="flex shrink-0 items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-4 py-2 text-[12px] font-bold text-brand">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
        Validando…
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-warning"
    >
      Simular leitura da portaria (demo)
    </button>
  );
}