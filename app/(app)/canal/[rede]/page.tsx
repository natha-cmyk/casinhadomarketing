import { SocialView } from "@/components/views/SocialView";
import { GoogleBusinessView } from "@/components/views/GoogleBusinessView";

export default async function Page({ params }: PageProps<"/canal/[rede]">) {
  const { rede } = await params;
  // Google Business tem painel próprio (ficha, avaliações, termos de busca).
  if (rede === "googlebusiness") return <GoogleBusinessView rede={rede} />;
  return <SocialView rede={rede} />;
}
