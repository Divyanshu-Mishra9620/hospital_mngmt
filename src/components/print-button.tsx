"use client";

import { Printer } from "lucide-react";
import { Button, type ButtonVariant } from "@/components/ui/button";

export function PrintButton({ label = "Print", variant = "outline" }: { label?: string; variant?: ButtonVariant }) {
  return (
    <Button variant={variant} size="sm" onClick={() => window.print()} className="no-print">
      <Printer aria-hidden /> {label}
    </Button>
  );
}
