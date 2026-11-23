import { BottomNav, TopNav } from "@/components/nav";
import { LandDefs } from "@/components/job-card";
import { requireMember } from "@/lib/auth";
import { getViewMode } from "@/lib/view-mode";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember();
  const mode = await getViewMode(me.company);
  return (
    <div className="min-h-screen">
      <TopNav mode={mode} />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-screen-2xl px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-8 lg:px-10">
        {children}
      </main>
      <BottomNav mode={mode} />
      <LandDefs />
    </div>
  );
}
