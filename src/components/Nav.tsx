"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/contacts", label: "Contacts" },
  { href: "/kanban", label: "Kanban" },
  { href: "/funnel", label: "Funnel" },
  { href: "/duplicates", label: "Duplicates" },
  { href: "/tasks", label: "Tasks" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link key={l.href} href={l.href} className={active ? "active" : ""}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
