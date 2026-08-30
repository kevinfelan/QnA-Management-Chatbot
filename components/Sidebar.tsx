"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconEdit,
  IconBuilding,
  IconMessage,
  IconShield,
} from "./icons";

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

export default function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...BASE_ITEMS, ADMIN_ITEM] : BASE_ITEMS;

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-navy px-4 py-6 md:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <Image
          src="/logo-mark.png"
          alt="QnA Setup"
          width={36}
          height={38}
          className="h-9 w-auto shrink-0 object-contain"
        />
        <span className="font-heading text-lg font-semibold text-white">QnA Setup</span>
      </div>

      <nav className="flex flex-col gap-1">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-background text-navy"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
