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

// Tab bar bergaya pill mengambang ala iOS 26 / Instagram: item nonaktif cuma
// ikon, item aktif jadi bubble berlabel. Sengaja bagian dari alur normal
// (bukan position:fixed) supaya nggak pernah tumpang tindih sama konten dan
// gak ikut kacau kalau keyboard HP muncul -- shell dashboard udah dikunci
// h-dvh + overflow-hidden, jadi halaman gak pernah scroll sendiri.
export default function DashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...BASE_ITEMS, ADMIN_ITEM] : BASE_ITEMS;

  return (
    <nav
      className="flex shrink-0 justify-center px-4 pt-2 md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-0.5 rounded-full border border-navy/10 bg-white p-1 shadow-lg shadow-navy/10">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} aria-label={label}>
              <div
                className={`flex items-center gap-1.5 rounded-full py-2 transition-all duration-300 ease-out ${
                  active ? "bg-teal px-3 text-white shadow-md shadow-teal/30" : "px-2.5 text-ink/50"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "scale-105" : ""}`} />
                <span
                  className={`truncate whitespace-nowrap text-xs font-semibold transition-all duration-300 ease-out ${
                    active ? "max-w-[110px] opacity-100" : "max-w-0 opacity-0"
                  }`}
                >
                  {label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
