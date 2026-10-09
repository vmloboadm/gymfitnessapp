"use client";

import { X, Download, Share } from "lucide-react";
import { usePWAInstall } from "~/hooks/usePWAInstall";

/**
 * Convite para instalar o PWA (aparece na home quando dá para instalar).
 * Android abre o instalador direto; iPhone mostra o passo a passo.
 * Dispensável e lembrado (não enche).
 */
export function PWAInstallBanner() {
  const { showable, isIOS, promptInstall, dismiss } = usePWAInstall();

  if (!showable) return null;

  return (
    <div className="gf-rise flex items-center gap-3 rounded-2xl border border-brand/40 bg-gradient-to-br from-brand/20 via-card to-card p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-foreground">
        {isIOS ? <Share className="h-5 w-5" /> : <Download className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-black text-foreground">Instale o app GymFitness</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
          {isIOS
            ? "Toque em Compartilhar e depois em Adicionar à Tela de Início."
            : "Acesso direto na tela inicial, abre rápido e funciona melhor."}
        </p>
      </div>
      {!isIOS ? (
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="tactile shrink-0 rounded-xl bg-brand px-4 py-2.5 text-[12px] font-black text-brand-foreground"
        >
          Instalar
        </button>
      ) : null}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar convite de instalação"
        className="tactile shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
