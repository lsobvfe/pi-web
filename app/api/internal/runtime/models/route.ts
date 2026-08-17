import { stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { createAgentSessionServices, getAgentDir, type SettingsManager } from "@earendil-works/pi-coding-agent";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { managedWorkspaceRoot } from "@/lib/managed-mode";
import { resolveVisibleModels, selectInitialModelScope } from "@/lib/model-scope";
import { projectTrustReloadOptions } from "@/lib/project-trust";

export async function GET() {
  try {
    const cwd = managedWorkspaceRoot();
    if (!(await stat(cwd)).isDirectory()) {
      return NextResponse.json({ error: "PI_RUNTIME_WORKSPACE_INVALID" }, { status: 500 });
    }
    const agentDir = getAgentDir();
    const trustReloadOptions = projectTrustReloadOptions(cwd, agentDir);
    const services = await createAgentSessionServices({
      cwd,
      agentDir,
      ...(trustReloadOptions ? { resourceLoaderReloadOptions: trustReloadOptions } : {}),
    });
    const settings: SettingsManager = services.settingsManager;
    const scope = await resolveVisibleModels(
      services.modelRuntime,
      settings.getEnabledModels(),
    );
    const models = Object.fromEntries(scope.visible.map((model) => [
      `${model.provider}:${model.id}`,
      model.name,
    ]));
    const modelList = scope.visible.map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      api: model.api,
      baseUrl: model.baseUrl,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      input: model.input,
      reasoning: model.reasoning,
      cost: model.cost,
      headers: model.headers,
      compat: model.compat,
      thinkingLevelMap: model.thinkingLevelMap,
      enabled: true,
    }));
    const selected = selectInitialModelScope(scope, {
      ...(settings.getDefaultProvider() && settings.getDefaultModel()
        ? {
            defaultModel: {
              provider: settings.getDefaultProvider()!,
              modelId: settings.getDefaultModel()!,
            },
          }
        : {}),
    });
    return NextResponse.json({
      models,
      modelList,
      configuredModelList: modelList,
      defaultModel: selected.model
        ? { provider: selected.model.provider, modelId: selected.model.id }
        : null,
      thinkingLevels: Object.fromEntries(scope.visible.map((model) => [
        `${model.provider}:${model.id}`,
        getSupportedThinkingLevels(model),
      ])),
      thinkingLevelMaps: Object.fromEntries(scope.visible
        .filter((model) => Boolean(model.thinkingLevelMap))
        .map((model) => [`${model.provider}:${model.id}`, model.thinkingLevelMap])),
    });
  } catch (error) {
    console.error("[pi-web] failed to load managed runtime models", error);
    return NextResponse.json({ error: "PI_RUNTIME_MODELS_FAILED" }, { status: 500 });
  }
}
