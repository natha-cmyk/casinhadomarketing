import { SectionStub } from "@/components/SectionStub";

export default async function Page({ params }: PageProps<"/canal/[rede]">) {
  const { rede } = await params;
  return <SectionStub view={rede} />;
}
