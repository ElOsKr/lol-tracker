// "1st", "2nd", "3rd", "4th"... including the teens, which break the pattern.
// Shared because both sides count things: the main process labels milestones,
// the recap page labels placements.
export function ordinal(n: number): string {
  const teens = n % 100;
  if (teens >= 11 && teens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
