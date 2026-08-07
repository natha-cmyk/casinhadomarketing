import { SocialView } from "@/components/views/SocialView";

export default async function Page({ params }: PageProps<"/canal/[rede]">) {
  const { rede } = await params;
  return <SocialView rede={rede} />;
}
