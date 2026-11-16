"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartIcon, HomeIcon, ListIcon, PlusIcon, SettingsIcon, WalletIcon } from "./Icons";

const ITEMS = [
  { href: "/", label: "Əsas", full: "Əsas səhifə", Icon: HomeIcon },
  { href: "/transactions", label: "Əməliyyatlar", full: "Əməliyyatlar", Icon: ListIcon },
  { href: "/add", label: "Əlavə et", full: "Əlavə et", Icon: PlusIcon },
  { href: "/accounts", label: "Hesablar", full: "Hesablar", Icon: WalletIcon },
  { href: "/analytics", label: "Analitika", full: "Analitika", Icon: ChartIcon },
  { href: "/settings", label: "Parametrlər", full: "Parametrlər", Icon: SettingsIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Əsas naviqasiya"
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-6" style={{ height: "var(--nav-h)" }}>
        {ITEMS.map(({ href, label, full, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const isAdd = href === "/add";
          return (
            <li key={href} className="relative">
              <Link
                href={href}
                aria-label={full}
                aria-current={active ? "page" : undefined}
                className="flex h-full min-h-[44px] flex-col items-center justify-end gap-0.5 pb-1.5"
              >
                {isAdd ? (
                  <span
                    className={`absolute -top-5 flex h-[52px] w-[52px] items-center justify-center rounded-full text-white shadow-lg shadow-brand-500/40 ring-4 ring-[#f4f6fa] dark:ring-[#0b1020] ${
                      active ? "bg-brand-600" : "bg-brand-500"
                    }`}
                  >
                    <PlusIcon width={26} height={26} />
                  </span>
                ) : (
                  <Icon
                    width={23}
                    height={23}
                    className={active ? "text-brand-500" : "text-slate-500 dark:text-slate-400"}
                  />
                )}
                <span
                  className={`text-[10px] font-semibold leading-tight tracking-tight ${
                    active ? "text-brand-600 dark:text-brand-100" : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
