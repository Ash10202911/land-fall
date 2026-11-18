import { BottomNav, TopNav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 md:px-6 md:pb-10 md:pt-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
