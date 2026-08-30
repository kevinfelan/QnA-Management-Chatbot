"use client";

import { useRef, useState } from "react";

const PULL_THRESHOLD = 64;
const PULL_MAX = 100;

// bungkus <main> dashboard biar bisa "tarik ke bawah buat refresh" kayak
// app native -- reload seluruh halaman (bukan cuma refetch data) supaya
// perubahan/update terbaru di app ikut ke-ambil, dipasang di layout jadi
// otomatis berlaku di semua modul (Dashboard, Input QnA, dst). <main> di
// sini adalah container scroll-nya sendiri (flex-1 overflow-y-auto di
// dalam shell h-dvh yang gak pernah scroll di level dokumen), jadi posisi
// "lagi di paling atas" dicek dari scrollTop container ini sendiri.
export default function PullToRefresh({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const touchStartY = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent<HTMLElement>) {
    touchStartY.current =
      containerRef.current && containerRef.current.scrollTop <= 0
        ? e.touches[0].clientY
        : null;
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
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`min-h-0 flex-1 overflow-y-auto ${className ?? ""}`}
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
