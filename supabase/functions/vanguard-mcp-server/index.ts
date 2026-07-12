/**
 * @function vanguard-mcp-server
 * @trigger HTTP POST / Model Context Protocol (MCP) z autoryzacją tokenem MCP_SERVER_SECRET
 * @role Serwer MCP udostępniający stan systemu i narzędzia dla agentów AI.
 * @reads vanguard_stream, entities, claims, daily_strain
 * @writes vanguard_stream, audit_events
 * @calls —
 * @consumer AI coding assistants / personal agents
 * @status active
 */
import { serveJson } from "../_shared/http.ts"
import { getVanguardUserId } from "../_shared/constants.ts"
import { fetchWorldState } from "../_shared/worldState.ts"

Deno.serve(serveJson(async (req, ctx) => {
  const authHeader = req.headers.get("Authorization")
  const expectedToken = Deno.env.get("MCP_SERVER_SECRET")

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    throw new Error("Unauthorized")
  }

  const body = await req.clone().json()
  const supabase = ctx.supabase
  const userId = getVanguardUserId()

  if (body.method === "tools/call") {
    const { name, arguments: args } = body.params || {}

    if (name === "get_world_state") {
      const state = await fetchWorldState(supabase, userId, args?.date)
      return {
        jsonrpc: "2.0",
        id: body.id,
        result: {
          content: [{ type: "text", text: JSON.stringify(state, null, 2) }]
        }
      }
    }

    return {
      jsonrpc: "2.0",
      id: body.id,
      error: { code: -32601, message: "Tool not found" }
    }
  }

  if (body.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: body.id,
      result: {
        tools: [
          {
            name: "get_world_state",
            description: "Retrieves the Vanguard World State (unified JSON containing biometrics, execution score, sleep, and state classification). Use this to check if the user is in a state ready for heavy work or needs recovery.",
            inputSchema: {
              type: "object",
              properties: {
                date: { type: "string", description: "Optional. YYYY-MM-DD date. Defaults to today (Warsaw time)." }
              }
            }
          }
        ]
      }
    }
  }

  throw new Error("Method not supported")
}, { auth: 'none' }))
