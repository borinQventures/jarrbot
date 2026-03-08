import type {
  ChannelCommandAdapter,
  ChannelGatewayContext,
  ChannelToolSend,
} from "openclaw/plugin-sdk/core";
import { formatErrorMessage } from "openclaw/plugin-sdk/core";
import { fetch } from "undici"; // Standard HTTP library used in OpenClaw
import type { GenericWebhookConfig } from "./config.js";

export function createGenericWebhookAdapter(params: {
  context: ChannelGatewayContext;
  config: GenericWebhookConfig;
}): ChannelCommandAdapter {
  const { context, config } = params;

  async function deliver(payload: {
    messageId: string;
    text?: string;
    mediaUrl?: string;
    mediaUrls?: string[];
    replyToId?: string;
    targetId: string; // The original senderId we're replying to
  }) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.outboundToken) {
      headers["Authorization"] = `Bearer ${config.outboundToken}`;
    }

    // Assemble the outbound payload
    const outboundBody = {
      responseId: payload.messageId,
      targetId: payload.targetId,
      text: payload.text || "",
      mediaUrls: payload.mediaUrls || (payload.mediaUrl ? [payload.mediaUrl] : undefined),
      replyToId: payload.replyToId,
      agentId: context.agentId,
      timestamp: Date.now(),
    };

    try {
      context.monitor.logger.debug(`Sending outbound generic webhook to ${config.outboundUrl}`);
      const response = await fetch(config.outboundUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(outboundBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Outbound target returned ${response.status}: ${errorText}`);
      }
    } catch (err) {
      context.monitor.logger.error(
        "Failed to deliver outbound generic webhook:",
        formatErrorMessage(err),
      );
      throw err;
    }
  }

  return {
    async sendText(ctx, send: ChannelToolSend) {
      await deliver({
        messageId: send.messageId,
        text: send.text,
        replyToId: send.replyToId,
        targetId: ctx.target.normalized,
      });
    },

    async sendMedia(ctx, send: ChannelToolSend) {
      await deliver({
        messageId: send.messageId,
        text: send.text,
        mediaUrl: send.mediaUrl,
        replyToId: send.replyToId,
        targetId: ctx.target.normalized,
      });
    },

    // Not supported by simple webhook
    async sendReaction() {},
    async clearReaction() {},
    async sendTyping() {},

    async getChannelName() {
      return "Generic Webhook Channel";
    },
  };
}
