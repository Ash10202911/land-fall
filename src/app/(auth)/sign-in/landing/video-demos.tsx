"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

const VIDEOS = [
  {
    id: "post",
    tab: "Post a job",
    who: "For agents",
    title: "Tell us the route and the cargo. That is the whole job.",
    body: "Watch a job go up in about 30 seconds, from the first port to a posted request.",
    src: "/marketing/video-post.webm",
    poster: "/marketing/poster-post.png",
  },
  {
    id: "compare",
    tab: "Compare quotes",
    who: "For agents",
    title: "Every quote on one screen, in the same shape.",
    body: "See what each forwarder covers, spot what is missing, and award the one you trust.",
    src: "/marketing/video-compare.webm",
    poster: "/marketing/poster-compare.png",
  },
  {
    id: "quote",
    tab: "Quote fast",
    who: "For forwarders",
    title: "Your rate card does the typing.",
    body: "Open a job on your lane and the quote is already filled in. Check it, send it, done.",
    src: "/marketing/video-quote.webm",
    poster: "/marketing/poster-quote.png",
  },
] as const;

/** A phone-shaped frame around a screen recording. */
function Phone({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[2.2rem] border-[7px] border-[#0b2f57] bg-[#0b2f57] shadow-[0_30px_60px_-24px_rgba(11,47,87,0.65)] ${className}`}>
      {children}
    </div>
  );
}

/**
 * The hero video: the comparison recording, muted and looping. It starts only once the page has loaded, and not at all
 * for people on a data-saver connection or who prefer reduced motion (they see the still).
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = () => setArmed(true);
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, []);
  return (
    <Phone className="mx-auto w-[min(250px,70vw)] rotate-[2deg]">
      <video
        ref={ref}
        className="block h-auto w-full bg-[#0b2f57]"
        poster="/marketing/poster-compare.png"
        src={armed ? "/marketing/video-compare.webm" : undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        aria-label="A screen recording of comparing two quotes on CargoTribe"
      />
    </Phone>
  );
}

/** Three recordings of the real portal, with captions burned in. Pick one and it plays. */
export function VideoDemos() {
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const current = VIDEOS[active];

  useEffect(() => {
    const v = ref.current;
    if (!v || !started) return;
    v.load();
    void v.play().catch(() => {});
  }, [active, started]);

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-16">
      <div>
        <div role="tablist" aria-label="Demo videos" className="flex flex-wrap gap-2">
          {VIDEOS.map((v, i) => (
            <button
              key={v.id}
              role="tab"
              id={`video-tab-${v.id}`}
              aria-selected={i === active}
              aria-controls="video-panel"
              onClick={() => {
                setActive(i);
                setStarted(true);
              }}
              className={`min-h-11 rounded-full px-5 text-[15px] font-bold transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#3cb9fc] ${
                i === active ? "bg-[#0c5a9c] text-white" : "bg-white text-[#0b2f57] ring-1 ring-[#cfe3f3] hover:bg-[#e8f4fd]"
              }`}
            >
              {v.tab}
            </button>
          ))}
        </div>
        <div id="video-panel" role="tabpanel" aria-labelledby={`video-tab-${current.id}`} className="mt-7 max-w-[34rem]">
          <p className="font-hand text-2xl text-[#d9731a]">{current.who}</p>
          <h3 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{current.title}</h3>
          <p className="mt-3 text-lg leading-relaxed text-[#4a6785]">{current.body}</p>
          <p className="mt-4 text-sm text-[#4a6785]">A real recording of the portal, with demo data. No sound needed.</p>
        </div>
      </div>

      <div className="relative mx-auto w-[min(300px,80vw)]">
        <Phone>
          <video
            ref={ref}
            className="block h-auto w-full bg-[#0b2f57]"
            poster={current.poster}
            src={started ? current.src : undefined}
            muted
            playsInline
            controls={started}
            preload="none"
            aria-label={`Screen recording: ${current.tab}`}
          />
        </Phone>
        {!started ? (
          <button
            onClick={() => setStarted(true)}
            className="absolute inset-0 m-auto grid h-20 w-20 place-items-center rounded-full bg-[#ffb454] text-[#0b2f57] shadow-[0_14px_30px_-10px_rgba(0,0,0,0.5)] transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label={`Play: ${current.tab}`}
          >
            <Play className="ml-1 h-9 w-9 fill-current" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
