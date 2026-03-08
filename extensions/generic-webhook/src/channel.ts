import type {
  ChannelDock,
  ChannelPlugin,
  ChannelGatewayContext,
  OpenClawPluginApi,
} from "openclaw/plugin-sdk/core";
import {
  buildChannelConfigSchema,
  resolveDirectDmAuthorizationOutcome,
} from "openclaw/plugin-sdk/core";
import { createGenericWebhookAdapter } from "./adapter.js";
import { GenericWebhookConfigSchema, type GenericWebhookConfig } from "./config.js";
import { startGenericWebhookMonitor } from "./monitor.js";

// Since it's a generic singleton webhook, we don't have true "multiple accounts" in the traditional sense.
// We treat the top-level config as the only account.
type ResolvedWebhookAccount = {
  id: "default";
  cfg: GenericWebhookConfig;
};

export const genericWebhookDock: ChannelDock = {
  id: "generic-webhook",
  capabilities: {
    chatTypes: ["direct"], // Treat all as direct for simplicity
    reactions: false,
    media: true,
    threads: true,
    blockStreaming: true,
  },
  outbound: { textChunkLimit: 4000 },
  config: {
    resolveAllowFrom: ({ cfg }) => {
      // Default to open for webhook (trusting the inboundToken)
      return { policy: "open" };
    },
    formatAllowFrom: () => "open",
  },
  groups: {
    resolveRequireMention: () => "all",
  },
  threading: {
    resolveReplyToMode: () => "quote",
    buildToolContext: ({ context }) => context,
  },
};

export const genericWebhookChannelPlugin: ChannelPlugin<ResolvedWebhookAccount> = {
  id: "generic-webhook",
  meta: {
    id: "generic-webhook",
    label: "Generic Webhook",
    selectionLabel: "Generic HTTP Webhook",
    detailLabel: "Generic Webhook",
    docsLabel: "generic",
    docsPath: "/channels/generic",
    blurb: "A flexible, generic HTTP webhook channel.",
    aliases: ["webhook"],
    order: 99,
  },
  capabilities: {
    chatTypes: ["direct"],
    reactions: false,
    threads: true,
    media: true,
    nativeCommands: false,
    blockStreaming: true,
  },
  streaming: {
    blockStreamingCoalesceDefaults: { minChars: 1000, idleMs: 1500 },
  },
  reload: { configPrefixes: ["channels.generic-webhook"] },
  configSchema: buildChannelConfigSchema(GenericWebhookConfigSchema),

  config: {
    listAccountIds: () => ["default"],
    resolveAccount: (cfg: unknown) => {
      // Coerce the raw config to our typed config
      const parsed = GenericWebhookConfigSchema.safeParse(cfg);
      if (!parsed.success) return undefined;
      return { id: "default", cfg: parsed.data };
    },
    defaultAccountId: () => "default",
    setAccountEnabled: () => {},
    deleteAccount: () => undefined,
    isConfigured: (account) => !!account?.cfg?.outboundUrl && !!account?.cfg?.inboundToken,
    describeAccount: () => ({ enabled: true, identifier: "Generic Webhook" }),
    resolveAllowFrom: () => ({ policy: "open" }),
    formatAllowFrom: () => "open",
    resolveDefaultTo: () => null,
  },
  security: {
    resolveDmPolicy: () => ({
      ...resolveDirectDmAuthorizationOutcome("require-allowlist"),
      warnings: [],
    }),
    collectWarnings: () => [],
  },
  groups: {
    resolveRequireMention: () => "all",
  },
  threading: {
    resolveReplyToMode: () => "quote",
  },
  messaging: {
    normalizeTarget: (t) => t.trim(),
    targetResolver: {
      looksLikeId: () => true,
      hint: "<identifier>",
    },
  },
  directory: {
    self: () => undefined,
    listPeers: async () => ({ results: [], nextCursor: null }),
    listGroups: async () => ({ results: [], nextCursor: null }),
  },
  resolver: {
    resolveTargets: async ({ inputs }) => {
      return inputs.map((input) => ({
        original: input,
        resolved: { kind: "peer", id: input, display: input, normalized: input },
      }));
    },
  },

  setup: {
    async configureAccounts() {
      // Configuration via UI/interactive CLI setup omitted for this scaffold
      return [];
    },
    async configureChannelDefaults() {},
  },
};
