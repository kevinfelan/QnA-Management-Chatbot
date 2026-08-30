"use client";

import { useEffect } from "react";

// Kunci scroll body saat modal/form terbuka, biar background app
// sama sekali tidak ikut bergerak dan fokus penuh ke form.
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const { style } = document.body;
    const previousOverflow = style.overflow;
    const previousPosition = style.position;
    const previousTop = style.top;
    const previousWidth = style.width;
    const scrollY = window.scrollY;

    style.overflow = "hidden";
    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.width = "100%";

    return () => {
      style.overflow = previousOverflow;
      style.position = previousPosition;
      style.top = previousTop;
      style.width = previousWidth;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
