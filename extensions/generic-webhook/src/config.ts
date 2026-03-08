import type { ChannelConfigSchema } from "openclaw/plugin-sdk/core";
import { z } from "zod";

export const GenericWebhookConfigSchema = z.object({
  inboundToken: z.string().min(1, "Inbound token must be provided to secure the webhook endpoint."),
  outboundUrl: z.string().url("Must be a valid URL for outbound webhook delivery."),
  outboundToken: z.string().optional(),
});

export type GenericWebhookConfig = z.infer<typeof GenericWebhookConfigSchema>;

export const GenericWebhookConfigSchemaWrapper: ChannelConfigSchema<GenericWebhookConfig> = {
  kind: "generic-webhook",
  zod: GenericWebhookConfigSchema,
};
