"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  MousePointerClick,
  QrCode,
  TrendingUp,
  UserPlus,
  Eye,
} from "lucide-react";
import { useAuth } from "~/hooks/useAuth";
import { useAsyncQuery } from "~/hooks/useAsyncQuery";
import { useRealtime } from "~/hooks/useRealtime";
import { supabaseBrowser } from "~/lib/supabase/client";
import { SkeletonList, ErrorState, EmptyState } from "~/components/common/AsyncStates";
import { StatCard } from "~/components/common/StatCard";
import { formatNumber } from "~/lib/utils/format";
import { Button } from "~/components/ui/button";

const VisitasCharts = dynamic(() => import("~/components/charts/VisitasCharts"), {
  ssr: false,
  loading: () => <div className="h-44 animate-pulse rounded-xl border border-border bg-card/40" />,
});

/** Linha crua da tabela page_views (034). */
type PageViewRow = {
  id: string;
  path: string;
  kind: "view" | "click" | "signup" | "daypass";
  cta: string | null;
  created_at: string;
  visitor_id: string;
};

/** Nome amigável de cada banner (path da LP → legenda do QR). */
const BANNERS: Array<{ path: string; label: string }> = [
  { path: "/bem-vindo", label: "Banner · Conheça o app" },
  { path: "/parceiros", label: "Banner · Parceiros" },
  { path: "/evolucao", label: "Banner · Evolução" },
  { path: "/vantagens", label: "Banner · Vantagens" },
  { path: "/day-pass", label: "Banner · Day-pass" },
];

const RANGES = [
  { key: "7", label: "7 dias", days: 7 },
  { key: "14", label: "14 dias", days: 14 },
  { key: "30", label: "30 dias", days: 30 },
] as const;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function shortDay(iso: string): string {
  return iso.slice(8, 10) + "/" + iso.slice(5, 7);
}

/**
 * Painel do dono: como os QR dos banners da parede estão indo.
 * Visitas por banner → cliques no CTA → cadastros (funil), com
 * atualização ao vivo via Realtime.
 */
