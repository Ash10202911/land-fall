import Image from "next/image";
import { redirect } from "next/navigation";
import { Bricolage_Grotesque } from "next/font/google";
import { BadgeCheck, EyeOff, Handshake, Lock, MessagesSquare, Repeat, Scale, Bell, FileSpreadsheet } from "lucide-react";
import { getMe } from "@/lib/auth";
import { SignInForm } from "./sign-in-form";
import { getT } from "@/lib/i18n/server";

export const metadata = {
  title: "Sign in or join",
  description:
    "CargoTribe is where overseas freight agents and Australian and New Zealand forwarders meet. Post a job, get sealed quotes, award the best one.",
};

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-brand", display: "swap" });

/** The portal, as it looks on a phone. Real screens from the app. */
const SCREENS = [
  {
    src: "/marketing/board.png",
    title: "Find work on your lanes",
    body: "Open jobs from agents around the world, filtered by port and mode. See how busy a job is before you quote.",
    alt: "The CargoTribe job board on a phone, showing open jobs with routes and deadlines",
  },
  {
    src: "/marketing/compare.png",
    title: "Compare quotes like for like",
    body: "Every quote shows what it covers. Missing customs or delivery is flagged, and the lowest complete quote is marked.",
    alt: "Two sealed quotes side by side, with what each covers and a lowest complete quote badge",
  },
  {
    src: "/marketing/prefill.png",
    title: "Quote in seconds from your rate card",
    body: "Save your port charges and cartage once. Every matching job opens with the quote already filled in. You check it, then send.",
    alt: "A quote form already filled in from a saved rate card",
  },
] as const;

const AGENT_POINTS = [
  { icon: Scale, text: "One request, many sealed quotes, compared line by line" },
  { icon: MessagesSquare, text: "Ask and answer questions on a job, in public, without giving out your contact details" },
  { icon: Repeat, text: "Repeat last month's job in one tap" },
  { icon: Handshake, text: "Award the best quote. Contact details unlock for you and the winner only" },
];

const FORWARDER_POINTS = [
  { icon: Bell, text: "Lane alerts by email the moment a matching job is posted" },
  { icon: FileSpreadsheet, text: "Rate cards, built in the app or uploaded as a CSV, that pre-fill your quotes" },
  { icon: Lock, text: "Your price is sealed. Only the requester ever sees it" },
  { icon: BadgeCheck, text: "A Verified badge that tells agents who they are dealing with" },
];

function Point({ icon: Icon, text }: { icon: typeof Scale; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e3f3fe] text-[#0c5a9c]" aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[15px] leading-snug text-[#0b2f57]">{text}</span>
    </li>
  );
}

