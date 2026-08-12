"use client";
import { SocialInsights } from "@/components/SocialInsights";

// Painel de rede social (canal/[rede]) — analytics real por workspace via Zernio.
export function SocialView({ rede }: { rede: string }) {
  return <SocialInsights rede={rede} />;
}