export default function VisitasPage() {
  const { profile } = useAuth();
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[1]);
  const [tick, setTick] = useState(0);

  const { data, loading, error, refetch } = useAsyncQuery<{
    rows: PageViewRow[];
    total: number;
  }>(
    async () => {
      const supabase = supabaseBrowser();
      const since = new Date(Date.now() - range.days * 86400000).toISOString();
      const res = await supabase
        .from("page_views")
        .select("id, path, kind, cta, created_at, visitor_id")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (res.error) return { data: null, error: res.error };
      const totalRes = await supabase
        .from("page_views")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since);
      if (totalRes.error) return { data: null, error: totalRes.error };
      return {
        data: { rows: (res.data ?? []) as PageViewRow[], total: totalRes.count ?? 0 },
        error: null,
      };
    },
    [range.key, profile?.gym_id, tick]
  );

  // ao vivo: insere e refaz (barato — painel fica aberto no tablet da recepção)
  useRealtime(
    `page-views-${profile?.gym_id ?? "none"}`,
    { table: "page_views", gymId: profile?.gym_id, filterCol: "gym_id" },
    () => setTick((t) => t + 1)
  );

  const stats = useMemo(() => {
    const rows = data?.rows ?? [];
    const views = rows.filter((r) => r.kind === "view");
    const clicks = rows.filter((r) => r.kind === "click");
    const signups = rows.filter((r) => r.kind === "signup");
    const daypasses = rows.filter((r) => r.kind === "daypass");
    const uniqueVisitors = new Set(rows.map((r) => r.visitor_id)).size;
    const conv = views.length > 0 ? (signups.length / views.length) * 100 : 0;

    const days = Math.max(1, Math.min(range.days, 14));
    const byDay: Array<{ day: string; views: number; clicks: number; conversions: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      byDay.push({
        day: shortDay(d.toISOString()),
        views: views.filter((r) => dayKey(r.created_at) === key).length,
        clicks: clicks.filter((r) => dayKey(r.created_at) === key).length,
        conversions: signups.filter((r) => dayKey(r.created_at) === key).length,
      });
    }

    // atribuição first-touch: signup/day-pass ligado ao banner cujo
    // MESMO visitor viu a LP antes (visitor_id é igual no dispositivo).
    const viewPathByVisitor = new Map<string, string>();
    for (const r of views) if (!viewPathByVisitor.has(r.visitor_id)) viewPathByVisitor.set(r.visitor_id, r.path);

    const byBanner = BANNERS.map((b) => {
      const v = views.filter((r) => r.path === b.path);
      const clicksByPath = clicks.filter((r) => r.path === b.path);
      const convs = rows.filter(
        (r) =>
          (r.kind === "signup" || r.kind === "daypass") &&
          viewPathByVisitor.get(r.visitor_id) === b.path
      );
      return {
        ...b,
        views: v.length,
        clicks: clicksByPath.length,
        signups: convs.filter((r) => r.kind === "signup").length,
        daypasses: convs.filter((r) => r.kind === "daypass").length,
        unique: new Set(v.map((r) => r.visitor_id)).size,
      };
    });

    return { views, clicks, signups, daypasses, uniqueVisitors, conv, byDay, byBanner };
  }, [data, range.days]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          aria-label="Voltar ao início"
          className="tactile rounded-full border border-border bg-card/60 p-2"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            QR dos banners
          </h1>
          <p className="text-xs text-muted-foreground">
            Visitas e conversões da vitrine · {range.label}
          </p>
        </div>
      </div>

      {/* filtro de período */}
      <div className="flex gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r)}
            className={`tactile rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              range.key === r.key
                ? "bg-brand text-brand-foreground"
                : "border border-border bg-card/60 text-muted-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (data?.total ?? 0) === 0 ? (
        <EmptyState
          title="Ainda sem visitas"
          description="Os QR dos banners começam a registrar assim que alguém abrir as páginas."
          icon={QrCode}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Visitantes"
              value={formatNumber(stats.uniqueVisitors)}
              icon={Eye}
              context={`${formatNumber(stats.views.length)} visitas`}
            />
            <StatCard
              label="Cliques"
              value={formatNumber(stats.clicks.length)}
              icon={MousePointerClick}
              context="CTAs das LPs"
            />
            <StatCard
              label="Cadastros"
              value={formatNumber(stats.signups.length)}
              icon={UserPlus}
              context="Contas criadas"
            />
            <StatCard
              label="Conversão"
              value={`${stats.conv.toFixed(1)}%`}
              icon={TrendingUp}
              context="Cadastros / visitas"
            />
          </div>

          <VisitasCharts byDay={stats.byDay} />

          {/* funil resumido */}
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <p className="mb-3 gf-section">Funil do período</p>
            <div className="space-y-2">
              {[
                { label: "Abriram o banner (visita)", n: stats.views.length, tone: "bg-brand" },
                { label: "Clicaram num CTA", n: stats.clicks.length, tone: "bg-[#4ADE80]" },
                { label: "Criaram conta", n: stats.signups.length, tone: "bg-[#60A5FA]" },
                { label: "Compraram day-pass", n: stats.daypasses.length, tone: "bg-[#FBBF24]" },
              ].map((f) => {
                const pct = stats.views.length > 0 ? (f.n / stats.views.length) * 100 : 0;
                return (
                  <div key={f.label}>
                    <div className="mb-1 flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">{f.label}</span>
                      <span className="font-semibold text-foreground">
                        {formatNumber(f.n)}
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                          {pct.toFixed(0)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                      <div
                        className={`h-full rounded-full ${f.tone}`}
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* banner a banner */}
          <div className="rounded-xl border border-border bg-card/50">
            <p className="gf-section px-4 pt-4">Cada banner</p>
            <div className="mt-2 divide-y divide-border/60">
              {stats.byBanner.map((b) => (
                <div key={b.path} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{b.label}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{b.path}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-sm font-bold text-foreground">{formatNumber(b.views)}</p>
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">visitas</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{formatNumber(b.clicks)}</p>
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">cliques</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {formatNumber(b.signups + b.daypasses)}
                      </p>
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">conversões</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Atualizar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
