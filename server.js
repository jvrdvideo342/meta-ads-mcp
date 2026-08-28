import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// Permitir comunicación cruzada con Gemini Spark
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const ACCESS_TOKEN = "EAATkJFrUTuYBSfUxmeYrxpTExRaSBrpVLZAw30uFJMmU5hFxChLHS9FLR2gVMuPveVQbSXqmNhwxU3LlZBfbI7vVU43d1XDCoOKPoBBRgqMct76VAdHu5sVZAnu86oaHZBU7EKBwREque0m4IyahYi9GeX0yhQYomnDyqKZA6Quq65KigALz7crpgkBIBodcXW5zVx38qDLzFy1jfthKEV5J1mrun45a8WfogYC67ZBUtupMVEmR7ZATzLyA407PXlRWUxfCxJ2NDnjgsfRWO303QZDZD";
const AD_ACCOUNT_ID = "act_2272933602783318";

// Endpoint SSE
app.get("/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(`event: endpoint\ndata: https://${req.headers.host}/messages\n\n`);

  req.on("close", () => {
    res.end();
  });
});

// Manejador RPC para Gemini
app.post("/messages", async (req, res) => {
  const { method, params, id } = req.body;

  if (method === "initialize") {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "meta-ads-server", version: "1.0.0" }
      }
    });
  }

  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "list_campaigns",
            description: "Lista todas las campañas publicitarias y su estado",
            inputSchema: { type: "object", properties: {} }
          },
          {
            name: "get_campaign_insights",
            description: "Obtiene métricas de rendimiento (gasto, impresiones, clics, CTR, CPC)",
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

  if (method === "tools/call") {
    const toolName = params?.name;
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
          id,
          result: { content: [{ type: "text", text: JSON.stringify(response.data) }] }
        });
      }

      if (toolName === "get_campaign_insights") {
        const datePreset = params?.arguments?.date_preset || "last_30d";
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
          id,
          result: { content: [{ type: "text", text: JSON.stringify(response.data) }] }
        });
      }
    } catch (err) {
      return res.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message: err.response?.data?.error?.message || err.message }
      });
    }
  }

  res.status(404).json({ error: "Method not found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor MCP corriendo en el puerto ${PORT}`);
});
