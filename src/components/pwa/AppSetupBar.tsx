"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { BellRing, Copy, Download, ExternalLink, MoreVertical, Share, SquarePlus, X } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { usePush } from "~/hooks/usePush";
import { usePWAInstall } from "~/hooks/usePWAInstall";
import { useWorkoutSession } from "~/lib/workout-session";
import { appSetupStep, isIOS, type SetupStep } from "~/lib/app-setup";

/**
 * Barra "deixe o app pronto" em todas as telas do aluno, logo acima do menu:
 * abrir no navegador (se veio pelo Instagram/WhatsApp) → instalar → ativar
 * notificações. O "x" adia (3 dias instalar, 5 dias push), nunca some para
 * sempre. Some durante o treino e na tela de treino.
 */
const SNOOZE = { install: 3 * 86_400_000, push: 5 * 86_400_000 };
const KEYS = { install: "gf_setup_install_snooze", push: "gf_setup_push_snooze" };

function isSnoozed(kind: keyof typeof KEYS): boolean {
  try {
    const at = Number(localStorage.getItem(KEYS[kind]) ?? 0);
    return at > 0 && Date.now() - at < SNOOZE[kind];
  } catch {
    return false;
  }
}

function snooze(kind: keyof typeof KEYS) {
  try {
    localStorage.setItem(KEYS[kind], String(Date.now()));
  } catch {
    /* sem storage: só esconde agora */
  }
}

const COPY: Record<SetupStep, { title: string; text: string; cta: string }> = {
  "open-in-browser": {
    title: "Abra no navegador",
    text: "Daqui não dá para instalar o app",
    cta: "Ver como",
  },
  "install-android-prompt": {
    title: "Instale o app",
    text: "Abre rápido e recebe avisos",
    cta: "Instalar",
  },
  "install-android-manual": {
    title: "Instale o app",
    text: "Abre rápido e recebe avisos",
    cta: "Instalar",
  },
  "install-ios": {
    title: "Instale o app",
    text: "10 segundos e libera os avisos",
    cta: "Instalar",
  },
  push: {
    title: "Ative os avisos",
    text: "Curtidas, conquistas e treino novo",
    cta: "Ativar",
  },
};

export function AppSetupBar() {
  const pathname = usePathname();
  const push = usePush();
  const pwa = usePWAInstall();
  const { session } = useWorkoutSession();
  const [ua, setUa] = useState("");
  const [snoozed, setSnoozed] = useState({ install: true, push: true });
  const [sheet, setSheet] = useState<SetupStep | null>(null);

  useEffect(() => {
    setUa(navigator.userAgent);
    setSnoozed({ install: isSnoozed("install"), push: isSnoozed("push") });
  }, []);

  const step = useMemo(
    () =>
      ua
        ? appSetupStep({
            ua,
            standalone: pwa.installed,
            hasInstallPrompt: pwa.canPrompt,
            pushSupported: push.supported,
            permission: push.permission,
            pushActive: push.active,
            installSnoozed: snoozed.install,
            pushSnoozed: snoozed.push,
          })
        : null,
    [ua, pwa.installed, pwa.canPrompt, push.supported, push.permission, push.active, snoozed]
  );

  if (!step || session || pathname?.startsWith("/treino")) return null;
  const c = COPY[step];

  const close = () => {
    const kind = step === "push" ? "push" : "install";
    snooze(kind);
    setSnoozed((s) => ({ ...s, [kind]: true }));
  };

  const act = async () => {
    if (step === "push") {
      const ok = await push.enable();
      if (ok) toast.success("Notificações ligadas! Você fica sabendo na hora.");
      return;
    }
    if (step === "install-android-prompt") {
      const ok = await pwa.promptInstall();
      if (ok) toast.success("App instalado! Abra pelo ícone GymFitness.");
      return;
    }
    setSheet(step);
  };

  const Icon = step === "push" ? BellRing : step === "open-in-browser" ? ExternalLink : step === "install-ios" ? Share : Download;

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 px-3 md:mx-auto md:max-w-md">
        <div className="gf-rise flex items-center gap-3 rounded-2xl border border-brand/40 bg-card/95 p-3 shadow-lg shadow-black/30 backdrop-blur">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-black text-foreground">{c.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">{c.text}</p>
          </div>
          <button
            type="button"
            onClick={() => void act()}
            disabled={push.enabling}
            className="tactile shrink-0 rounded-xl bg-brand px-3.5 py-2 text-[12px] font-black text-brand-foreground disabled:opacity-60"
          >
            {c.cta}
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Lembrar depois"
            className="tactile shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <BottomSheet open={sheet !== null} onClose={() => setSheet(null)}>
        {sheet ? <SetupGuide step={sheet} ua={ua} /> : null}
      </BottomSheet>
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-black text-brand-foreground">
        {n}
      </span>
      <div className="pt-0.5 text-[14px] leading-snug text-foreground">{children}</div>
    </li>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 align-middle text-[12px] font-bold">
      {children}
    </span>
  );
}

