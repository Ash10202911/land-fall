import { BottomNav, TopNav } from "@/components/nav";
import { requireMember } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireMember();
  return (
    <div className="min-h-screen">
      <TopNav />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 pb-24 pt-4 sm:px-6 md:pb-10 md:pt-8 lg:px-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
