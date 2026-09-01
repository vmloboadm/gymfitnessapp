"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  MessageCircle,
  Flame,
  Trophy,
  CircleAlert,
  ChevronRight,
  Bell,
  Activity,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { useAuth } from "~/hooks/useAuth";
import { demoOnlineAgora } from "~/lib/demo-bridge";
import { LivePulse } from "~/components/dashboard/LivePulse";
import { demoRadarAlerts, type RadarAlert } from "~/lib/personal-data";
import { cn } from "~/lib/utils";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } },
};

const SEVERITY = {
  red: {
    ring: "border-[#F87171]/25 bg-[#F87171]/[0.07]",
    icon: "border-[#F87171]/25 bg-[#F87171]/10 text-[#F87171]",
    Icon: CircleAlert,
  },
  yellow: {
    ring: "border-[#FFC24D]/25 bg-[#FFC24D]/[0.07]",
    icon: "border-[#FFC24D]/25 bg-[#FFC24D]/10 text-[#FFC24D]",
    Icon: Flame,
  },
  green: {
    ring: "border-[#4ADE80]/25 bg-[#4ADE80]/[0.07]",
    icon: "border-[#4ADE80]/25 bg-[#4ADE80]/10 text-[#4ADE80]",
    Icon: Trophy,
  },
} as const;

function waHref(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/**
 * Cockpit de gestão do Personal (blueprint §3.3, padrão premium do aluno):
 * header com identidade, pulso da academia e radar de retenção.
 */
export default function PersonalDashboardPage() {
  const { profile } = useAuth();
  const alerts = useMemo(() => demoRadarAlerts(), []);
  const online = useMemo(() => demoOnlineAgora(), []);

  const counts = {
    red: alerts.filter((a) => a.severity === "red").length,
    yellow: alerts.filter((a) => a.severity === "yellow").length,
    green: alerts.filter((a) => a.severity === "green").length,
  };

  return (
    <div className="space-y-5">
      {/* Header: identidade do personal */}
      <motion.header variants={item} initial="hidden" animate="show" className="flex items-center gap-3">
        <span className="relative shrink-0 rounded-full bg-brand p-[2px] shadow-[0_0_18px_rgba(244,113,30,0.35)]">
          <Avatar className="h-12 w-12 border-2 border-background">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.name ?? "Personal"} />
            <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-sm font-black text-brand-foreground">
              {(profile?.name?.[0] ?? "P").toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight text-foreground">
            {profile?.name ?? "Personal"}
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand">
            Personal Trainer
          </p>
        </div>
        <button
          aria-label="Notificações"
          className="tactile flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bell className="h-4.5 w-4.5" />
        </button>
      </motion.header>

      {/* Pulso da academia (mesmo componente do aluno) */}
      <motion.div variants={item} initial="hidden" animate="show">
        <LivePulse online={online} />
      </motion.div>

      {/* Radar de Retenção */}
      <motion.section variants={item} initial="hidden" animate="show" aria-labelledby="radar-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="radar-title" className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Activity className="h-4 w-4 text-brand" />
            Radar de Retenção
          </h2>
          <p className="text-[10px] font-medium text-muted-foreground">
            {counts.red} críticos · {counts.yellow} atenção · {counts.green} vitórias
          </p>
        </div>

        <motion.div variants={container} initial="hidden" animate="show" className="space-y-2.5">
          {alerts.map((a) => (
            <RadarCard key={a.id} alert={a} />
          ))}
        </motion.div>
      </motion.section>
    </div>
  );
}

function RadarCard({ alert }: { alert: RadarAlert }) {
  const sev = SEVERITY[alert.severity];
  const { Icon } = sev;
  const wa = alert.whatsapp;

  return (
    <motion.article
      variants={item}
      className={cn("gf-card gf-glass !p-4", sev.ring)}
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", sev.icon)}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-snug text-foreground">{alert.message}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{alert.detail}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {wa && wa.consent ? (
          <a
            href={waHref(wa.phone, wa.text)}
            target="_blank"
            rel="noreferrer"
            className="tactile inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#25D366]/15 px-3 text-[11px] font-bold text-[#4ADE80] ring-1 ring-[#25D366]/30 transition-transform active:scale-[0.96]"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {wa.label ?? "WhatsApp"}
          </a>
        ) : wa && !wa.consent ? (
          <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.04] px-3 text-[11px] font-medium text-muted-foreground ring-1 ring-white/[0.06]">
            <MessageCircle className="h-3.5 w-3.5" />
            Sem consentimento
          </span>
        ) : null}

        {alert.action ? (
          <Link
            href={alert.action.href}
            className="tactile inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand/15 px-3 text-[11px] font-bold text-brand ring-1 ring-brand/30 transition-transform active:scale-[0.96]"
          >
            {alert.action.label}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </motion.article>
  );
}