function SetupGuide({ step, ua }: { step: SetupStep; ua: string }) {
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado! Cole no Safari ou no Chrome.");
    } catch {
      toast.message("Copie o endereço da barra do navegador.");
    }
  };

  return (
    <div className="space-y-4 p-1 pb-4">
      {step === "install-ios" ? (
        <>
          <h2 className="text-lg font-black text-foreground">Instalar no iPhone</h2>
          <ol className="space-y-3">
            <Step n={1}>
              Toque em <Kbd><Share className="h-3.5 w-3.5" /> Compartilhar</Kbd> na barra do Safari (embaixo ou em cima).
            </Step>
            <Step n={2}>
              Role e toque em <Kbd><SquarePlus className="h-3.5 w-3.5" /> Adicionar à Tela de Início</Kbd>.
            </Step>
            <Step n={3}>
              Toque em <Kbd>Adicionar</Kbd>. Depois abra pelo ícone <b>GymFitness</b> e ative as notificações.
            </Step>
          </ol>
        </>
      ) : null}

      {step === "install-android-manual" ? (
        <>
          <h2 className="text-lg font-black text-foreground">Instalar no Android</h2>
          <ol className="space-y-3">
            <Step n={1}>
              Toque no menu <Kbd><MoreVertical className="h-3.5 w-3.5" /></Kbd> no canto de cima do navegador.
            </Step>
            <Step n={2}>
              Toque em <Kbd>Instalar app</Kbd> ou <Kbd>Adicionar à tela inicial</Kbd>.
            </Step>
            <Step n={3}>Confirme. O ícone <b>GymFitness</b> aparece na tela inicial.</Step>
          </ol>
        </>
      ) : null}

      {step === "open-in-browser" ? (
        <>
          <h2 className="text-lg font-black text-foreground">Abra no navegador</h2>
          <p className="text-[13px] text-muted-foreground">
            Você abriu o link por dentro de outro app, e ele não deixa instalar.
          </p>
          <ol className="space-y-3">
            {isIOS(ua) ? (
              <Step n={1}>
                Toque em <Kbd>•••</Kbd> ou <Kbd><Share className="h-3.5 w-3.5" /></Kbd> e escolha <Kbd>Abrir no Safari</Kbd>.
              </Step>
            ) : (
              <Step n={1}>
                Toque em <Kbd><MoreVertical className="h-3.5 w-3.5" /></Kbd> e escolha <Kbd>Abrir no Chrome</Kbd>.
              </Step>
            )}
            <Step n={2}>Lá, esta barra vai te guiar para instalar.</Step>
          </ol>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="tactile flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-[13px] font-bold text-foreground"
          >
            <Copy className="h-4 w-4" /> Copiar link do app
          </button>
        </>
      ) : null}
    </div>
  );
}
