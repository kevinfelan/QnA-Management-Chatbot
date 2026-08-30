"use client";

import { useEffect } from "react";

// Kunci scroll body saat modal/form terbuka, biar background app
// sama sekali tidak ikut bergerak dan fokus penuh ke form.
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    // Body-nya dikunci fixed (trik andalan buat iOS Safari), tapi <html>
    // sendiri juga perlu dikunci -- kalau nggak, itu yang jadi viewport
    // scroll di Safari begitu body dikeluarkan dari flow, jadi masih
    // nyisain celah kecil yang bisa digeser di bagian bawah.
    const htmlStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const previousHtmlOverflow = htmlStyle.overflow;
    const previousBodyOverflow = bodyStyle.overflow;
    const previousBodyPosition = bodyStyle.position;
    const previousBodyTop = bodyStyle.top;
    const previousBodyWidth = bodyStyle.width;
    const scrollY = window.scrollY;

    htmlStyle.overflow = "hidden";
    bodyStyle.overflow = "hidden";
    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.width = "100%";

    return () => {
      htmlStyle.overflow = previousHtmlOverflow;
      bodyStyle.overflow = previousBodyOverflow;
      bodyStyle.position = previousBodyPosition;
      bodyStyle.top = previousBodyTop;
      bodyStyle.width = previousBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
