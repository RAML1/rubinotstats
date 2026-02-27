"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useTransition } from "react";
import type { Locale } from "@/i18n/config";

const FLAGS: { locale: Locale; label: string; alt: string }[] = [
  { locale: "pt-BR", label: "BR", alt: "Português" },
  { locale: "es", label: "ES", alt: "Español" },
  { locale: "en", label: "EN", alt: "English" },
];

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(newLocale: Locale) {
    if (newLocale === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  }

  return (
    <div className="flex items-center gap-0.5">
      {FLAGS.map((flag) => {
        const isActive = locale === flag.locale;
        return (
          <button
            key={flag.locale}
            onClick={() => switchLocale(flag.locale)}
            disabled={isPending}
            title={flag.alt}
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition-all ${
              isActive
                ? "bg-white/25 text-white"
                : "text-white/50 hover:text-white/80 hover:bg-white/10"
            } ${isPending ? "opacity-50" : ""}`}
          >
            {flag.label}
          </button>
        );
      })}
    </div>
  );
}
