"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Paperclip, X } from "lucide-react";

/** What chasing quotes looks like today: one inbox, every sender in their own format. */
const INBOX = [
  { from: "Forwarder A", subject: "RE: RE: quote for the container", note: "see attached .xlsx", time: "9:41", clip: true, unread: true, tone: "bg-[#ffd9a0] text-[#7a3d05]" },
  { from: "Forwarder B", subject: "USD 1,420 + local charges TBC", note: "will confirm customs later", time: "9:12", clip: false, unread: true, tone: "bg-[#c9e4fb] text-[#124a7c]" },
  { from: "Forwarder C", subject: "Updated quote v3 FINAL", note: "valid this week, I think", time: "8:55", clip: true, unread: false, tone: "bg-[#d9f0cf] text-[#2c6b19]" },
  { from: "You", subject: "Does this include delivery?", note: "sent twice, no reply", time: "Yesterday", clip: false, unread: false, tone: "bg-[#f3d7e8] text-[#8a2a63]" },
  { from: "Forwarder D", subject: "Rates attached (PDF)", note: "prices in NZD, sorry", time: "Yesterday", clip: true, unread: false, tone: "bg-[#e3dcf7] text-[#4a3a8c]" },
  { from: "Forwarder B", subject: "RE: quote for the container", note: "can you do 2 x 40HC instead?", time: "Mon", clip: false, unread: false, tone: "bg-[#c9e4fb] text-[#124a7c]" },
];

export function BeforeAfter() {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      const raf = requestAnimationFrame(() => setSeen(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /** Rows ease in one after another the first time the section is seen. */
  const reveal = (i: number, extra = "") => ({
    className: `transition-all duration-500 ${seen ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"} ${extra}`,
    style: { transitionDelay: `${150 + i * 110}ms` },
  });

  return (
    <div ref={ref} className="grid items-stretch gap-6 lg:grid-cols-2 lg:gap-8">
      {/* The usual way */}
      <div className="flex flex-col rounded-[2rem] bg-white p-3 shadow-[0_20px_44px_-28px_rgba(90,60,20,0.45)] ring-1 ring-[#eadfce] sm:p-4">
        <div className="flex items-center justify-between px-3 pb-3 pt-2">
          <p className="text-base font-extrabold text-[#6b5a45]">The usual way</p>
          <span className="rounded-full bg-[#fde3e0] px-3 py-1 text-xs font-bold text-[#b42318]">Inbox · 47 unread</span>
        </div>
        <ul className="divide-y divide-[#f1e8da] overflow-hidden rounded-2xl bg-[#fffaf2] ring-1 ring-[#f1e8da]">
          {INBOX.map((m, i) => (
            <li key={m.subject + m.from + i} {...reveal(i, "flex items-start gap-3 px-3.5 py-3")}>
              <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold ${m.tone}`} aria-hidden>
                {m.from === "You" ? "Y" : m.from.slice(-1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-[14px] ${m.unread ? "font-extrabold text-[#2b2118]" : "font-semibold text-[#6b5a45]"}`}>{m.from}</p>
                  <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-[#8c7c66]">
                    {m.clip ? <Paperclip className="h-3.5 w-3.5" aria-hidden /> : null}
                    {m.time}
                  </span>
                </div>
                <p className={`truncate text-[14px] ${m.unread ? "font-bold text-[#2b2118]" : "text-[#4f4130]"}`}>{m.subject}</p>
                <p className="truncate text-[13px] text-[#8c7c66]">{m.note}</p>
              </div>
              {m.unread ? <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#1a73c8]" aria-hidden /> : null}
            </li>
          ))}
        </ul>
        <p className="mt-4 px-3 pb-2 text-[15px] leading-snug text-[#6b5a45]">
          Which one covers delivery? Which is in what currency? Hard to say when every reply looks different.
        </p>
      </div>

      {/* On CargoTribe */}
      <div className="flex flex-col rounded-[2rem] bg-white p-3 shadow-[0_20px_44px_-28px_rgba(11,58,110,0.5)] ring-1 ring-[#bfdcf3] sm:p-4">
        <div className="flex items-center justify-between px-3 pb-3 pt-2">
          <p className="text-base font-extrabold text-[#0c5a9c]">On CargoTribe</p>
          <span className="rounded-full bg-[#e3f3fe] px-3 py-1 text-xs font-bold text-[#0c5a9c]">Quotes · 2 sealed</span>
        </div>
        <div className="grid flex-1 content-start gap-3">
          <div {...reveal(2, "rounded-2xl border-2 border-[#3cb9fc] bg-[#f6fbff] p-4 text-[#0b2f57]")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold">Harbour Freight</p>
                <p className="text-xs text-[#4a6785]">Verified</p>
              </div>
              <span className="rounded-full bg-[#dff5e6] px-2.5 py-1 text-[11px] font-bold text-[#117a3d]">Lowest complete quote</span>
            </div>
            <p className="mt-2 text-3xl font-extrabold tracking-tight">$1,635.00</p>
            <p className="text-xs text-[#4a6785]">Valid until 15/12/2026</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Destination port", "Customs", "Delivery"].map((l) => (
                <span key={l} className="inline-flex items-center gap-1 rounded-full bg-[#e3f3fe] px-2.5 py-1 text-[12px] font-bold text-[#0c5a9c]">
                  <Check className="h-3 w-3" aria-hidden />
                  {l}
                </span>
              ))}
            </div>
            <div className="mt-4 grid h-11 place-items-center rounded-xl bg-[#0c5a9c] text-sm font-bold text-white">Award to Harbour Freight</div>
          </div>
          <div {...reveal(3, "rounded-2xl border border-[#d6e8f6] bg-white p-4 text-[#0b2f57]")}>
            <div>
              <p className="font-bold">Kiwi Sea and Air</p>
              <p className="text-xs text-[#4a6785]">Unverified</p>
            </div>
            <p className="mt-2 text-3xl font-extrabold tracking-tight">$1,700.00</p>
            <p className="text-xs text-[#4a6785]">Valid until 08/12/2026</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Destination port", "Customs"].map((l) => (
                <span key={l} className="inline-flex items-center gap-1 rounded-full bg-[#e3f3fe] px-2.5 py-1 text-[12px] font-bold text-[#0c5a9c]">
                  <Check className="h-3 w-3" aria-hidden />
                  {l}
                </span>
              ))}
              <span className="inline-flex items-center gap-1 rounded-full bg-[#fde8e8] px-2.5 py-1 text-[12px] font-bold text-[#b42318]">
                <X className="h-3 w-3" aria-hidden />
                Delivery
              </span>
            </div>
            <p className="mt-2 text-[13px] font-semibold text-[#a15c07]">Does not include: Delivery</p>
            <p className="mt-3 text-sm font-semibold text-[#0c5a9c]">Show line items</p>
          </div>
        </div>
        <p className="mt-4 px-3 pb-2 text-[15px] leading-snug text-[#4a6785]">
          Same shape, side by side. The gaps show up straight away, and each price stays sealed from the others.
        </p>
      </div>
    </div>
  );
}
