"use client";

import { useTransition } from "react";
import { setCampaignSpend } from "@/app/actions";

// Inline ad-spend input; commits on blur and recomputes CPL/CAC/ROAS.
export default function SpendEditor({
  campaign,
  spend,
}: {
  campaign: string;
  spend: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <input
      className="cell-input"
      type="number"
      min="0"
      step="1"
      defaultValue={spend || ""}
      disabled={pending}
      style={{ width: 110 }}
      onBlur={(e) => {
        const value = e.target.value === "" ? 0 : Number(e.target.value);
        if (value === spend) return;
        startTransition(() => setCampaignSpend(campaign, value));
      }}
    />
  );
}
