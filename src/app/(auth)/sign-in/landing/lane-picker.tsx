"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

const PLACES = ["Asia", "Europe", "North America", "Australia", "New Zealand"];
const FROM = PLACES;
const TO = PLACES;
const MODES = ["Sea, full container", "Sea, shared container", "Air"];

function Pick({ options, value, onPick, label }: { options: string[]; value: string; onPick: (v: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          aria-pressed={o === value}
          onClick={() => onPick(o)}
          className={`min-h-11 rounded-full px-4 text-[15px] font-bold transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#3cb9fc] ${
            o === value ? "bg-[#0c5a9c] text-white" : "bg-white text-[#0b2f57] ring-1 ring-[#eadfce] hover:bg-[#fff1dc]"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** Pick a lane and see the email a forwarder would get. Nothing is saved: it shows how the alerts feel. */
export function LanePicker() {
  const [from, setFrom] = useState("Asia");
  const [to, setTo] = useState("Australia");
  const [mode, setMode] = useState(MODES[0]);
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14">
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-base font-bold text-[#c2620f]">Jobs going from</p>
          <Pick options={FROM} value={from} onPick={setFrom} label="Origin country" />
        </div>
        <div>
          <p className="mb-2 text-base font-bold text-[#c2620f]">to</p>
          <Pick options={TO} value={to} onPick={setTo} label="Destination port" />
        </div>
        <div>
          <p className="mb-2 text-base font-bold text-[#c2620f]">by</p>
          <Pick options={MODES} value={mode} onPick={setMode} label="Mode" />
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-[0_20px_44px_-24px_rgba(11,47,87,0.5)] ring-1 ring-[#e6dcc9]" aria-live="polite">
        <div className="flex items-center gap-2 border-b border-[#e3eef7] pb-3 text-[13px] text-[#4a6785]">
          <Mail className="h-4 w-4 text-[#0c5a9c]" aria-hidden />
          <span>
            To: <strong className="text-[#0b2f57]">you</strong> · just now
          </span>
        </div>
        <p className="mt-3 text-lg font-extrabold leading-snug text-[#0b2f57]">
          {from === to ? "Pick two different places to see an alert" : `New job on your lane: ${from} to ${to}`}
        </p>
        <div className="mt-3 space-y-1.5 text-[15px] text-[#243b53]">
          <p>An agent has just posted a job on a lane you watch.</p>
          <p className="rounded-xl bg-[#f4faff] px-3 py-2 text-[14px]">
            {mode} · Freight + destination · closes in 3 days
          </p>
          <p>Your rate card is ready, so the quote opens filled in. Check it and send.</p>
        </div>
        <div className="mt-4 grid h-11 place-items-center rounded-xl bg-[#0c5a9c] text-sm font-bold text-white">Review and send your quote</div>
        <p className="mt-3 text-[12px] text-[#6b7f94]">Prices stay sealed. Only the agent who posted it ever sees your quote.</p>
      </div>
    </div>
  );
}
