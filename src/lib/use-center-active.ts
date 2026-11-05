"use client";

import { useEffect, type RefObject } from "react";

/**
 * Keeps the selected chip (aria-pressed="true") visible inside a horizontally
 * scrolling chip row on phones. Only scrolls the row, never the page.
 */
export function useCenterActive(ref: RefObject<HTMLElement | null>, key: unknown) {
  useEffect(() => {
    const row = ref.current;
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    const left = chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [ref, key]);
}
