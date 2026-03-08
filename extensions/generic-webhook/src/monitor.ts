import type { IncomingMessage, ServerResponse } from "node:http";
import type { ChannelGatewayContext, OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { readJsonBodyWithLimit } from "openclaw/plugin-sdk/core";
import type { GenericWebhookConfig } from "./config.js";

// Basic webhook payload shape expectation
interface WebhookPayload {
  messageId: string;
  senderId: string;
  senderName: string;
  text: string;
  threadId?: string;
  mediaUrls?: string[];
}

export function startGenericWebhookMonitor(params: {
  api: OpenClawPluginApi;
  context: ChannelGatewayContext;
  config: GenericWebhookConfig;
}) {
  const { api, context, config } = params;

  // The webhook endpoint will be: POST /api/plugins/generic-webhook/inbound
  const routePath = "/inbound";

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return true;
    }

    // Verify inbound token
    const authHeader = req.headers["authorization"];
    const expectedToken = `Bearer ${config.inboundToken}`;
    if (!authHeader || authHeader !== expectedToken) {
      res.writeHead(401).end("Unauthorized");
      return true;
    }

    try {
      // Hard limit of 1MB for generic webhook payloads
      const body = (await readJsonBodyWithLimit(req, 1024 * 1024)) as WebhookPayload;

      if (!body.text && !(body.mediaUrls && body.mediaUrls.length > 0)) {
        res.writeHead(400).end("Missing text or media");
        return true;
      }

      const senderId = body.senderId || "unknown-sender";
      const messageId = body.messageId || `msg_${Date.now()}`;

      // Dispatch to OpenClaw routing
      context.monitor.onMessage({
        messageId,
        agentId: context.agentId, // Use the default agent for the gateway
        deliveredTo: context.channel.id, // "generic-webhook"
        sender: {
          id: senderId,
          name: body.senderName || senderId,
          // Since it's a generic webhook, treat everything as a direct message for simplicity
          peerContext: {
            kind: "direct",
            id: senderId,
          },
        },
        threadId: body.threadId,
        text: body.text || "",
        mediaUrls: body.mediaUrls,
        receivedAt: Date.now(),
        isGroup: false,
      });

      res.writeHead(200).end(JSON.stringify({ status: "ok" }));
      return true;
    } catch (err: any) {
      context.monitor.logger.error("Error processing webhook inbound payload:", err);
      res.writeHead(500).end("Internal Server Error");
      return true;
    }
  };

  // Register the route with the Gateway Plugin API
  api.registerPluginHttpRoute({
    path: routePath,
    match: "exact",
    auth: "none", // We do our own Bearer token check above
    handler,
  });

  context.monitor.logger.info(`Generic webhook monitor listening on plugin route ${routePath}`);

  // Return a cleanup function
  return () => {
    context.monitor.logger.info("Stopping generic webhook monitor");
  };
}
