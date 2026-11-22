"use client";

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Magnetic } from "./Magnetic";
import { useApp } from "./Providers";
import { cn, isInternal } from "@/lib/utils";

type Variant = "light" | "dark" | "outline";

const base =
  "group relative isolate inline-flex h-14 items-center gap-4 overflow-hidden rounded-full pl-7 pr-2 text-[15px] font-medium tracking-tight transition-colors duration-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral disabled:opacity-60";

const variants: Record<Variant, { btn: string; fill: string; icon: string }> = {
  light: { btn: "bg-paper text-ink hover:text-ink", fill: "bg-coral", icon: "bg-ink text-paper" },
  dark: { btn: "bg-ink text-paper hover:text-ink", fill: "bg-mint", icon: "bg-paper text-ink" },
  outline: {
    btn: "border border-current/30 text-current hover:text-ink",
    fill: "bg-mint",
    icon: "bg-current/10",
  },
};

export function Pill({
  children,
  href,
  onClick,
  variant = "light",
  type = "button",
  disabled,
  className,
  icon,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: Variant;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
}) {
  const { navigate } = useApp();
  const v = variants[variant];

  const inner = (
    <>
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10 translate-y-[101%] scale-x-125 rounded-[50%] transition-[transform,border-radius] duration-700 ease-out-expo group-hover:translate-y-0 group-hover:rounded-none",
          v.fill,
        )}
      />
      <span className="relative block h-[1.2em] overflow-hidden leading-[1.2em]">
        <span className="block transition-transform duration-500 ease-out-expo group-hover:-translate-y-full">
          {children}
        </span>
        <span
          aria-hidden
          className="absolute left-0 top-full block transition-transform duration-500 ease-out-expo group-hover:-translate-y-full"
        >
          {children}
        </span>
      </span>
      <span className={cn("grid size-10 place-items-center rounded-full", v.icon)}>
        {icon ?? (
          <ArrowUpRight className="size-4 transition-transform duration-500 ease-out-expo group-hover:rotate-45" />
        )}
      </span>
    </>
  );

  const cls = cn(base, v.btn, className);

  return (
    <Magnetic strength={0.25}>
      {href ? (
        <a
          href={href}
          className={cls}
          data-cursor="hover"
          target={isInternal(href) ? undefined : "_blank"}
          rel={isInternal(href) ? undefined : "noreferrer"}
          onClick={(e) => {
            if (isInternal(href)) {
              e.preventDefault();
              navigate(href);
            }
            onClick?.();
          }}
        >
          {inner}
        </a>
      ) : (
        <button type={type} className={cls} onClick={onClick} disabled={disabled} data-cursor="hover">
          {inner}
        </button>
      )}
    </Magnetic>
  );
}
