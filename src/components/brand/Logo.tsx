import { cn } from "@/lib/utils";

interface LogoIconProps {
  size?: number;
  className?: string;
}

export function LogoIcon({ size = 32, className }: LogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Eye outline - almond shape */}
      <path
        d="M50 18C28 18 10 50 10 50s18 32 40 32 40-32 40-32S72 18 50 18Z"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Iris ring - 4 vocation color segments (donut chart) */}
      {/* Purple segment (top-left) - Sorcerer */}
      <path
        d="M50 28a22 22 0 0 0-22 22h22V28Z"
        fill="#8b5cf6"
      />
      {/* Green segment (top-right) - Druid */}
      <path
        d="M50 28a22 22 0 0 1 22 22H50V28Z"
        fill="#10b981"
      />
      {/* Red segment (bottom-left) - Knight */}
      <path
        d="M28 50a22 22 0 0 0 22 22V50H28Z"
        fill="#ef4444"
      />
      {/* Amber segment (bottom-right) - Paladin */}
      <path
        d="M72 50a22 22 0 0 1-22 22V50h22Z"
        fill="#f59e0b"
      />
      {/* Inner circle cutout (creates donut effect) */}
      <circle cx="50" cy="50" r="12" fill="hsl(230 25% 9%)" />
      {/* Pupil highlight */}
      <circle cx="50" cy="50" r="4" fill="white" />
    </svg>
  );
}

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { icon: 24, text: "text-base" },
  md: { icon: 32, text: "text-xl" },
  lg: { icon: 48, text: "text-3xl" },
  xl: { icon: 64, text: "text-4xl" },
};

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const s = sizeMap[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoIcon size={s.icon} />
      {showText && (
        <span className={cn(s.text, "font-bold tracking-tight")}>
          <span className="text-foreground">RubinOT</span>
          <span className="text-muted-foreground font-normal ml-1">Stats</span>
        </span>
      )}
    </div>
  );
}
