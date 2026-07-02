import { resolveIntegrationState } from "@kip/integrations";
import { supabaseMemorySchema } from "@kip/memory";
import { classifyVoiceCommand } from "@kip/voice";
import express, { type Request, type Response } from "express";
import { z } from "zod";
import { getWorkspace, workspaces } from "./workspaces";

const workspaceKeySchema = z.enum(["haulbrokr", "merchnow", "gwfg", "stratus", "personal"]);
const classifyVoiceCommandSchema = z.object({
  utterance: z.string().trim().min(1),
  fallbackWorkspace: workspaceKeySchema.default("personal")
});

export function createKipApi(environment: Record<string, string | undefined> = process.env) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request: Request, response: Response) => {
    response.json({
      ok: true,
      service: "kip-api",
      workspaces: workspaces.length,
      agents: workspaces.reduce((total, workspace) => total + workspace.agents.length, 0)
    });
  });

  app.get("/workspaces", (_request: Request, response: Response) => {
    response.json({
      data: workspaces.map((workspace) => ({
        key: workspace.key,
        name: workspace.name,
        mission: workspace.mission,
        agents: workspace.agents.length,
        tasks: workspace.tasks.length,
        documents: workspace.documents.length,
        integrations: workspace.integrations.length,
        dashboards: workspace.dashboards.length,
        permissionGroups: workspace.permissions.length
      }))
    });
  });

  app.get("/workspaces/:workspace", (request: Request, response: Response) => {
    const parsed = workspaceKeySchema.safeParse(request.params.workspace);

    if (!parsed.success) {
      response.status(404).json({ error: "Workspace not found." });
      return;
    }

    response.json({ data: getWorkspace(parsed.data) });
  });

  app.get("/workspaces/:workspace/integrations", (request: Request, response: Response) => {
    const parsed = workspaceKeySchema.safeParse(request.params.workspace);

    if (!parsed.success) {
      response.status(404).json({ error: "Workspace not found." });
      return;
    }

    response.json({ data: resolveIntegrationState(parsed.data, environment) });
  });

  app.get("/memory/schema", (_request: Request, response: Response) => {
    response.type("text/plain").send(supabaseMemorySchema);
  });

  app.post("/voice/commands/classify", (request: Request, response: Response) => {
    const parsed = classifyVoiceCommandSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({ error: "Invalid voice command payload.", issues: parsed.error.issues });
      return;
    }

    response.json({
      data: classifyVoiceCommand(parsed.data.utterance, parsed.data.fallbackWorkspace)
    });
  });

  return app;
}
