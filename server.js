import express from "express";
import axios from "axios";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

const ACCESS_TOKEN = "EAATkJFrUtUYBSFUxmeYrxpTExRaSBrpVLZAw30uFJMmU5hFxChLHS9FLR2gMVuPveVQbSXqmNhwxU3L1ZBfbi7vVU43d1XDCoKPoBBRgqMct76VAdHu5sVZAnu86oaHZBU7EKBwREqugG";
const AD_ACCOUNT_ID = "act_2272933602783318";

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json());

const server = new Server(
  {
    name: "meta-ads-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Definición de herramientas
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_campaigns",
        description: "Lista todas las campañas publicitarias de Meta Ads y su estado",
        inputSchema: {
          type: "object",
          properties: {}
        }
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
  };
});

// Llamadas a herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "list_campaigns") {
      const response = await axios.get(
        `https://graph.facebook.com/v26.0/${AD_ACCOUNT_ID}/campaigns`,
        {
          params: {
            access_token: ACCESS_TOKEN,
            fields: "name,status,objective,budget_remaining"
          }
        }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }]
      };
    }

    if (name === "get_campaign_insights") {
      const datePreset = args?.date_preset || "last_30d";
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
      return {
        content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }]
      };
    }

    throw new Error(`Herramienta no encontrada: ${name}`);
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    return {
      content: [{ type: "text", text: `Error de Meta API: ${errorMsg}` }],
      isError: true
    };
  }
});

const transports = new Map();

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports.set(transport.sessionId, transport);

  req.on("close", () => {
    transports.delete(transport.sessionId);
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports.get(sessionId);

  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(404).send("Sesión no encontrada");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor MCP listo en el puerto ${PORT}`);
});
