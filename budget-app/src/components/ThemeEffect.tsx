"use client";

import { useEffect } from "react";
import { useStore } from "@/hooks/useStore";

/** Tema parametrini <html> üzərinə tətbiq edir; "system" üçün OS dəyişikliyini izləyir. */
export function ThemeEffect() {
  const { settings, ready } = useStore();
  const theme = settings.theme;

  useEffect(() => {
    if (!ready) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, ready]);

  return null;
}
