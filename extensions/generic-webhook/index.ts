import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { createGenericWebhookAdapter } from "./src/adapter.js";
import { genericWebhookChannelPlugin, genericWebhookDock } from "./src/channel.js";
import { GenericWebhookConfigSchema } from "./src/config.js";
import { startGenericWebhookMonitor } from "./src/monitor.js";

const plugin = {
  id: "generic-webhook",
  name: "Generic Webhook",
  description: "Custom OpenClaw Generic Webhook Channel Plugin",
  configSchema: {
    kind: "generic-webhook" as const,
    zod: GenericWebhookConfigSchema,
  },
  register(api: OpenClawPluginApi) {
    // 1. Register the channel defined in channel.ts
    const channelRegistration = api.registerChannel({
      plugin: genericWebhookChannelPlugin,
      dock: genericWebhookDock,
    });

    // 2. React to configuration changes for accounts mapped to this channel.
    // In OpenClaw, channels handle config arrays (accounts) and boot them individually.
    // For simplicity in our custom webhook, we just look up the single config under "channels.generic-webhook"

    // As part of the API, we can subscribe to "contextReady" which is triggered when OpenClaw activates the channel
    api.events.on("contextReady", (context) => {
      if (context.channel.id !== "generic-webhook") return;

      const config = context.account.cfg as any;

      // 3. Start the inbound HTTP monitor
      const cleanupMonitor = startGenericWebhookMonitor({ api, context, config });

      // 4. Register the outbound adapter
      const adapter = createGenericWebhookAdapter({ context, config });
      context.registerCommandAdapter(adapter);

      // Clean up on exit
      context.onClose(() => {
        cleanupMonitor();
      });
    });
  },
};

export default plugin;
