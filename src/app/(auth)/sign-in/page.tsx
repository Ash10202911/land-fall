import Image from "next/image";
import { redirect } from "next/navigation";
import { Bricolage_Grotesque, Caveat } from "next/font/google";
import { BadgeCheck, Bell, EyeOff, FileSpreadsheet, Handshake, Lock, MessagesSquare, Repeat, Scale } from "lucide-react";
import { getMe } from "@/lib/auth";
import { SignInForm } from "./sign-in-form";
import { getT } from "@/lib/i18n/server";
import { BeforeAfter } from "./landing/before-after";
import { HeroCollage } from "./landing/hero-collage";
import { JourneyDemo } from "./landing/journey-demo";
import { LanePicker } from "./landing/lane-picker";
import { OnTheGo } from "./landing/on-the-go";
import { VideoDemos } from "./landing/video-demos";

export const metadata = {
  title: "Sign in or join",
  description:
    "The community where freight agents and forwarders meet to move cargo into and out of Australia and New Zealand. Post a job, get sealed quotes, award the best one.",
};

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-brand", display: "swap" });
const hand = Caveat({ subsets: ["latin"], variable: "--font-hand", display: "swap", weight: ["600"] });

/** A very faint paper grain, so the light backgrounds do not look flat and digital. */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .42  0 0 0 0 .3  0 0 0 0 .14  0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const AGENT_POINTS = [
  { icon: Scale, text: "One request, many sealed quotes, compared line by line. Imports or exports" },
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
      {note ? <p className="font-hand text-2xl text-[#c2620f]">{note}</p> : null}
      <h2 className="text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">{children}</h2>
      {sub ? <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-[#5a6f86]">{sub}</p> : null}
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
    <main
      className={`${display.variable} ${hand.variable} bg-[#fffdf9] text-[#0b2f57]`}
      style={{ fontFamily: "var(--font-brand), system-ui, sans-serif" }}
    >
      <style>{`
        .font-hand { font-family: var(--font-hand), "Comic Sans MS", cursive; font-weight: 600; }
        @keyframes screen-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes card-in { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; } }
        .hero-card { animation: card-in .7s cubic-bezier(.2,.8,.2,1) both; }
        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } .hero-card { animation: none; } }
      `}</style>

      {/* Hero: a warm welcome, one line to join, and the product arriving around a phone */}
      <section className="relative isolate overflow-hidden bg-[linear-gradient(165deg,#fff4e3_0%,#fdeedd_32%,#eaf4fc_100%)]">
        <div className="pointer-events-none absolute -right-24 -top-24 -z-10 h-[26rem] w-[26rem] rounded-full bg-[#ffd9a0]/60 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-24 -z-10 h-[24rem] w-[24rem] rounded-full bg-[#bfe3fb]/70 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.22] mix-blend-multiply" style={{ backgroundImage: GRAIN }} aria-hidden />

        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-5 sm:px-8">
          <Image src="/brand/cargotribe-logo.webp" alt="CargoTribe" width={2000} height={500} className="h-9 w-auto mix-blend-multiply sm:h-11" priority />
          <a href="#sign-in" className="rounded-full px-4 py-2 text-[15px] font-bold text-[#0b3a6e] ring-1 ring-[#0b3a6e]/25 hover:bg-white/70">
            Sign in
          </a>
        </div>

        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-end lg:gap-6 lg:pt-12">
          <div className="pb-2 lg:pb-24">
            <p className="font-hand text-3xl text-[#c2620f]">G&apos;day, and welcome</p>
            <h1 className="mt-1 max-w-[13ch] text-[2.9rem] font-extrabold leading-[0.98] tracking-tight text-[#0b2f57] sm:text-6xl lg:text-[4.4rem]">
              Freight&apos;s easier with friends.
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-[#4a6785]">
              CargoTribe is where freight agents and forwarders find each other, for cargo moving into or out of Australia and New Zealand. Post once, compare in one place, award with confidence.
            </p>

            <div id="sign-in" className="mt-8 max-w-lg scroll-mt-8">
              {error ? (
                <p role="alert" className="mb-3 text-sm text-destructive">
                  {t("That sign-in link did not work or has expired. Request a new one below.")}
                </p>
              ) : null}
              <SignInForm inline />
              <p className="mt-3 text-[15px] text-[#5a6f86]">
                No password. We email you a link, and it takes about a minute. Already a member? Same box.
              </p>
            </div>
            <p className="mt-5 text-[15px] text-[#4a6785]">
              Want to see it first?{" "}
              <a href="#watch" className="font-bold text-[#0b3a6e] underline decoration-[#ffb454] decoration-2 underline-offset-4">
                Watch it work
              </a>
              .
            </p>
          </div>

          <HeroCollage />
        </div>
      </section>

      {/* A day on CargoTribe, tap through */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <Heading note="Here is how a quote travels" sub="Two people, one container, five steps. Tap through, or just watch. It works the same the other way round: a forwarder in Australia posting an export gets quotes from forwarders at the other end.">
          From &ldquo;I have cargo&rdquo; to &ldquo;it&apos;s sorted&rdquo;
        </Heading>
        <div className="mt-10">
          <JourneyDemo />
        </div>
      </section>

      {/* The mess it replaces */}
      <section className="bg-[#fdf1e1]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <Heading sub="Quotes arrive in whatever shape the sender likes. On CargoTribe they all arrive the same way, laid out side by side.">
            Quotes shouldn&apos;t live in your inbox
          </Heading>
          <div className="mt-10">
            <BeforeAfter />
          </div>
        </div>
      </section>

      {/* Quoting is quick: at a desk first, and the phone as a bonus */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <OnTheGo />
      </section>

      {/* Real recordings with zoom */}
      <section id="watch" className="mx-auto w-full max-w-6xl scroll-mt-4 px-5 py-16 sm:px-8 sm:py-24">
        <Heading sub="Posting a job, comparing quotes and sending a quote, start to finish.">
          Watch it work
        </Heading>
        <div className="mt-10">
          <VideoDemos />
        </div>
      </section>

      {/* Connection: forwarders get found by the right jobs */}
      <section className="bg-[#eef6fd]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <Heading sub="Tell us the lanes you work, in or out of Australia and New Zealand. When a matching job goes up, you hear about it straight away, and your quote is ready to go.">
            The right jobs find you
          </Heading>
          <div className="mt-10">
            <LanePicker />
          </div>
        </div>
      </section>

      {/* The tribe */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <Heading sub="Agents know the cargo and the customer. Forwarders know the port, the customs and the last mile. Any company can ask for quotes and send them, in either direction, so you can be both.">
          Built for people who move freight
        </Heading>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[2rem] bg-[#fff6ea] p-6 ring-1 ring-[#f0e1cb] sm:p-9">
            <h3 className="text-xl font-extrabold">If you need cargo moved</h3>
            <ul className="mt-5 space-y-4">
              {AGENT_POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#c2620f] ring-1 ring-[#f0e1cb]" aria-hidden>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[15px] leading-snug">{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[2rem] bg-[#eef6fd] p-6 ring-1 ring-[#d3e6f6] sm:p-9">
            <h3 className="text-xl font-extrabold">If you move cargo</h3>
            <ul className="mt-5 space-y-4">
              {FORWARDER_POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#0c5a9c] ring-1 ring-[#d3e6f6]" aria-hidden>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[15px] leading-snug">{text}</span>
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
              <Icon className="mt-1 h-5 w-5 shrink-0 text-[#c2620f]" aria-hidden />
              <div>
                <p className="font-bold">{title}</p>
                <p className="text-sm text-[#5a6f86]">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Close: the one dark moment on the page */}
      <section className="bg-[#0b3a6e] text-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 text-center sm:px-8 sm:py-24">
          <p className="font-hand text-3xl text-[#ffd98a]">Pull up a chair</p>
          <h2 className="mx-auto mt-1 max-w-[18ch] text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">Come and join the tribe</h2>
          <p className="mx-auto mt-4 max-w-[46ch] text-lg text-[#d8efff]">An email address and about a minute. No password, no card.</p>
          <a
            href="#sign-in"
            className="mt-8 inline-flex min-h-14 items-center rounded-2xl bg-[#ffb454] px-8 text-lg font-extrabold text-[#0b2f57] transition-transform hover:scale-[1.03] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Join the tribe
          </a>
        </div>
      </section>

      <footer className="bg-[#fffdf9]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-[#5a6f86] sm:flex-row sm:items-center sm:justify-between sm:px-8">
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
