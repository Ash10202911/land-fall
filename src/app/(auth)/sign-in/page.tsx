import Image from "next/image";
import { redirect } from "next/navigation";
import { Bricolage_Grotesque, Caveat } from "next/font/google";
import { BadgeCheck, Bell, EyeOff, FileSpreadsheet, Handshake, Lock, MessagesSquare, Repeat, Scale } from "lucide-react";
import { getMe } from "@/lib/auth";
import { SignInForm } from "./sign-in-form";
import { getT } from "@/lib/i18n/server";
import { BeforeAfter } from "./landing/before-after";
import { JourneyDemo } from "./landing/journey-demo";
import { LanePicker } from "./landing/lane-picker";
import { HeroVideo, VideoDemos } from "./landing/video-demos";

export const metadata = {
  title: "Sign in or join",
  description:
    "CargoTribe is where overseas freight agents and Australian and New Zealand forwarders meet. Post a job, get sealed quotes, award the best one.",
};

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-brand", display: "swap" });
const hand = Caveat({ subsets: ["latin"], variable: "--font-hand", display: "swap", weight: ["600"] });

const AGENT_POINTS = [
  { icon: Scale, text: "One request, many sealed quotes, compared line by line" },
  { icon: MessagesSquare, text: "Ask and answer questions on a job in public, without handing out your phone number" },
  { icon: Repeat, text: "Repeat last month's job in one tap" },
  { icon: Handshake, text: "Award the one you trust. Contact details unlock for you and the winner only" },
];

const FORWARDER_POINTS = [
  { icon: Bell, text: "An email the moment a job lands on a lane you watch" },
  { icon: FileSpreadsheet, text: "Rate cards, built in the app or uploaded as a CSV, that fill in your quotes" },
  { icon: Lock, text: "Your price is sealed. Only the agent who posted the job ever sees it" },
  { icon: BadgeCheck, text: "A Verified badge, so agents know who they are dealing with" },
];

