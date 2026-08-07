import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/shell/Shell";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Casinha do Marketing · Seahub",
  description: "O sistema operacional de marketing da Seahub Coworking.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${montserrat.variable} antialiased`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
