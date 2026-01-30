import { generateSamples, calculateSummary } from "../core/math.js";
import { createId } from "../core/id.js";
import type { Profile, Sequence, Session } from "./types.js";

export function createSessionSeed(
  name: string,
  start: string,
  durationSec: number,
  sampleCount: number,
  freq: number,
  amp: number
): Session {
  const samples = generateSamples(freq, amp, 10, 200);
  const summary = calculateSummary(samples);
  return {
    id: createId("session"),
    name,
    start,
    durationSec,
    sampleCount,
    samples,
    summary
  };
}

export const seedProfiles: Profile[] = [
  { id: "p1", name: "PD Rest Tremor", updated: "2024-03-14 09:12", freq: 5, amp: 45, noise: 8 },
  { id: "p2", name: "Essential Tremor", updated: "2024-03-18 15:44", freq: 7, amp: 35, noise: 15 },
  { id: "p3", name: "Postural Tremor", updated: "2024-03-21 11:05", freq: 5, amp: 25, noise: 12 }
];

export const seedSequences: Sequence[] = [
  {
    id: "s1",
    name: "Medication Response",
    steps: [
      { duration: 10, freq: 5, amp: 50, noise: 10 },
      { duration: 15, freq: 5, amp: 35, noise: 8 },
      { duration: 10, freq: 4, amp: 20, noise: 6 }
    ]
  }
];

export const seedSessions: Session[] = [
  createSessionSeed("Morning Assessment", "2024-03-20 08:02", 420, 2100, 5, 42),
  createSessionSeed("Post-Medication", "2024-03-21 16:28", 300, 1800, 4, 28)
];
