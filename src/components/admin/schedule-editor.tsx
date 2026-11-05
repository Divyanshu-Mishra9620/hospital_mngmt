"use client";

import { useMemo, useState } from "react";
import { Copy, Plus, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/cn";

export type Block = { weekday: number; startTime: string; endTime: string; mode: "both" | "in_person" | "video" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const MODE_LABEL: Record<Block["mode"], string> = { both: "In-person & video", in_person: "In-person only", video: "Video only" };

function mins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Weekly OPD schedule editor. Writes the blocks as JSON into a hidden
 * `schedule` input that the server action validates.
 */
export function ScheduleEditor({ initial, slotMinutes = 15 }: { initial: Block[]; slotMinutes?: number }) {
  const [blocks, setBlocks] = useState<Block[]>(() =>
    [...initial].sort((a, b) => DAY_ORDER.indexOf(a.weekday) - DAY_ORDER.indexOf(b.weekday) || a.startTime.localeCompare(b.startTime)),
  );

  const update = (i: number, patch: Partial<Block>) => setBlocks((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const remove = (i: number) => setBlocks((bs) => bs.filter((_, j) => j !== i));
  const add = (b?: Partial<Block>) => setBlocks((bs) => [...bs, { weekday: 1, startTime: "09:30", endTime: "13:30", mode: "both", ...b }]);
  const copyToWeekdays = (i: number) => {
    const src = blocks[i];
    setBlocks((bs) => {
      const others = bs.filter((b) => !(b.startTime === src.startTime && b.endTime === src.endTime && b.mode === src.mode));
      const copies = [1, 2, 3, 4, 5, 6].map((wd) => ({ ...src, weekday: wd }));
      return [...others, ...copies].sort((a, b) => DAY_ORDER.indexOf(a.weekday) - DAY_ORDER.indexOf(b.weekday) || a.startTime.localeCompare(b.startTime));
    });
  };

  const problems = useMemo(() => {
    const out = new Set<number>();
    blocks.forEach((b, i) => {
      if (mins(b.endTime) - mins(b.startTime) < 30) out.add(i);
      blocks.forEach((o, j) => {
        if (i !== j && o.weekday === b.weekday && b.startTime < o.endTime && o.startTime < b.endTime) out.add(i);
      });
    });
    return out;
  }, [blocks]);

  const weeklySlots = blocks.reduce((s, b) => s + Math.max(0, Math.floor((mins(b.endTime) - mins(b.startTime)) / slotMinutes)), 0);

  return (
    <div>
      <input type="hidden" name="schedule" value={JSON.stringify(blocks)} />
      {/* Week overview */}
      <div className="mb-4 grid grid-cols-7 gap-1.5 text-center text-[0.6875rem]">
        {DAY_ORDER.map((wd) => {
          const day = blocks.filter((b) => b.weekday === wd);
          return (
            <div key={wd} className={cn("rounded-lg border px-1 py-2", day.length ? "border-brand-200 bg-brand-50" : "border-line bg-surface")}>
              <p className="font-semibold text-ink-800">{DAYS[wd]}</p>
              {day.length ? (
                day.map((b, k) => (
                  <p key={k} className="tabular mt-0.5 text-ink-600">
                    {b.startTime}–{b.endTime}
                    {b.mode === "video" && <Video className="ml-0.5 inline size-3 text-violet-700" aria-label="video only" />}
                  </p>
                ))
              ) : (
                <p className="mt-0.5 text-ink-400">Off</p>
              )}
            </div>
          );
        })}
      </div>

      <ul className="space-y-2">
        {blocks.map((b, i) => (
          <li
            key={i}
            className={cn(
              "grid grid-cols-2 items-end gap-2 rounded-xl border p-2.5 sm:grid-cols-[7.5rem_7rem_7rem_minmax(0,1fr)_auto]",
              problems.has(i) ? "border-danger-100 bg-danger-50" : "border-line bg-white",
            )}
          >
            <label className="text-xs text-ink-500">
              Day
              <Select value={b.weekday} onChange={(e) => update(i, { weekday: Number(e.target.value) })} className="mt-1 h-10">
                {DAY_ORDER.map((wd) => (
                  <option key={wd} value={wd}>
                    {DAYS[wd]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-xs text-ink-500">
              From
              <Input type="time" step={300} value={b.startTime} onChange={(e) => update(i, { startTime: e.target.value })} className="mt-1 h-10" />
            </label>
            <label className="text-xs text-ink-500">
              To
              <Input type="time" step={300} value={b.endTime} onChange={(e) => update(i, { endTime: e.target.value })} className="mt-1 h-10" />
            </label>
            <label className="text-xs text-ink-500">
              Consultation mode
              <Select value={b.mode} onChange={(e) => update(i, { mode: e.target.value as Block["mode"] })} className="mt-1 h-10">
                {Object.entries(MODE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </label>
            <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
              <Button variant="ghost" size="sm" onClick={() => copyToWeekdays(i)} title="Copy this block to Monday–Saturday" aria-label="Copy to Monday–Saturday">
                <Copy aria-hidden />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remove(i)} title="Remove block" aria-label="Remove block" className="text-danger-700 hover:bg-danger-50">
                <Trash2 aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {blocks.length === 0 && <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-500">No OPD blocks — the doctor won&apos;t be bookable.</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => add()}>
            <Plus aria-hidden /> Add OPD block
          </Button>
          <Button variant="ghost" size="sm" onClick={() => add({ startTime: "17:00", endTime: "19:00", mode: "video" })}>
            <Plus aria-hidden /> Evening video block
          </Button>
        </div>
        <p className="text-xs text-ink-500">
          ≈ <span className="tabular font-semibold text-ink-700">{weeklySlots}</span> bookable slots / week at {slotMinutes} min
          {problems.size > 0 && <span className="ml-2 font-semibold text-danger-700">· Fix highlighted blocks (overlap or under 30 min)</span>}
        </p>
      </div>
    </div>
  );
}
