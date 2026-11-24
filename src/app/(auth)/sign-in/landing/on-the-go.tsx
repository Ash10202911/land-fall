"use client";

import { useEffect, useState } from "react";
import { BatteryFull, Bell, BellRing, Check, ChevronUp, Laptop, Send, Signal, Smartphone, Wifi } from "lucide-react";

/** Where a forwarder might be when a job lands. The desk comes first: the phone is the bonus, not the point. */
const PLACES = ["your desk", "the car park", "the loading dock", "the airport lounge", "the couch"];

const STEPS = [
  { tab: "A job lands", title: "The job finds you.", text: "A matching job goes up and you hear about it straight away. No inbox to dig through." },
  { tab: "Check it", title: "Your quote is already filled in.", text: "Your rate card did the typing. Read down the lines and fix anything that needs fixing." },
  { tab: "Send it", title: "One click, and it is sent.", text: "Your price stays sealed. Only the agent who posted the job can see it." },
] as const;

const LINES = [
  ["Port service charge", "$165.00", "Destination port"],
  ["Delivery order fee", "$95.00", "Destination port"],
  ["Customs entry", "$120.00", "Customs"],
] as const;

/** The portal in a laptop browser: the main stage. */
function Desk({ step }: { step: number }) {
  return (
    <div className="overflow-hidden rounded-[1.4rem] bg-white shadow-[0_28px_60px_-30px_rgba(70,45,10,0.55)] ring-1 ring-[#e6dcc9]">
      <div className="flex items-center gap-3 border-b border-[#efe6d6] bg-[#faf4ea] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <i className="h-2.5 w-2.5 rounded-full bg-[#f0b3a6]" />
          <i className="h-2.5 w-2.5 rounded-full bg-[#f2d38f]" />
          <i className="h-2.5 w-2.5 rounded-full bg-[#b5d9a4]" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-1 text-[12px] text-[#6b7f94] ring-1 ring-[#efe6d6]">cargotribe.com.au</span>
      </div>
      <div key={step} className="min-h-[330px] animate-[screen-in_.45s_ease-out] p-4 text-[#0b2f57] sm:p-6 lg:pr-24">
        {step === 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-bold text-[#0c5a9c]">Job board</p>
            <div className="flex items-start gap-3 rounded-2xl bg-[#0b3a6e] p-4 text-white">
              <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-[#7fd0ff]" aria-hidden />
              <div className="text-[14px]">
                <p className="font-bold">New job on your lane</p>
                <p className="text-[#cfe9ff]">Sea, full container · 2 × 40HC · closes in 4 days</p>
              </div>
            </div>
            {["Sea, shared container · 1850 kg", "Air freight · 850 kg"].map((l) => (
              <div key={l} className="rounded-2xl border border-[#e3eef7] px-4 py-3 text-[14px] text-[#4a6785]">
                {l}
              </div>
            ))}
          </div>
        ) : step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="space-y-2 rounded-2xl bg-[#f4faff] p-4 text-[14px]">
              <p className="font-bold">The job</p>
              <p className="text-[#4a6785]">Sea, full container · 2 × 40HC</p>
              <p className="text-[#4a6785]">Flat-pack timber furniture</p>
              <p className="pt-1 text-[12px] font-semibold text-[#0c5a9c]">Only the agent sees your quote</p>
            </div>
            <div>
              <p className="rounded-xl bg-[#e9f6ff] px-3 py-2 text-[13px] font-semibold text-[#0c5a9c]">Filled in from your rate card. Check every line, then send.</p>
              <ul className="mt-3 space-y-2 text-[14px]">
                {LINES.map(([name, price, covers]) => (
                  <li key={name} className="rounded-xl border border-[#d6e8f6] px-3 py-2">
                    <div className="flex justify-between font-bold">
                      <span>{name}</span>
                      <span>{price}</span>
                    </div>
                    <p className="text-[11px] text-[#4a6785]">Covers: {covers}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-right text-sm font-extrabold">Total $380.00</p>
            </div>
          </div>
        ) : (
          <div className="grid min-h-[260px] place-items-center text-center">
            <div>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#dff5e6] text-[#117a3d]">
                <Check className="h-8 w-8" aria-hidden />
              </span>
              <p className="mt-4 text-2xl font-extrabold">Quote sent</p>
              <p className="mx-auto mt-1 max-w-[30ch] text-[15px] text-[#4a6785]">Only the agent who posted the job can see your price.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** The same moment on a phone: the bonus. */
function Pocket({ step }: { step: number }) {
  return (
    <div className="w-[128px] overflow-hidden rounded-[1.6rem] border-[4px] border-[#1d2f4d] bg-[#1d2f4d] shadow-[0_24px_44px_-22px_rgba(70,45,10,0.6)] sm:w-[150px]">
      <div key={step} className="h-[256px] overflow-hidden rounded-[1.2rem] bg-white sm:h-[300px]">
        {step === 0 ? (
          <div className="flex h-full flex-col items-center bg-[linear-gradient(170deg,#243b63_0%,#1b2f55_60%,#3a2f4f_100%)] px-2.5 pb-3 pt-3 text-white">
            <div className="flex w-full items-center justify-between text-[8px] font-semibold opacity-90">
              <span>7:42</span>
              <span className="flex items-center gap-0.5">
                <Signal className="h-2.5 w-2.5" aria-hidden />
                <Wifi className="h-2.5 w-2.5" aria-hidden />
                <BatteryFull className="h-2.5 w-2.5" aria-hidden />
              </span>
            </div>
            <p className="mt-5 text-4xl font-light">7:42</p>
            <div className="mt-5 w-full animate-[screen-in_.5s_ease-out] rounded-xl bg-white/90 p-2 text-[#0b2f57]">
              <p className="flex items-center justify-between text-[9px] font-bold">
                CargoTribe <span className="font-semibold text-[#6b7f94]">now</span>
              </p>
              <p className="text-[10px] font-semibold">New job on your lane</p>
              <p className="text-[9px] text-[#4a6785]">Your quote is ready to review.</p>
            </div>
            <div className="mt-auto flex flex-col items-center text-[8px] opacity-70">
              <ChevronUp className="h-3 w-3" aria-hidden />
              Swipe up
            </div>
          </div>
        ) : step === 1 ? (
          <div className="h-full animate-[screen-in_.45s_ease-out] p-2.5 text-[#0b2f57]">
            <p className="text-[10px] font-extrabold">Send a sealed quote</p>
            <p className="mt-1.5 rounded-lg bg-[#e9f6ff] p-1.5 text-[8px] font-semibold text-[#0c5a9c]">Filled in from your rate card.</p>
            <ul className="mt-2 space-y-1.5">
              {LINES.map(([name, price]) => (
                <li key={name} className="flex justify-between rounded-lg border border-[#d6e8f6] px-2 py-1.5 text-[9px] font-bold">
                  <span>{name}</span>
                  <span>{price}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid h-8 place-items-center rounded-lg bg-[#0c5a9c] text-[10px] font-bold text-white">Send sealed quote</div>
          </div>
        ) : (
          <div className="grid h-full animate-[screen-in_.45s_ease-out] place-items-center p-3 text-center text-[#0b2f57]">
            <div>
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#dff5e6] text-[#117a3d]">
                <Check className="h-5 w-5" aria-hidden />
              </span>
              <p className="mt-2 text-sm font-extrabold">Quote sent</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function OnTheGo() {
  const [step, setStep] = useState(0);
  const [driving, setDriving] = useState(false);
  const [place, setPlace] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setPlace((p) => (p + 1) % PLACES.length), 2600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (driving || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 3800);
    return () => clearInterval(t);
  }, [driving]);

  const s = STEPS[step];
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)] lg:gap-12">
      <div>
        <h3 className="text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
          Quote from{" "}
          <span className="inline-block text-[#c2620f]" aria-live="off">
            {PLACES[place]}
          </span>
        </h3>
        <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-[#5a6f86]">
          Your rate card fills the quote in, so quoting is open it, check it, send it, whether you are at a desk or away from one.
        </p>

        <div role="tablist" aria-label="Quoting step by step" className="mt-7 flex flex-wrap gap-2">
          {STEPS.map((t, i) => (
            <button
              key={t.tab}
              role="tab"
              aria-selected={i === step}
              onClick={() => {
                setDriving(true);
                setStep(i);
              }}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-[15px] font-bold transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#3cb9fc] ${
                i === step ? "bg-[#0b3a6e] text-white" : "bg-white text-[#0b2f57] ring-1 ring-[#eadfce] hover:bg-[#fff1dc]"
              }`}
            >
              {i === 0 ? <Bell className="h-4 w-4" aria-hidden /> : i === 1 ? <Check className="h-4 w-4" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              {t.tab}
            </button>
          ))}
        </div>
        <div className="mt-6 max-w-[40rem]" aria-live="polite">
          <p className="text-xl font-extrabold">{s.title}</p>
          <p className="mt-1 text-[17px] leading-relaxed text-[#5a6f86]">{s.text}</p>
        </div>

        <p className="mt-6 inline-flex items-center gap-4 text-[15px] font-semibold text-[#4a6785]">
          <span className="inline-flex items-center gap-1.5">
            <Laptop className="h-4 w-4 text-[#0c5a9c]" aria-hidden /> On your computer
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Smartphone className="h-4 w-4 text-[#c2620f]" aria-hidden /> And on your phone
          </span>
        </p>
      </div>

      <div className="relative pb-14 lg:pb-12 lg:pr-10">
        <Desk step={step} />
        <div className="absolute bottom-0 right-2 lg:-right-2">
          <Pocket step={step} />
        </div>
      </div>
    </div>
  );
}
