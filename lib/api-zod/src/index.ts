// Zod schemas for runtime validation. OpenAPI TS types are at @workspace/api-zod/types.
export * from "./generated/api";

// Resolve TS2308: these names exist both as generated TS types and as zod
// schema consts. Explicitly re-export the zod schema (const) version.
export {
  ConnectQuickBooksBody,
  CreateBinOrderBody,
  CreateDriverEventBody,
  CreateDriverWorkflowTransitionBody,
  CreateFactoringRequestBody,
  CreateJobEvidenceBody,
  CreateProjectBody,
  UpdateProjectBody,
  UpsertDriverDocBody,
  VerifyTicketQrBody,
} from "./generated/api";
export * from './generated/types';
