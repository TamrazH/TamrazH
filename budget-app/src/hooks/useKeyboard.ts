"use client";

import { useEffect } from "react";

const FIELD = "input, select, textarea";

/**
 * iOS klaviatura davranışı:
 *  - visualViewport kiçildikdə <body>-yə "kb-open" sinfi qoyur (naviqasiya gizlənir, aşağıya boşluq verilir)
 *  - fokuslanan sahəni görünən sahənin ortasına gətirir.
 */
export function useKeyboardAvoidance() {
  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      if (!vv) return;
      const open = window.innerHeight - vv.height > 140;
      document.body.classList.toggle("kb-open", open);
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.matches?.(FIELD)) return;
      if ((el as HTMLInputElement).type === "checkbox" || (el as HTMLInputElement).type === "radio") return;
      window.setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 320);
    };
    vv?.addEventListener("resize", update);
    document.addEventListener("focusin", onFocusIn);
    update();
    return () => {
      vv?.removeEventListener("resize", update);
      document.removeEventListener("focusin", onFocusIn);
      document.body.classList.remove("kb-open");
    };
  }, []);
}
