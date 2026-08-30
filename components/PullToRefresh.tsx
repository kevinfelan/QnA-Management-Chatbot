"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

const PULL_THRESHOLD = 64;
const PULL_MAX = 100;

// halaman yang pull-to-refresh-nya dimatiin total -- Test Chat punya
// riwayat percakapan yang cuma hidup di memori (React state), jadi reload
// tak sengaja gara-gara gesture ini bakal ngilangin semua chat customer
// lagi ngetes. Tujuan fitur ini (manual refresh pas PWA belum ke-update
// otomatis) tetep kepenuhi lewat modul lain.
const DISABLED_PREFIXES = ["/dashboard/test-chat"];

// bungkus <main> dashboard biar bisa "tarik ke bawah buat refresh" kayak
// app native -- reload seluruh halaman (bukan cuma refetch data) supaya
// perubahan/update terbaru di app ikut ke-ambil, dipasang di layout jadi
// otomatis berlaku di semua modul (Dashboard, Input QnA, dst). <main> di
// sini adalah container scroll-nya sendiri (flex-1 overflow-y-auto di
// dalam shell h-dvh yang gak pernah scroll di level dokumen).
export default function PullToRefresh({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const disabled = DISABLED_PREFIXES.some((p) => pathname?.startsWith(p));

  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent<HTMLElement>) {
    if (disabled) return;
    const container = e.currentTarget;
    touchStartY.current = container.scrollTop <= 0 ? e.touches[0].clientY : null;
  }

  function handleTouchMove(e: React.TouchEvent<HTMLElement>) {
    if (disabled || touchStartY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, PULL_MAX));
    }
  }

  function handleTouchEnd() {
    if (disabled) return;
    const shouldRefresh = touchStartY.current !== null && pullDistance >= PULL_THRESHOLD && !refreshing;
    touchStartY.current = null;
    if (shouldRefresh) {
      setRefreshing(true);
      setPullDistance(48);
      window.location.reload();
      return;
    }
    setPullDistance(0);
  }

  return (
    <main
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`min-h-0 flex-1 overflow-y-auto ${className ?? ""}`}
    >
      {!disabled && (
        <div
          className="flex items-center justify-center overflow-hidden text-xs text-ink/40 transition-[height]"
          style={{ height: pullDistance }}
        >
          {pullDistance > 0 &&
            (refreshing
              ? "Memuat ulang..."
              : pullDistance >= PULL_THRESHOLD
                ? "Lepas untuk refresh ↑"
                : "Tarik untuk refresh ↓")}
        </div>
      )}
      {children}
    </main>
  );
}
