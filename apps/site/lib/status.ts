// What the status block says was measured, as it was measured: these numbers
// come from running `npm test`, not from memory. Run it again and update them,
// with the "What is checked" of ROADMAP.md.

/** When the numbers below were taken. */
export const MEASURED = 'October 24, 2026';

export const TESTS: { where: string; count: number }[] = [
  { where: 'packages/core', count: 31 },
  { where: 'packages/server', count: 19 },
  { where: 'packages/react', count: 13 },
];
