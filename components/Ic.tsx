import { ICONS } from "@/lib/nav";

// Ícone SVG portado do blueprint (função ic()). Renderiza o path inline de ICONS.
export function Ic({ name, className }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      dangerouslySetInnerHTML={{ __html: ICONS[name] || "" }}
    />
  );
}
