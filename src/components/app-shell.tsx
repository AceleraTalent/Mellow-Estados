import Link from "next/link";
import Image from "next/image";
import { Activity, Kanban, LayoutDashboard, ListChecks, Settings, Users } from "lucide-react";
import { UserRole } from "@prisma/client";
import { requireUser } from "@/server/auth";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/clients/board", label: "Board", icon: Kanban },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/activity", label: "Activity", icon: Activity },
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <Image src="/mellow-logo.png" alt="Mellow & Banana" width={260} height={40} priority />
          </div>
          <h1>Tráfico de proyectos</h1>
          <p>Vista compartida de Mellow & Banana</p>
        </div>
        <nav className="nav">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link href={link.href} key={link.href}>
                <Icon size={18} /> {link.label}
              </Link>
            );
          })}
          {user.role === UserRole.ADMIN ? (
            <Link href="/admin">
              <Settings size={18} /> Administration
            </Link>
          ) : null}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
