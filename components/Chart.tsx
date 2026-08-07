"use client";
// Renderiza uma string SVG de gráfico (de lib/charts.ts). O tooltip é global
// (ver ChartTooltips), então aqui basta injetar o markup.
export function Chart({ svg, style }: { svg: string; style?: React.CSSProperties }) {
  return <div style={style} dangerouslySetInnerHTML={{ __html: svg }} />;
}
