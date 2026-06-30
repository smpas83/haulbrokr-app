import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(root, "lib", "api-zod", "src", "index.ts");

writeFileSync(
  indexPath,
  `// Zod schemas for runtime validation. OpenAPI TS types are at @workspace/api-zod/types.
export * from "./generated/api";

// Resolve TS2308: these names exist both as generated TS types and as zod
// schema consts. Explicitly re-export the zod schema (const) version.
export {
  ConnectQuickBooksBody,
  CreateBinOrderBody,
  CreateFactoringRequestBody,
  CreateJobEvidenceBody,
  CreateProjectBody,
  UpdateProjectBody,
  UpsertDriverDocBody,
  VerifyTicketQrBody,
} from "./generated/api";
`,
);
