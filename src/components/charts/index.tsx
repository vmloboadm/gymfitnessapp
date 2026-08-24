"use client";

import dynamic from "next/dynamic";

export const OcupacaoBarChart = dynamic(
  () => import("./impl").then((m) => m.OcupacaoBarChart),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />,
  }
);

export const ReceitaLineChart = dynamic(
  () => import("./impl").then((m) => m.ReceitaLineChart),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />,
  }
);

export const PesoLineChart = dynamic(
  () => import("./impl").then((m) => m.PesoLineChart),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />,
  }
);

export const FrequenciaLineChart = dynamic(
  () => import("./impl").then((m) => m.FrequenciaLineChart),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />,
  }
);

export const VolumeBarChart = dynamic(
  () => import("./impl").then((m) => m.VolumeBarChart),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />,
  }
);

export const PesoAreaChart = dynamic(
  () => import("./impl").then((m) => m.PesoAreaChart),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />,
  }
);

export const CargaAreaChart = dynamic(
  () => import("./impl").then((m) => m.CargaAreaChart),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />,
  }
);