"use client";

import { useRef, useState } from "react";

const PULL_THRESHOLD = 64;
const PULL_MAX = 100;

// bungkus <main> dashboard biar bisa "tarik ke bawah buat refresh" kayak
// app native -- reload seluruh halaman (bukan cuma refetch data) supaya
// perubahan/update terbaru di app ikut ke-ambil, dipasang di layout jadi
// otomatis berlaku di semua modul (Dashboard, Input QnA, dst). <main> di
// sini scroll dokumen biasa (bukan container overflow sendiri), jadi
// posisi "lagi di paling atas" dicek dari window.scrollY.
export default function PullToRefresh({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent<HTMLElement>) {
    touchStartY.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
  }

  function handleTouchMove(e: React.TouchEvent<HTMLElement>) {
    if (touchStartY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, PULL_MAX));
    }
  }

  function handleTouchEnd() {
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
      className={className}
    >
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
      {children}
    </main>
  );
}
