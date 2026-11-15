"use client";

import { useState } from "react";
import Image from "next/image";
import { cx } from "./ui";

export function PhotoGallery({ photos, alt }: { photos: { url: string; alt?: string | null }[]; alt: string }) {
  const [i, setI] = useState(0);
  if (!photos.length) return <div className="aspect-[4/3] rounded-2xl bg-brand-50" />;
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-brand-50 shadow-card lg:aspect-[3/4]">
        <Image src={photos[i].url} alt={photos[i].alt ?? alt} fill sizes="(min-width: 1024px) 380px, 100vw" className="object-cover" priority />
      </div>
      {photos.length > 1 && (
        <div className="mt-2 flex gap-2">
          {photos.map((p, k) => (
            <button
              key={p.url}
              type="button"
              onClick={() => setI(k)}
              className={cx("relative size-16 overflow-hidden rounded-xl ring-2 transition", k === i ? "ring-brand-500" : "ring-transparent opacity-70 hover:opacity-100")}
              aria-label={`Şəkil ${k + 1}`}
            >
              <Image src={p.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
