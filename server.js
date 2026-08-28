import express from "express";
import axios from "axios";
import cors from "cors";

const ACCESS_TOKEN = "EAATkJFrUtUYBSFUxmeYrxpTExRaSBrpVLZAw30uFJMmU5hFxChLHS9FLR2gMVuPveVQbSXqmNhwxU3L1ZBfbi7vVU43d1XDCoKPoBBRgqMct76VAdHu5sVZAnu86oaHZBU7EKBwREqugG";
const AD_ACCOUNT_ID = "act_2272933602783318";

const app = express();

// 1. CORS universal y captura de cuerpo
app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["*"] }));
app.use(express.json());

// 2. Registro detallado de peticiones en la consola de Render
app.use((req, res, next) => {
  console.log(`[PETICION] Método: ${req.method} | URL: ${req.url} | Headers:`, JSON.stringify(req.headers));
  if (req.method === "POST") {
    console.log(`[BODY]:`, JSON.stringify(req.body));
  }
  next();
});

// 3. Endpoint SSE para registro y descubrimiento
app.get(["/sse", "/"], (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });

  const sessionId = "session_" + Date.now();
  res.write(`event: endpoint\ndata: https://meta-ads-mcp-68s7.onrender.com/messages?sessionId=${sessionId}\n\n`);

  const keepAlive = setInterval(() => {
    res.write(":\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    res.end();
  });
});

// 4. Endpoint RPC para responder a Gemini
app.post(["/messages", "/"], async (req, res) => {
  const { id, method, params } = req.body || {};

  // Handshake inicial
  if (method === "initialize") {
    return res.json({
      jsonrpc: "2.0",
      id: id ?? null,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "meta-ads-server", version: "1.0.0" }
      }
    });
  }

  // Confirmación
  if (method === "notifications/initialized") {
    return res.status(200).send("OK");
  }

  // Lista de herramientas disponibles
  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id: id ?? null,
      result: {
        tools: [
          {
            name: "list_campaigns",
            description: "Lista todas las campañas publicitarias de Meta Ads y su estado",
            inputSchema: { type: "object", properties: {} }
          },
          {
            name: "get_campaign_insights",
            description: "Obtiene métricas de rendimiento (gasto, impresiones, clics, CTR, CPC) de Meta Ads",
            inputSchema: {
              type: "object",
              properties: {
                date_preset: {
                  type: "string",
                  description: "Rango de tiempo (today, yesterday, this_month, last_30d)",
                  default: "last_30d"
                }
              }
            }
          }
        ]
      }
    });
  }

  // Ejecución de herramientas
  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};

    try {
      if (toolName === "list_campaigns") {
        const response = await axios.get(
          `https://graph.facebook.com/v26.0/${AD_ACCOUNT_ID}/campaigns`,
          {
            params: {
              access_token: ACCESS_TOKEN,
              fields: "name,status,objective,budget_remaining"
            }
          }
        );
        return res.json({
          jsonrpc: "2.0",
          id: id ?? null,
          result: { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] }
        });
      }

      if (toolName === "get_campaign_insights") {
        const datePreset = args.date_preset || "last_30d";
        const response = await axios.get(
          `https://graph.facebook.com/v26.0/${AD_ACCOUNT_ID}/insights`,
          {
            params: {
              access_token: ACCESS_TOKEN,
              date_preset: datePreset,
              fields: "campaign_name,impressions,clicks,spend,cpc,ctr"
            }
          }
        );
        return res.json({
          jsonrpc: "2.0",
          id: id ?? null,
          result: { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] }
        });
      }
    } catch (err) {
      return res.json({
        jsonrpc: "2.0",
        id: id ?? null,
        error: { code: -32603, message: err.response?.data?.error?.message || err.message }
      });
    }
  }

  return res.json({ jsonrpc: "2.0", id: id ?? null, error: { code: -32601, message: "Method not found" } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor MCP listo en el puerto ${PORT}`);
});
