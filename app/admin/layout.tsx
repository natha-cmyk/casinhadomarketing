// Shell do Admin — espelha o app (sidebar + conteúdo rolável), mas com nav próprio.
// Gate por e-mail admin no servidor; qualquer /admin/* passa por aqui.
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Casinha do Marketing" };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  return (
    <div className="app">
      <AdminSidebar email={admin.email} />
      <main className="main">
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
