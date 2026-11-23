"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";

/** Two-step delete: removing a rate card cannot be undone. */
export function ConfirmDelete({ action }: { action: () => Promise<void> }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-destructive">
        <Trash2 className="h-4 w-4" aria-hidden />
        {t("Delete this rate card")}
      </button>
    );
  }
  return (
    <form action={action} className="space-y-2 rounded-xl bg-muted p-3">
      <p className="text-sm">{t("Delete this rate card? Quotes will stop filling in from it. This cannot be undone.")}</p>
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" className="flex-1">
          {t("Confirm delete")}
        </Button>
        <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
          {t("Keep it")}
        </Button>
      </div>
    </form>
  );
}
