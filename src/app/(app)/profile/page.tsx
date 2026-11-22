import Link from "next/link";
import { LogOut } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireMember } from "@/lib/auth";
import { ProfileForm } from "./profile-form";
import { signOut } from "./actions";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const me = await requireMember();
  const { company } = me;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Profile</h1>

      <Card className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">{company.name}</h2>
          {company.trust_level === "verified" ? (
            <Badge tone="verified">Verified</Badge>
          ) : (
            <Badge tone="warning">Unverified</Badge>
          )}
          {company.status === "suspended" ? <Badge tone="danger">Suspended</Badge> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {company.country} · {company.role === "agent" ? "Overseas agent" : "ANZ forwarder"}
        </p>
        {company.trust_level !== "verified" ? (
          <p className="text-sm">
            Get verified to award jobs. An admin reviews companies by hand; contact the Southbound
            team to start.
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">Signed in as {me.email}</p>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Your contact details</h2>
        <ProfileForm fullName={me.full_name} phone={me.phone ?? ""} />
      </Card>

      {me.is_admin ? (
        <Link href="/admin" className="block text-sm font-medium text-accent underline">
          Open admin
        </Link>
      ) : null}

      <form action={signOut}>
        <Button type="submit" variant="outline">
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </Button>
      </form>
    </div>
  );
}