function Heading({ note, children, sub }: { note?: string; children: React.ReactNode; sub?: string }) {
  return (
    <div className="max-w-[40rem]">
      {note ? <p className="font-hand text-2xl text-[#d9731a]">{note}</p> : null}
      <h2 className="text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">{children}</h2>
      {sub ? <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-[#4a6785]">{sub}</p> : null}
    </div>
  );
}

/** A hand-written note stuck on the page, to make it feel like someone made it. */
function Sticky({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`font-hand absolute w-max max-w-[11rem] rounded-md bg-[#ffd98a] px-3 py-1.5 text-center text-[1.35rem] leading-tight text-[#5a3a05] shadow-[0_8px_16px_-8px_rgba(0,0,0,0.5)] ${className}`}>
      {children}
    </p>
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
    <main
      className={`${display.variable} ${hand.variable} bg-white text-[#0b2f57]`}
      style={{ fontFamily: "var(--font-brand), system-ui, sans-serif" }}
    >
      <style>{`
        .font-hand { font-family: var(--font-hand), "Comic Sans MS", cursive; font-weight: 600; }
        @keyframes screen-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } .animate-\\[screen-in_\\.45s_ease-out\\] { animation: none; } }
      `}</style>

      {/* Hero: the pitch, the way in, and the product moving */}
      <section className="relative overflow-hidden bg-[#0c5a9c] text-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-5 sm:px-8">
          <span className="inline-block rounded-2xl bg-white px-3 py-2">
            <Image src="/brand/cargotribe-logo.webp" alt="CargoTribe" width={2000} height={500} className="h-8 w-auto sm:h-10" priority />
          </span>
          <a href="#sign-in" className="rounded-full px-4 py-2 text-[15px] font-bold text-white ring-1 ring-white/40 hover:bg-white/10">
            Sign in
          </a>
        </div>

        <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-10 lg:pb-24 lg:pt-14">
          <div>
            <h1 className="max-w-[16ch] text-[2.75rem] font-extrabold leading-[1.0] tracking-tight sm:text-6xl lg:text-[4.2rem]">
              Quotes shouldn&apos;t live in your inbox.
            </h1>
            <p className="mt-5 max-w-[44ch] text-lg leading-relaxed text-[#d8efff]">
              CargoTribe is where agents who ship to Australia and New Zealand meet the forwarders who deliver. Post once. Compare in one place. Award with confidence.
            </p>

            <div id="sign-in" className="mt-8 max-w-md scroll-mt-6 rounded-3xl bg-white p-6 text-[#0b2f57] shadow-[0_24px_60px_-20px_rgba(4,24,48,0.55)]">
              <h2 className="text-2xl font-extrabold tracking-tight">Come on in</h2>
              <p className="mt-1 text-sm text-[#4a6785]">No password. We email you a link. New here? Enter your email and we will set you up.</p>
              {error ? (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {t("That sign-in link did not work or has expired. Request a new one below.")}
                </p>
              ) : null}
              <div className="mt-4">
                <SignInForm />
              </div>
            </div>
            <p className="mt-4 text-[15px] text-[#bde6fe]">
              Not ready?{" "}
              <a href="#watch" className="font-bold text-white underline decoration-[#ffb454] decoration-2 underline-offset-4">
                Watch it work first
              </a>
              .
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[22rem] pb-6 pt-4">
            <HeroVideo />
            <Sticky className="-left-1 top-8 -rotate-6 sm:-left-8">your price stays sealed</Sticky>
            <Sticky className="-right-1 bottom-24 rotate-3 sm:-right-6">see who covers what</Sticky>
          </div>
        </div>
      </section>

      {/* A day on CargoTribe, tap through */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <Heading note="Here is how a quote travels" sub="Two people, one container, five steps. Tap through, or just watch.">
          From &ldquo;I have cargo&rdquo; to &ldquo;it&apos;s sorted&rdquo;
        </Heading>
        <div className="mt-10">
          <JourneyDemo />
        </div>
      </section>

      {/* The mess it replaces */}
      <section className="bg-[#eaf5fe]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <Heading note="You know this one" sub="Quotes arrive in whatever shape the sender likes. Flip the switch and see the same prices laid out properly.">
            Less chasing, more shipping
          </Heading>
          <div className="mt-10">
            <BeforeAfter />
          </div>
        </div>
      </section>

      {/* Real recordings with zoom */}
      <section id="watch" className="mx-auto w-full max-w-6xl scroll-mt-4 px-5 py-16 sm:px-8 sm:py-24">
        <Heading note="No slides. The real thing." sub="Short recordings of the actual portal, zoomed in where it matters.">
          Watch it work
        </Heading>
        <div className="mt-10">
          <VideoDemos />
        </div>
      </section>

      {/* Connection: forwarders get found by the right jobs */}
      <section className="bg-[#eaf5fe]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <Heading note="Forwarders, this one is for you" sub="Tell us the lanes you work. When a matching job goes up, you hear about it straight away, and your quote is ready to go.">
            The right jobs find you
          </Heading>
          <div className="mt-10">
            <LanePicker />
          </div>
        </div>
      </section>

      {/* The tribe */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <Heading note="Two sides, one tribe" sub="Agents overseas know the cargo. Forwarders here know the port, the customs and the last mile. Any company can ask for quotes and send them, so you can be both.">
          Built for people who move freight
        </Heading>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[2rem] bg-[#f4faff] p-6 ring-1 ring-[#dcebf7] sm:p-9">
            <h3 className="text-xl font-extrabold">If you ship to Australia or New Zealand</h3>
            <ul className="mt-5 space-y-4">
              {AGENT_POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#0c5a9c]" aria-hidden>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[15px] leading-snug">{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[2rem] bg-[#0b3a6e] p-6 text-white sm:p-9">
            <h3 className="text-xl font-extrabold">If you deliver here</h3>
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
        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Lock, title: "Sealed until you choose", body: "Rival forwarders never see each other's prices." },
            { icon: EyeOff, title: "Contact details stay private", body: "They unlock for you and the winner, after the award." },
            { icon: BadgeCheck, title: "Verified companies award", body: "Every company is checked by hand before it can award a job." },
          ].map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <Icon className="mt-1 h-5 w-5 shrink-0 text-[#1a73c8]" aria-hidden />
              <div>
                <p className="font-bold">{title}</p>
                <p className="text-sm text-[#4a6785]">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Close */}
      <section className="bg-[#0c5a9c] text-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 text-center sm:px-8 sm:py-24">
          <p className="font-hand text-3xl text-[#ffd98a]">Pull up a chair</p>
          <h2 className="mx-auto mt-1 max-w-[18ch] text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">Come and join the tribe</h2>
          <p className="mx-auto mt-4 max-w-[46ch] text-lg text-[#d8efff]">An email address and about a minute. No password, no card.</p>
          <a
            href="#sign-in"
            className="mt-8 inline-flex min-h-14 items-center rounded-2xl bg-[#ffb454] px-8 text-lg font-extrabold text-[#0b2f57] transition-transform hover:scale-[1.03] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Sign in or join
          </a>
        </div>
      </section>

      <footer className="bg-white">
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
