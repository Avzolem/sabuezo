import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

export function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 65) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-rose-400";
}

export function scoreBg(score: number): string {
  if (score >= 85) return "bg-emerald-500/20 border-emerald-500/40";
  if (score >= 65) return "bg-amber-500/20 border-amber-500/40";
  if (score >= 40) return "bg-orange-500/20 border-orange-500/40";
  return "bg-rose-500/20 border-rose-500/40";
}

export function scoreLabel(score: number): string {
  if (score >= 85) return "Bien protegido";
  if (score >= 65) return "Mejoras importantes";
  if (score >= 40) return "Puertas abiertas";
  return "Crítico";
}

export const severityLabel: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
  info: "Info",
};

export const severityStyle: Record<string, string> = {
  critical: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  low: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  info: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
};

export const riskStyle: Record<string, string> = {
  rojo: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  amarillo: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  verde: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};
