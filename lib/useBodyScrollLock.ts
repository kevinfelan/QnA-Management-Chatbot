"use client";

import { useEffect } from "react";

// Kunci scroll body saat modal/form terbuka, biar background app
// sama sekali tidak ikut bergerak dan fokus penuh ke form.
//
// Sengaja TIDAK pakai trik "position: fixed" di body (walau itu andalan
// lama buat iOS Safari) -- di app ini malah memicu address bar Safari
// collapse otomatis begitu dipasang, bikin viewport mendadak berubah
// tinggi sehingga modal yang di-center jadi kedorong ke atas (nyentuh
// status bar) dan nyisain celah render warna latar di bawah. Cukup
// overflow: hidden di <html> DAN <body> -- di iOS modern ini sudah
// cukup buat mematikan scroll/touch-drag tanpa efek samping reflow.
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const htmlStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const previousHtmlOverflow = htmlStyle.overflow;
    const previousBodyOverflow = bodyStyle.overflow;

    htmlStyle.overflow = "hidden";
    bodyStyle.overflow = "hidden";

    return () => {
      htmlStyle.overflow = previousHtmlOverflow;
      bodyStyle.overflow = previousBodyOverflow;
    };
  }, [locked]);
}
