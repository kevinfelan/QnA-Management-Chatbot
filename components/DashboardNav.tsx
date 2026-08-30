"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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

// Tab bar mengambang ala iOS 26 / Instagram: pill transparan blur, item aktif
// jadi bubble berlabel, dan menyusut (label disembunyikan) saat scroll turun
// -- item nonaktif tetap ikon doang, jadi lebar total gak pernah tergantung
// panjang semua label sekaligus (beda dari grid-cols full-width sebelumnya).
export default function DashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...BASE_ITEMS, ADMIN_ITEM] : BASE_ITEMS;
  const [compact, setCompact] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      if (y < 24) setCompact(false);
      else if (y > lastY + 6) setCompact(true);
      else if (y < lastY - 6) setCompact(false);
      lastY = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Nav "fixed bottom-0" ini ngikutin layout viewport, bukan visual
  // viewport -- pas keyboard HP kebuka, dia bisa ke-render ngambang aneh
  // di tengah layar (di atas keyboard). Deteksi keyboard lewat susutnya
  // visualViewport, terus sembunyiin aja navnya biar gak berantakan.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function onResize() {
      setKeyboardOpen(vv!.height < window.innerHeight * 0.75);
    }
    onResize();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  if (keyboardOpen) return null;

  return (
    <nav
      data-bottom-nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-white/60 bg-white/70 p-1 shadow-lg shadow-navy/10 backdrop-blur-xl">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} aria-label={label}>
              <div
                className={`flex items-center gap-1.5 rounded-full py-2 transition-all duration-300 ease-out ${
                  active ? "bg-teal px-3 text-white shadow-md shadow-teal/30" : "px-2.5 text-ink/50"
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition-transform duration-300 ${
                    active ? "scale-105" : ""
                  }`}
                />
                <span
                  className={`truncate whitespace-nowrap text-xs font-semibold transition-all duration-300 ease-out ${
                    active && !compact ? "max-w-[110px] opacity-100" : "max-w-0 opacity-0"
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
