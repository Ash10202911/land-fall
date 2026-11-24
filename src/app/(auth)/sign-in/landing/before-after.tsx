"use client";

import { useState } from "react";
import { Check, Paperclip, X } from "lucide-react";

/** The pile of replies an agent chases today, against the same quotes laid out side by side. An illustration. */
const PILE = [
  { text: "ok 1850 all in?? 📎", from: "WeChat", rot: "-rotate-2", pos: "left-0 top-2", tone: "bg-[#d9f4c8]" },
  { text: "RE: RE: quote for the container (see attached .xlsx)", from: "Email", rot: "rotate-1", pos: "right-0 top-0", tone: "bg-white" },
  { text: "USD 1,420 + local charges TBC", from: "Email", rot: "rotate-2", pos: "left-3 top-24", tone: "bg-white" },
  { text: "can do, will confirm customs later", from: "WhatsApp", rot: "-rotate-1", pos: "right-2 top-28", tone: "bg-[#d9f4c8]" },
  { text: "price valid? checking with the team", from: "Email", rot: "rotate-1", pos: "left-0 top-48", tone: "bg-white" },
  { text: "Which one included delivery??", from: "You", rot: "-rotate-2", pos: "right-0 top-52", tone: "bg-[#ffe9b8]" },
];

export function BeforeAfter() {
  const [after, setAfter] = useState(false);
  return (
    <div>
      <div role="group" aria-label="Compare the two ways" className="inline-flex rounded-full bg-white p-1 ring-1 ring-[#eadfce]">
        {[
          { label: "The usual way", value: false },
          { label: "On CargoTribe", value: true },
        ].map((o) => (
          <button
            key={o.label}
            aria-pressed={after === o.value}
            onClick={() => setAfter(o.value)}
            className={`min-h-11 rounded-full px-5 text-[15px] font-bold transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#3cb9fc] ${
              after === o.value ? "bg-[#0c5a9c] text-white" : "text-[#0b2f57] hover:bg-[#fff1dc]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid">
        {/* both layers share one grid cell so the section never jumps */}
        <div
          className={`col-start-1 row-start-1 transition-all duration-500 ${after ? "pointer-events-none translate-y-3 opacity-0" : "opacity-100"}`}
          aria-hidden={after}
        >
          <div className="relative mx-auto h-[19rem] w-full max-w-xl rounded-3xl bg-[#f3e6d2] p-4 sm:h-[17rem]">
            {PILE.map((m) => (
              <div
                key={m.text}
                className={`absolute max-w-[62%] rounded-2xl px-3.5 py-2.5 text-[13px] shadow-[0_6px_14px_-8px_rgba(11,47,87,0.5)] ${m.rot} ${m.pos} ${m.tone}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#6b7f94]">{m.from}</p>
                <p className="flex items-center gap-1 font-semibold text-[#243b53]">{m.text.replace(" 📎", "")}{m.text.includes("📎") ? <Paperclip className="h-3.5 w-3.5" aria-hidden /> : null}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-4 max-w-xl text-lg font-semibold text-[#8a4a0b]">Which one is cheapest? Hard to say. Different formats, different currencies, half of it in chat.</p>
        </div>

        <div
          className={`col-start-1 row-start-1 transition-all duration-500 ${after ? "opacity-100" : "pointer-events-none -translate-y-3 opacity-0"}`}
          aria-hidden={!after}
        >
          <div className="mx-auto grid max-w-xl gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border-2 border-[#3cb9fc] bg-white p-4 text-[#0b2f57]">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold">Harbour Freight</p>
                <span className="rounded-full bg-[#dff5e6] px-2 py-1 text-[10px] font-bold text-[#117a3d]">Lowest complete quote</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold">$1,635.00</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Dest.", "Customs", "Delivery"].map((l) => (
                  <span key={l} className="inline-flex items-center gap-1 rounded-full bg-[#e3f3fe] px-2.5 py-1 text-[11px] font-bold text-[#0c5a9c]">
                    <Check className="h-3 w-3" aria-hidden />
                    {l}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-[#d6e8f6] bg-white p-4 text-[#0b2f57]">
              <p className="font-bold">Kiwi Sea and Air</p>
              <p className="mt-1 text-2xl font-extrabold">$1,700.00</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Dest.", "Customs"].map((l) => (
                  <span key={l} className="inline-flex items-center gap-1 rounded-full bg-[#e3f3fe] px-2.5 py-1 text-[11px] font-bold text-[#0c5a9c]">
                    <Check className="h-3 w-3" aria-hidden />
                    {l}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1 rounded-full bg-[#fde8e8] px-2.5 py-1 text-[11px] font-bold text-[#b42318]">
                  <X className="h-3 w-3" aria-hidden />
                  Delivery
                </span>
              </div>
              <p className="mt-2 text-[12px] font-semibold text-[#a15c07]">Does not include: Delivery</p>
            </div>
          </div>
          <p className="mx-auto mt-4 max-w-xl text-lg font-semibold text-[#8a4a0b]">Same shape, side by side. You can see the gap straight away.</p>
        </div>
      </div>
    </div>
  );
}
