"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Two-step award: awarding cannot be undone, so ask once before submitting. */
export function AwardButton({
  action,
  companyName,
}: {
  action: () => Promise<void>;
  companyName: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="accent" size="full" onClick={() => setConfirming(true)}>
        <Trophy className="h-4 w-4" aria-hidden />
        Award to {companyName}
      </Button>
    );
  }
  return (
    <form action={action} className="space-y-2 rounded-md bg-muted p-3">
      <p className="text-sm">
        Award this job to <strong>{companyName}</strong>? Other quotes will be marked lost and you will both see each
        other&apos;s contact details. This cannot be undone.
      </p>
      <div className="flex gap-2">
        <Button type="submit" variant="accent" className="flex-1">
          Confirm award
        </Button>
        <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
