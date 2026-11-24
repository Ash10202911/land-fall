import { BadgeCheck, Bell, Check, Lock, Trophy } from "lucide-react";
import { HeroVideo } from "./video-demos";

const card =
  "hero-card absolute rounded-2xl bg-white p-3 text-[#0b2f57] shadow-[0_18px_36px_-18px_rgba(120,70,10,0.5)] ring-1 ring-[#f0e4d2]";

/**
 * The hero's right side: the live portal in a phone, with the moments that make it useful arriving around it one
 * after another. No people and no place names: activity, not faces. Each card eases in once, in order.
 */
export function HeroCollage() {
  return (
    <div className="relative mx-auto h-[30rem] w-full max-w-[27rem] self-end sm:h-[33rem]">
      <div className="absolute left-1/2 top-4 -translate-x-1/2">
        <HeroVideo />
      </div>

      <div className={`${card} -left-1 top-10 w-[11.5rem] sm:-left-12 sm:w-56`} style={{ animationDelay: "0.5s" }}>
        <div className="flex items-start gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ffe7c2] text-[#b4570a]" aria-hidden>
            <Bell className="h-4 w-4" />
          </span>
          <div className="text-[13px] leading-snug">
            <p className="font-bold">New job on your lane</p>
            <p className="text-[#6b7f94]">just now</p>
          </div>
        </div>
      </div>

      <div className={`${card} -right-1 top-44 w-[12rem] sm:-right-10 sm:w-60`} style={{ animationDelay: "1.4s" }}>
        <div className="flex items-center gap-2 text-[13px] font-bold">
          <Lock className="h-4 w-4 text-[#0c5a9c]" aria-hidden /> Sealed quote received
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {["Dest.", "Customs", "Delivery"].map((l) => (
            <span key={l} className="inline-flex items-center gap-1 rounded-full bg-[#e3f3fe] px-2 py-0.5 text-[10px] font-bold text-[#0c5a9c]">
              <Check className="h-2.5 w-2.5" aria-hidden />
              {l}
            </span>
          ))}
        </div>
      </div>

      <div className={`${card} bottom-28 -left-1 sm:-left-8`} style={{ animationDelay: "2.3s" }}>
        <p className="flex items-center gap-2 text-[13px] font-bold text-[#117a3d]">
          <BadgeCheck className="h-4 w-4" aria-hidden /> Lowest complete quote
        </p>
      </div>

      <div className={`${card} bottom-10 right-1 w-[12.5rem] sm:-right-6`} style={{ animationDelay: "3.2s" }}>
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#dff5e6] text-[#117a3d]" aria-hidden>
            <Trophy className="h-4 w-4" />
          </span>
          <div className="text-[13px] leading-snug">
            <p className="font-bold">Awarded</p>
            <p className="text-[#6b7f94]">Contact details unlocked</p>
          </div>
        </div>
      </div>
    </div>
  );
}
