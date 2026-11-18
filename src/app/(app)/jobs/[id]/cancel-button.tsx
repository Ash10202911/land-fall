"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Two-step cancel: cancelling closes the job and marks every live quote as not selected. */
export function CancelJobButton({ action }: { action: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
        <XCircle className="h-4 w-4" aria-hidden />
        Cancel job
      </Button>
    );
  }
  return (
    <form action={action} className="space-y-2 rounded-md bg-muted p-3">
      <p className="text-sm">
        Cancel this job? It will be closed, every quote will be marked not selected, and quoting companies will be
        emailed. This cannot be undone.
      </p>
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" className="flex-1">
          Confirm cancel
        </Button>
        <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
          Keep job
        </Button>
      </div>
    </form>
  );
}
