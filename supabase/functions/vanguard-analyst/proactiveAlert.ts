import { logCriticalError } from "../_shared/errorLogging.ts";
import { sendMessage } from "../_shared/telegram.ts";

export async function checkProactiveAlert(
  supabase: any,
  userId: string,
  biometrics: any[],
  graphLinks: any[],
  spiral: any
): Promise<void> {
  try {
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
    const chatId = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') ?? '0')
    if (!telegramToken || !chatId) return

    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: recentAlert } = await supabase
      .from('vanguard_stream')
      .select('id')
      .eq('user_id', userId)
      .eq('source', 'analyst_alert')
      .gte('created_at', fortyEightHoursAgo)
      .limit(1)
      .maybeSingle()

    if (recentAlert) return

    if (!biometrics || biometrics.length < 3) return

    const sorted = [...biometrics].sort((a, b) => b.date.localeCompare(a.date))
    const recent3 = sorted.slice(0, 3)

    const validHrvs = biometrics.map(b => b.hrv_avg).filter(v => v != null && v > 0)
    if (validHrvs.length < 5) return

    const baselineHrv = validHrvs.reduce((a: number, b: number) => a + b, 0) / validHrvs.length
    const recent3Hrv = recent3.map(b => b.hrv_avg).filter(v => v != null && v > 0)
    const recent3Readiness = recent3.map(b => b.readiness_score).filter(v => v != null && v > 0)

    let alertReason: string | null = null
    let alertEmoji = '⚠️'

    if (spiral && spiral.type === 'downward_spiral') {
      alertReason = spiral.reason
      alertEmoji = '⚠️🚨'
    }

    if (!alertReason && spiral && spiral.type === 'upward_momentum') {
      alertReason = spiral.reason
      alertEmoji = '✅🔥'
    }

    if (!alertReason && recent3Hrv.length >= 3 && recent3Hrv.every(h => h < baselineHrv * 0.85)) {
      const avgRecent = Math.round(recent3Hrv.reduce((a: number, b: number) => a + b, 0) / recent3Hrv.length)
      alertReason = `HRV poniżej baseline przez 3+ dni: avg ${avgRecent} vs baseline ${Math.round(baselineHrv)} (${Math.round((avgRecent/baselineHrv)*100)}% normy)`
      alertEmoji = '📉'
    }

    if (!alertReason && recent3Readiness.length >= 3 && recent3Readiness.every(r => r < 60)) {
      const avgReadiness = Math.round(recent3Readiness.reduce((a: number, b: number) => a + b, 0) / recent3Readiness.length)
      alertReason = `Readiness poniżej 60 przez 3+ dni: avg ${avgReadiness}`
      alertEmoji = '🔴'
    }

    const today = sorted[0]
    if (!alertReason && today?.execution_score != null && today?.readiness_score != null) {
      if (today.execution_score > 0.8 && today.readiness_score < 65) {
        alertReason = `Wysokie obciążenie przy niskiej regeneracji: readiness ${today.readiness_score}, execution ${(today.execution_score * 100).toFixed(0)}%`
        alertEmoji = '⚡'
      }
    }

    if (!alertReason) return

    const graphContext: string[] = []
    if (Array.isArray(graphLinks) && graphLinks.length > 0) {
      const relevantLinks = graphLinks
        .filter((g: any) =>
          g.relation === 'doswiadcza' ||
          g.relation === 'wywoluje' ||
          (g.source_entity === 'Jakub' && ['Zmęczenie', 'Przeziębienie', 'Choroba', 'Kontuzja', 'Wypalenie'].some(
            word => (g.target_entity || '').includes(word)
          ))
        )
        .slice(0, 3)
        .map((g: any) => `• ${g.source_entity} → ${g.relation} → ${g.target_entity}`)
      graphContext.push(...relevantLinks)
    }

    const graphSection = graphContext.length > 0
      ? `\n\n📊 *Z grafu — podobne wzorce w historii:*\n${graphContext.join('\n')}`
      : ''

    const recentSummary = recent3.map(b =>
      `${b.date}: readiness ${b.readiness_score ?? '—'}, HRV ${b.hrv_avg ?? '—'}, sen ${b.sleep_hours ?? '—'}h`
    ).join('\n')

    const alertMsg = `${alertEmoji} *Alert regeneracji*\n\n${alertReason}\n\n*Ostatnie 3 dni:*\n${recentSummary}${graphSection}\n\n_Vanguard Analyst — ${new Date().toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' })}_`

    await sendMessage(telegramToken, chatId, alertMsg, { parseMode: 'Markdown' })

    await supabase.from('vanguard_stream').insert({
      user_id: userId,
      source: 'analyst_alert',
      content: `[ALERT]: ${alertReason}`,
      metadata: {
        alert_reason: alertReason,
        baseline_hrv: Math.round(baselineHrv),
        recent_hrv: recent3Hrv,
        recent_readiness: recent3Readiness,
        alert_type: alertEmoji === '📉' ? 'hrv_decline' : alertEmoji === '🔴' ? 'readiness_low' : alertEmoji === '⚠️🚨' ? 'downward_spiral' : alertEmoji === '✅🔥' ? 'upward_momentum' : 'overreach_risk',
      },
    }).throwOnError()

    console.log(`[analyst] proactive alert sent: ${alertReason.substring(0, 80)}`)
  } catch (alertErr) {
    console.error('[analyst] checkProactiveAlert error (non-fatal):', alertErr)
  }
}


