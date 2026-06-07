export function calculateProjection(data, field, daysIntoFuture = 42) {
  if (!data || data.length < 3) return null;

  const recentData = data.slice(-14);
  const n = recentData.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  recentData.forEach((d, i) => {
    const x = i;
    const val = Number(d[field]);
    if (isNaN(val) || val === 0) return;

    sumX += x;
    sumY += val;
    sumXY += x * val;
    sumXX += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const currentIndex = n - 1;
  const projectedValue = slope * (currentIndex + daysIntoFuture) + intercept;
  const currentActual = recentData[n - 1][field];

  return {
    value: projectedValue.toFixed(1),
    change: (projectedValue - currentActual).toFixed(1),
  };
}

export function generateNarrative(body, oura, sessions) {
  if (!sessions || sessions.length === 0) return null;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const lastWeekSessions = sessions.filter(s => new Date(s.date) >= sevenDaysAgo).length;
  const lastWeekSleep = oura?.filter(o => new Date(o.date) >= sevenDaysAgo && Number(o.total_sleep_hours) > 0);
  const prevWeekSleep = oura?.filter(o => new Date(o.date) >= fourteenDaysAgo && new Date(o.date) < sevenDaysAgo && Number(o.total_sleep_hours) > 0);

  const avgSleepLast = lastWeekSleep?.length ? lastWeekSleep.reduce((acc, o) => acc + Number(o.total_sleep_hours), 0) / lastWeekSleep.length : 0;
  const avgSleepPrev = prevWeekSleep?.length ? prevWeekSleep.reduce((acc, o) => acc + Number(o.total_sleep_hours), 0) / prevWeekSleep.length : 0;
  const sleepDiffMin = (lastWeekSleep?.length >= 2 && prevWeekSleep?.length >= 2)
    ? Math.round((avgSleepLast - avgSleepPrev) * 60)
    : 0;

  const lastWeekBody = body?.filter(b => new Date(b.date) >= sevenDaysAgo && Number(b.weight) > 0);
  const bodyDiffWeight = lastWeekBody?.length >= 2 ? (Number(lastWeekBody[lastWeekBody.length - 1].weight) - Number(lastWeekBody[0].weight)).toFixed(1) : null;
  const bodyDiffWaist = lastWeekBody?.length >= 2 ? (Number(lastWeekBody[lastWeekBody.length - 1].waist) - Number(lastWeekBody[0].waist)).toFixed(1) : null;

  let text = `To byĹ‚ ${lastWeekSessions >= 4 ? 'wybitnie mocny' : lastWeekSessions >= 3 ? 'solidny' : 'rozgrzewkowy'} tydzieĹ„. `;
  text += `ZrealizowaĹ‚eĹ› ${lastWeekSessions} treningi. `;

  if (sleepDiffMin !== 0) {
    text += `TwĂłj sen ${sleepDiffMin > 0 ? 'poprawiĹ‚ siÄ™' : 'pogorszyĹ‚ siÄ™'} Ĺ›rednio o ${Math.abs(sleepDiffMin)} min na dobÄ™. `;
  } else if (avgSleepLast > 0) {
    text += `Ĺšrednio sypiaĹ‚eĹ› po ${Math.floor(avgSleepLast)}h ${Math.round((avgSleepLast % 1) * 60)}m. `;
  }

  if (bodyDiffWaist && bodyDiffWaist != 0) {
    text += `W obwodzie pasa ${bodyDiffWaist < 0 ? 'zeszĹ‚o' : 'przybyĹ‚o'} ${Math.abs(bodyDiffWaist)} cm. `;
  } else if (bodyDiffWeight && bodyDiffWeight != 0) {
    text += `Waga ${bodyDiffWeight < 0 ? 'spadĹ‚a' : 'wzrosĹ‚a'} o ${Math.abs(bodyDiffWeight)} kg. `;
  }

  text += `RĂłb swoje, proces dziaĹ‚a.`;
  return text;
}
