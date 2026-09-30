import { AR, CL, CO, CR, DO, EC, MX, PA, PE, UY } from "country-flag-icons/react/3x2";

// Banderas en SVG: los emojis de bandera no se dibujan en Windows (muestran "MX").
const FLAGS = { AR, CL, CO, CR, DO, EC, MX, PA, PE, UY };

export type FlagCode = keyof typeof FLAGS;

export default function Flag({ code, className = "" }: { code: FlagCode; className?: string }) {
  const Svg = FLAGS[code];
  return <Svg aria-hidden className={`inline-block h-[1em] w-auto rounded-[2px] ${className}`} />;
}
