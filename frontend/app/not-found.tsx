import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-[var(--color-background)] grain grid place-items-center px-4">
      <div className="max-w-md text-center">
        <Image
          src="/sabuezo-hero.webp"
          alt=""
          width={160}
          height={129}
          className="mx-auto w-40 h-auto opacity-90"
        />
        <p className="mt-8 text-sm font-medium tracking-wider text-amber-400">ERROR 404</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          El Sabuezo no encontró esta página
        </h1>
        <p className="mt-4 text-zinc-400 leading-relaxed">
          Olfateamos por todos lados, pero esta dirección no existe o se movió.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900 transition px-5 py-2.5 text-sm text-zinc-200"
          >
            <ArrowLeft className="size-4" />
            Volver al inicio
          </Link>
          <Link
            href="/filtraciones?tipo=correo"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 transition text-black px-5 py-2.5 text-sm font-medium"
          >
            <Mail className="size-4" />
            Revisa tu correo
          </Link>
        </div>
      </div>
    </main>
  );
}