/** A route drawn once across the hero: the most characteristic thing in this trade. Still under reduced motion. */
function RouteLine() {
  // The strip is a fixed height and the curve stretches to its width; the ports are plain HTML so they never distort.
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 sm:h-36" aria-hidden>
      <svg viewBox="0 0 600 140" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="route" x1="0" x2="1">
            <stop offset="0" stopColor="#bde6fe" stopOpacity="0.35" />
            <stop offset="1" stopColor="#3cb9fc" />
          </linearGradient>
        </defs>
        <path
          className="route-path"
          d="M 24 112 C 160 20, 330 20, 430 80 S 540 70 576 40"
          fill="none"
          stroke="url(#route)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="1 9"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="absolute left-[4%] top-[80%] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
      <span className="absolute left-[4%] top-[80%] translate-x-3 -translate-y-1/2 text-sm font-semibold text-[#bde6fe]">Shenzhen</span>
      <span className="absolute left-[96%] top-[29%] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#3cb9fc]" />
      <span className="absolute left-[96%] top-[29%] -translate-x-[calc(100%+0.9rem)] -translate-y-1/2 text-sm font-semibold text-white">Sydney</span>
    </div>
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getT();
  const me = await getMe();
  if (me) redirect(me.company ? "/jobs" : "/onboarding");
  const { error } = await searchParams;

  return (
    <main className={`${display.variable} bg-white text-[#0b2f57]`} style={{ fontFamily: "var(--font-brand), system-ui, sans-serif" }}>
      <style>{`
        .route-path { animation: route-fade 1.6s ease-out 0.2s both; }
        @keyframes route-fade { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .route-path { animation: none; } }
      `}</style>

      {/* Hero: the pitch on the left, the way in on the right */}
      <section className="relative overflow-hidden bg-[#0c5a9c] text-white">
        <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-10 px-5 pb-40 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-14 lg:pb-44 lg:pt-8">
          <div className="lg:col-span-2">
            <span className="inline-block rounded-2xl bg-white px-3 py-2">
              <Image src="/brand/cargotribe-logo.webp" alt="CargoTribe" width={2000} height={500} className="h-9 w-auto sm:h-10" priority />
            </span>
          </div>

          <div className="space-y-5">
            <h1 className="max-w-[18ch] text-[2.6rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
              Where freight agents and forwarders get deals done
            </h1>
            <p className="max-w-[46ch] text-lg leading-relaxed text-[#d8efff]">
              Post a job in about 30 seconds. Forwarders send sealed quotes that only you can read. Compare them side by side and award the best one.
            </p>
            <p className="max-w-[46ch] text-base text-[#bde6fe]">
              Built for overseas agents shipping to Australia and New Zealand, and the forwarders who deliver.
            </p>
          </div>

          <div id="sign-in" className="scroll-mt-6 rounded-3xl bg-white p-6 text-[#0b2f57] shadow-[0_24px_60px_-20px_rgba(4,24,48,0.55)] sm:p-7">
            <h2 className="text-2xl font-bold tracking-tight">Sign in or join</h2>
            <p className="mt-1 text-sm text-[#4a6785]">No password. We email you a link. New here? Enter your email and we will set you up.</p>
            {error ? (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {t("That sign-in link did not work or has expired. Request a new one below.")}
              </p>
            ) : null}
            <div className="mt-5">
              <SignInForm />
            </div>
          </div>
        </div>
        <RouteLine />
      </section>

      {/* Three plain facts, no numbers we cannot back up */}
      <section className="border-b border-[#e3eef7] bg-[#f4faff]">
        <ul className="mx-auto grid w-full max-w-6xl gap-px px-5 sm:grid-cols-3 sm:px-8">
          {[
            { icon: Lock, title: "Sealed until you choose", body: "Forwarders cannot see each other's prices, and nor can anyone else." },
            { icon: EyeOff, title: "Contact details stay private", body: "They unlock for you and the winner after an award, and not before." },
            { icon: BadgeCheck, title: "Awards need a Verified company", body: "Every company is checked by hand before it can award a job." },
          ].map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3 py-5 sm:px-4 sm:first:pl-0">
              <Icon className="mt-1 h-5 w-5 shrink-0 text-[#1a73c8]" aria-hidden />
              <div>
                <p className="font-bold">{title}</p>
                <p className="text-sm text-[#4a6785]">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* What the portal does, shown with real screens */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <h2 className="max-w-[24ch] text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          Less chasing, more shipping
        </h2>
        <p className="mt-3 max-w-[56ch] text-lg text-[#4a6785]">
          Quotes chased across email threads and chat apps cost hours. Here, every quote arrives in one place, laid out the same way.
        </p>
        <div className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-6">
          {SCREENS.map((s) => (
            <figure key={s.src} className="flex flex-col gap-4">
              <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[2rem] border-[6px] border-[#0b2f57] bg-[#0b2f57] shadow-[0_18px_40px_-18px_rgba(11,47,87,0.6)]">
                <Image src={s.src} alt={s.alt} width={390} height={844} className="h-auto w-full" />
              </div>
              <figcaption className="text-center sm:text-left">
                <p className="text-lg font-bold">{s.title}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-[#4a6785]">{s.body}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* The tribe: two sides who need each other */}
      <section className="bg-[#f4faff]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="max-w-[26ch] text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            One tribe, two sides of the same shipment
          </h2>
          <p className="mt-3 max-w-[58ch] text-lg text-[#4a6785]">
            Agents overseas know the cargo. Forwarders here know the port, the customs and the last mile. CargoTribe puts them in the same room.
          </p>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl bg-white p-6 shadow-[0_1px_0_#dcebf7,0_14px_30px_-22px_rgba(11,47,87,0.35)] sm:p-8">
              <h3 className="text-xl font-bold">If you ship to Australia or New Zealand</h3>
              <ul className="mt-5 space-y-4">
                {AGENT_POINTS.map((p) => (
                  <Point key={p.text} {...p} />
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-[#0b3a6e] p-6 text-white shadow-[0_14px_30px_-22px_rgba(11,47,87,0.6)] sm:p-8">
              <h3 className="text-xl font-bold">If you deliver here</h3>
              <ul className="mt-5 space-y-4">
                {FORWARDER_POINTS.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-[#7fd0ff]" aria-hidden>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[15px] leading-snug text-[#e6f4ff]">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-6 max-w-[62ch] text-[15px] text-[#4a6785]">
            Any company can ask for quotes and send quotes. Choose what you want to do each time you sign in.
          </p>
        </div>
      </section>

      {/* Close */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 text-center sm:px-8 sm:py-20">
        <h2 className="mx-auto max-w-[22ch] text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Ready to join the tribe?</h2>
        <p className="mx-auto mt-3 max-w-[50ch] text-lg text-[#4a6785]">It takes an email address and about a minute.</p>
        <a
          href="#sign-in"
          className="mt-7 inline-flex min-h-12 items-center rounded-2xl bg-[#0c5a9c] px-7 text-base font-bold text-white transition-colors hover:bg-[#0b3a6e] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#3cb9fc]"
        >
          Sign in or join
        </a>
      </section>

      <footer className="border-t border-[#e3eef7] bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-[#4a6785] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="inline-flex items-center gap-2 font-bold text-[#0b2f57]">
            <Image src="/brand/cargotribe-icon.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
            CargoTribe
          </span>
          <span>cargotribe.com.au · Sealed freight quotes for agents and forwarders</span>
        </div>
      </footer>
    </main>
  );
}
