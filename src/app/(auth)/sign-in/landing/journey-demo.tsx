"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Bell, Check, Lock, Phone, Send, Trophy, X } from "lucide-react";

/**
 * A made-up day on CargoTribe, told through two example people. It steps through on its own until someone taps,
 * then it is theirs to drive. Everything here is illustration, and the page says so.
 */
const STEPS = [
  {
    short: "Mei posts a job",
    who: "Mei, shipping agent in Shenzhen",
    title: "Mei has a container of furniture to move.",
    text: "She picks the route, says what is in the box and what she wants priced. About 30 seconds later it is on the board.",
  },
  {
    short: "Dan hears about it",
    who: "Dan, forwarder in Melbourne",
    title: "Dan gets an email the moment it goes up.",
    text: "He watches the Shenzhen to Melbourne lane. His rate card already knows his port charges, so the quote opens filled in.",
  },
  {
    short: "Quotes arrive, sealed",
    who: "Three forwarders, three prices",
    title: "Quotes land in one place. Nobody sees anyone else's.",
    text: "Each forwarder's price is sealed. Only Mei can read them, and they all arrive laid out the same way.",
  },
  {
    short: "Mei compares",
    who: "Mei, on her phone",
    title: "One glance shows who covers what.",
    text: "Customs missing on one? It is flagged. The lowest quote that covers everything is marked, so she is comparing like with like.",
  },
  {
    short: "Awarded. Now talk.",
    who: "Mei and Dan",
    title: "She awards Dan. Only then do they swap contact details.",
    text: "Phone numbers stay hidden until the award, and only the winner gets Mei's. Everyone else is told the job is closed.",
  },
] as const;

