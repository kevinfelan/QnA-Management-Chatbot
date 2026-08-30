"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconDashboard, IconEdit, IconBuilding, IconMessage, IconShield } from "./icons";

const BASE_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: IconDashboard },
  { href: "/dashboard/qna", label: "Input QnA", Icon: IconEdit },
  { href: "/dashboard/projects", label: "Database Project", Icon: IconBuilding },
  { href: "/dashboard/test-chat", label: "Test Chat", Icon: IconMessage },
];

const ADMIN_ITEM = { href: "/dashboard/admin", label: "Admin", Icon: IconShield };

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

export default function DashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...BASE_ITEMS, ADMIN_ITEM] : BASE_ITEMS;
  // grid-cols harus literal (bukan interpolasi) biar ke-scan Tailwind JIT.
  const gridColsClass = items.length === 5 ? "grid-cols-5" : "grid-cols-4";

  return (
    <nav
      className="shrink-0 border-t border-navy/10 bg-white md:hidden"
      style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
    >
      <div className={`grid ${gridColsClass}`}>
        {items.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 px-1 pb-1 pt-2 text-center text-[10px] font-medium leading-tight transition-colors ${
                active ? "text-teal" : "text-ink/50 hover:text-ink"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
