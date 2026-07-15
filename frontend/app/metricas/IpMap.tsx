"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { MapPoint } from "./IpMapInner";

export type { MapPoint } from "./IpMapInner";

// Leaflet toca window → cargar solo en cliente (ssr:false permitido en client comp).
const Inner = dynamic(() => import("./IpMapInner"), { ssr: false });

const shell =
  "h-[420px] rounded-2xl border border-zinc-800 bg-zinc-900/40 flex items-center justify-center text-zinc-500 text-sm";

export default function IpMap({ points }: { points: MapPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className={shell}>Cargando mapa…</div>;
  if (!points.length)
    return <div className={shell}>Aún no hay visitas con ubicación.</div>;

  return (
    <div className="h-[420px] rounded-2xl overflow-hidden border border-zinc-800">
      <Inner points={points} />
    </div>
  );
}