function Screen({ step }: { step: number }) {
  const chip = (label: string, ok: boolean) => (
    <span
      key={label}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        ok ? "bg-[#e3f3fe] text-[#0c5a9c]" : "bg-[#fde8e8] text-[#b42318]"
      }`}
    >
      {ok ? <Check className="h-3 w-3" aria-hidden /> : <X className="h-3 w-3" aria-hidden />}
      {label}
    </span>
  );

  if (step === 0) {
    return (
      <div className="space-y-3">
        <p className="text-[11px] font-bold text-[#0c5a9c]">New request</p>
        <div className="space-y-2 rounded-2xl border border-[#d6e8f6] p-3 text-[13px]">
          <p className="font-bold">Shenzhen to Melbourne</p>
          <p className="text-[#4a6785]">Sea, full container · 2 × 40HC</p>
          <p className="rounded-lg bg-[#f4faff] px-2 py-1.5">Flat-pack timber furniture, palletised</p>
          <div className="flex gap-1.5 pt-1">{["Dest.", "Customs", "Delivery"].map((l) => chip(l, true))}</div>
        </div>
        <div className="grid h-11 place-items-center rounded-xl bg-[#0c5a9c] text-sm font-bold text-white">Post request</div>
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#117a3d]">
          <Check className="h-4 w-4" aria-hidden /> Posted. Forwarders on this lane are watching.
        </p>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-2xl bg-[#0b3a6e] p-3 text-white">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[#7fd0ff]" aria-hidden />
          <div className="text-[13px]">
            <p className="font-bold">New job on your lane</p>
            <p className="text-[#cfe9ff]">Shenzhen to Melbourne · 2 × 40HC</p>
          </div>
        </div>
        <div className="space-y-1.5 rounded-2xl border border-[#cfe9ff] bg-[#e9f6ff] p-3 text-[13px]">
          <p className="font-bold text-[#0c5a9c]">Filled in from your rate card</p>
          <p>Port service charge · $165.00</p>
          <p>Customs entry · $120.00</p>
          <p className="font-bold">Total $285.00</p>
        </div>
        <div className="grid h-11 place-items-center gap-0 rounded-xl bg-[#0c5a9c] text-sm font-bold text-white">
          <span className="inline-flex items-center gap-2"><Send className="h-4 w-4" aria-hidden /> Send sealed quote</span>
        </div>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="space-y-2.5">
        <p className="text-[11px] font-bold text-[#0c5a9c]">Quotes (3)</p>
        {[
          ["Harbour Freight", "$1,635.00", true],
          ["Kiwi Sea and Air", "$1,700.00", false],
          ["Coastal Cargo", "$1,820.00", true],
        ].map(([name, price, verified]) => (
          <div key={name as string} className="flex items-center justify-between rounded-2xl border border-[#d6e8f6] p-3 text-[13px]">
            <div>
              <p className="font-bold">{name}</p>
              <p className="flex items-center gap-1 text-[11px] text-[#4a6785]">
                {verified ? <BadgeCheck className="h-3.5 w-3.5 text-[#0c5a9c]" aria-hidden /> : null}
                {verified ? "Verified" : "Unverified"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-right">
              <Lock className="h-3.5 w-3.5 text-[#4a6785]" aria-hidden />
              <span className="font-bold">{price}</span>
            </div>
          </div>
        ))}
        <p className="text-center text-[11px] text-[#4a6785]">Only Mei sees these prices.</p>
      </div>
    );
  }
  if (step === 3) {
    return (
      <div className="space-y-2.5">
        <div className="space-y-2 rounded-2xl border-2 border-[#3cb9fc] p-3 text-[13px]">
          <div className="flex items-start justify-between">
            <p className="font-bold">Harbour Freight</p>
            <span className="rounded-full bg-[#dff5e6] px-2 py-1 text-[10px] font-bold text-[#117a3d]">Lowest complete quote</span>
          </div>
          <p className="text-lg font-extrabold">$1,635.00</p>
          <div className="flex flex-wrap gap-1.5">{["Dest.", "Customs", "Delivery"].map((l) => chip(l, true))}</div>
        </div>
        <div className="space-y-2 rounded-2xl border border-[#d6e8f6] p-3 text-[13px]">
          <p className="font-bold">Kiwi Sea and Air</p>
          <p className="text-lg font-extrabold">$1,700.00</p>
          <div className="flex flex-wrap gap-1.5">
            {chip("Dest.", true)}
            {chip("Customs", true)}
            {chip("Delivery", false)}
          </div>
          <p className="text-[12px] font-semibold text-[#a15c07]">Does not include: Delivery</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-2xl bg-[#dff5e6] p-3 text-[13px] font-bold text-[#117a3d]">
        <Trophy className="h-5 w-5" aria-hidden /> Awarded to Harbour Freight
      </div>
      <div className="space-y-2 rounded-2xl border border-[#d6e8f6] p-3 text-[13px]">
        <p className="text-[11px] font-bold text-[#0c5a9c]">Contact details unlocked</p>
        <p className="font-bold">Dan Whitfield</p>
        <p className="flex items-center gap-2 text-[#4a6785]"><Phone className="h-4 w-4" aria-hidden /> +61 3 5550 0142</p>
        <p className="pt-1 text-[11px] text-[#4a6785]">Shared with the winner only. The other quoters were told the job is closed.</p>
      </div>
    </div>
  );
}

export function JourneyDemo() {
  const [step, setStep] = useState(0);
  const [driving, setDriving] = useState(false);

  useEffect(() => {
    if (driving || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 5200);
    return () => clearInterval(timer);
  }, [driving]);

  const s = STEPS[step];
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:gap-16">
      <div>
        <div role="tablist" aria-label="A day on CargoTribe" className="flex flex-wrap gap-2">
          {STEPS.map((t, i) => (
            <button
              key={t.short}
              role="tab"
              aria-selected={i === step}
              onClick={() => {
                setDriving(true);
                setStep(i);
              }}
              className={`min-h-11 rounded-full px-4 text-[14px] font-bold transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#3cb9fc] ${
                i === step ? "bg-[#0c5a9c] text-white" : "bg-white text-[#0b2f57] ring-1 ring-[#cfe3f3] hover:bg-[#e8f4fd]"
              }`}
            >
              {t.short}
            </button>
          ))}
        </div>
        <div className="mt-7 min-h-[11rem] max-w-[34rem]" aria-live="polite">
          <p className="font-hand text-2xl text-[#d9731a]">{s.who}</p>
          <h3 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{s.title}</h3>
          <p className="mt-3 text-lg leading-relaxed text-[#4a6785]">{s.text}</p>
        </div>
        <p className="mt-3 text-sm text-[#4a6785]">An example, with made-up people and prices. Tap any step.</p>
      </div>

      <div className="mx-auto w-[min(290px,82vw)] overflow-hidden rounded-[2.2rem] border-[7px] border-[#0b2f57] bg-white shadow-[0_30px_60px_-24px_rgba(11,47,87,0.65)]">
        <div className="flex items-center justify-between bg-[#0b2f57] px-4 py-2 text-[11px] font-bold text-white">
          <span>CargoTribe</span>
          <span className="text-[#7fd0ff]">{step + 1} of {STEPS.length}</span>
        </div>
        <div key={step} className="min-h-[360px] animate-[screen-in_.45s_ease-out] p-4 text-[#0b2f57]">
          <Screen step={step} />
        </div>
      </div>
    </div>
  );
}
