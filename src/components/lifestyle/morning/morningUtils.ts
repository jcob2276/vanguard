import { formatWarsawDate, getTodayWarsaw } from '../../../lib/date';

export const DEFAULT_DECLARATIONS = [
  "Mój głos tworzy mój świat – w mojej mowie nie ma nic przypadkowego.",
  "Jestem tym, który ufa sobie. Wybieram intencję i intuicję ponad reaktywność.",
  "Moje życie jest odbiciem tego, na co nakierowuję swoje neurony lustrzane.",
  "Nie muszę być gotowy. Po prostu robię to, co ma być zdone w tej chwili.",
  "Stanę się dokładnie tym, czego od siebie oczekuję.",
  "Zachowuję się tak, jakby nie było żadnych ograniczeń dla moich możliwości."
];

export function calculateStreak(ritualDates: string[]): number {
  if (ritualDates.length === 0) return 0;
  const sorted = [...ritualDates]
    .map(d => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime()); // Descending

  const todayStr = getTodayWarsaw();
  const yesterdayStr = formatWarsawDate(Date.now() - 86400000);
  
  // Check if streak is still valid (must contain today or yesterday)
  const formattedDates = sorted.map(d => d.toISOString().split('T')[0]);
  if (!formattedDates.includes(todayStr) && !formattedDates.includes(yesterdayStr)) {
    return 0;
  }

  let streak = 0;
  let checkDate = new Date(formattedDates[0]); // Start from latest completed

  // If latest was yesterday and not today, start counting from yesterday
  if (formattedDates[0] === yesterdayStr && !formattedDates.includes(todayStr)) {
    checkDate = new Date(yesterdayStr);
  }

  for (let i = 0; i < formattedDates.length; i++) {
    const expectedStr = checkDate.toISOString().split('T')[0];
    if (formattedDates.includes(expectedStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
