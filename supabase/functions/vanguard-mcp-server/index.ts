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
import { createServiceClient, corsHeaders } from "../_shared/supabase.ts"
import { getVanguardUserId } from "../_shared/constants.ts"
import { fetchWorldState } from "../_shared/worldState.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const authHeader = req.headers.get("Authorization")
  const expectedToken = Deno.env.get("MCP_SERVER_SECRET")
  
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }

  try {
    const body = await req.json()
    const supabase = createServiceClient()
    const userId = getVanguardUserId()

    if (body.method === "tools/call") {
      const { name, arguments: args } = body.params || {}

      if (name === "get_world_state") {
        const state = await fetchWorldState(supabase, userId, args?.date)
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            content: [{ type: "text", text: JSON.stringify(state, null, 2) }]
          }
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
      
      return new Response(JSON.stringify({
         jsonrpc: "2.0",
         id: body.id,
         error: { code: -32601, message: "Tool not found" }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    if (body.method === "tools/list") {
       return new Response(JSON.stringify({
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
       }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    return new Response(JSON.stringify({ error: "Method not supported" }), { 
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
