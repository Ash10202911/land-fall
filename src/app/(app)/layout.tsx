import { BottomNav, TopNav } from "@/components/nav";
import { requireMember } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireMember();
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-28 pt-5 md:px-6 md:pb-12 md:pt-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
