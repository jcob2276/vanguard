export function extractJsonObject(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim()
  const start = cleaned.indexOf('{')
  if (start === -1) return JSON.parse(cleaned)

  let depth = 0, inString = false, escaped = false
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1))
    }
  }
  return JSON.parse(cleaned)
}

export function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}
