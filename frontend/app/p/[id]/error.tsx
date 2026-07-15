"use client"; // Los error boundaries deben ser Client Components

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard PyME] error al cargar:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-5">
        <div className="mx-auto rounded-2xl bg-amber-500/15 p-4 w-fit">
          <AlertTriangle className="size-8 text-amber-300" />
        </div>
        <h2 className="text-2xl font-semibold text-white">
          No pudimos cargar este dashboard
        </h2>
        <p className="text-zinc-400 leading-relaxed">
          Hubo un problema temporal al conectar con nuestros servidores. La PyME
          no ha desaparecido — es solo una falla pasajera. Intenta de nuevo en un
          momento.
        </p>
        <button
          onClick={() => unstable_retry()}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 font-medium text-zinc-950 hover:bg-amber-400 transition"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
