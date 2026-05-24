import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const staff = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/staff");
const lines = fs.readFileSync(path.join(staff, "agent-mobile-config.ts"), "utf8").split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join("\n");

const parseHeader = `import {
  AGENT_MOBILE_CONFIG_SCHEMA_VERSION,
  CLIENT_FIELD_KEYS,
  type AgentMobileClientConfig,
  type AgentMobileConfigV1,
  type AgentMobileExpeditorConfig,
  type AgentMobileGpsConfig,
  type AgentMobileMiscConfig,
  type AgentMobileOrdersConfig,
  type AgentMobileOutletConfig,
  type AgentMobilePhotoConfig,
  type AgentMobileProductListConfig,
  type AgentMobileSupervisionConfig,
  type AgentMobileSyncConfig,
  type AgentMobileVanSellingConfig,
  type ClientFieldKey
} from "./agent-mobile-config.types";
`;

const validateHeader = `import {
  AGENT_MOBILE_CONFIG_SCHEMA_VERSION,
  type AgentMobileConfigV1
} from "./agent-mobile-config.types";
`;

fs.writeFileSync(path.join(staff, "agent-mobile-config.types.ts"), `${slice(1, 162)}\n`);

fs.writeFileSync(
  path.join(staff, "agent-mobile-config.parse.ts"),
  `${parseHeader}
${slice(164, 431)}
`
);

fs.writeFileSync(
  path.join(staff, "agent-mobile-config.validate.ts"),
  `${validateHeader}
${slice(433, lines.length)}
`
);

fs.writeFileSync(
  path.join(staff, "agent-mobile-config.ts"),
  `/** Agent mobile_config schema — barrel. */\nexport * from "./agent-mobile-config.types";\nexport * from "./agent-mobile-config.parse";\nexport * from "./agent-mobile-config.validate";\n`
);

console.log("phase10 agent-mobile-config split done");
