import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/config";
import { Sidebar } from "@/components/layout/sidebar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-base)" }}>
      <Sidebar
        farmName={session.user.farmName}
        userRoles={session.user.roles}
      />
      <main
        className="sidebar-main"
        style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
      >
        {/* Cada página incluye su propio Topbar + contenido */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
