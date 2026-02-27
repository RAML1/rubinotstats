"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

interface BoostedEntry {
  name: string;
  looktype: number | null;
}

interface BoostedData {
  creature: BoostedEntry | null;
  boss: BoostedEntry | null;
}

function outfitUrl(looktype: number): string {
  const params = new URLSearchParams({ id: String(looktype), direction: "3" });
  return `https://outfit-images.ots.me/latest/animoutfit.php?${params.toString()}`;
}

export function BoostedBanner() {
  const [data, setData] = useState<BoostedData | null>(null);

  useEffect(() => {
    fetch("/api/boosted")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setData(res.data);
        }
      })
      .catch(() => {});
  }, []);

  if (!data || (!data.creature && !data.boss)) return null;

  return (
    <div className="hidden lg:flex items-center gap-3">
      {data.creature && (
        <div className="flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 backdrop-blur-sm">
          <Sparkles className="h-3 w-3 text-amber-300" />
          {data.creature.looktype && (
            <img
              src={outfitUrl(data.creature.looktype)}
              alt={data.creature.name}
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
          )}
          <span className="text-[11px] text-white/90 font-medium max-w-[100px] truncate">
            {data.creature.name}
          </span>
        </div>
      )}
      {data.boss && (
        <div className="flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 backdrop-blur-sm">
          <Sparkles className="h-3 w-3 text-red-300" />
          {data.boss.looktype && (
            <img
              src={outfitUrl(data.boss.looktype)}
              alt={data.boss.name}
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
            />
          )}
          <span className="text-[11px] text-white/90 font-medium max-w-[100px] truncate">
            {data.boss.name}
          </span>
        </div>
      )}
    </div>
  );
}
