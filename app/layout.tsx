import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Casinha do Marketing · Seahub",
  description: "O sistema operacional de marketing da Seahub Coworking.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="antialiased">
      <body>{children}</body>
    </html>
  );
}
