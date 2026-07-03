import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title:       string;
  description?: string;
  icon?:       React.ElementType;
  iconColor?:  string;
  iconBg?:     string;
  actions?:    React.ReactNode;
  className?:  string;
  badge?:      { label: string; color: "red" | "green" | "amber" | "blue" };
}

export function PageHeader({
  title, description, icon: Icon, iconColor, iconBg, actions, className, badge,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 animate-fade-up", className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: iconBg ?? "rgba(163,22,33,0.1)" }}
          >
            <Icon className="h-5 w-5" style={{ color: iconColor ?? "#A31621" }} />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
            {badge && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  background: badge.color === "red"   ? "rgba(163,22,33,0.1)" :
                              badge.color === "green" ? "rgba(22,163,74,0.1)" :
                              badge.color === "amber" ? "rgba(217,119,6,0.1)" :
                                                        "rgba(37,99,235,0.1)",
                  color:      badge.color === "red"   ? "#A31621" :
                              badge.color === "green" ? "#16a34a" :
                              badge.color === "amber" ? "#d97706" :
                                                        "#2563eb",
                }}
              >
                {badge.label}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
