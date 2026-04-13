import type { ResolvedNodeTarget } from "../core/contracts.js";
import { ServiceError } from "../core/errors.js";
import type { SourceGateway } from "../core/interfaces.js";
import {
  MemoryCache,
  rememberInRequestCache,
} from "../infrastructure/cache.js";
import type { AppConfig } from "../infrastructure/config.js";
import { HttpClient } from "../infrastructure/httpClient.js";
import type { Logger } from "../infrastructure/logger.js";
import type { Metrics } from "../infrastructure/metrics.js";
import { WorkspaceRestCacheStore } from "../infrastructure/restCacheStore.js";
import { TokenProvider } from "../infrastructure/tokenProvider.js";
import type { WorkspaceRequestOptions } from "../core/contracts.js";
import { fetchSvgSignedUrls } from "./vectorSvgExport.js";

export class FigmaRestGateway implements SourceGateway {
  private readonly nodeCache: MemoryCache<{
    fileKey: string;
    documents: Array<{ nodeId: string; document: Record<string, unknown> }>;
  }>;
  private readonly imageCache: MemoryCache<Record<string, string>>;
  private readonly vectorCache: MemoryCache<Record<string, string>>;
  private readonly variablesCache: MemoryCache<unknown>;
  private readonly variableProbeCache: MemoryCache<boolean>;
  private readonly authenticationProbeCache: MemoryCache<boolean>;
  private readonly restCache = new WorkspaceRestCacheStore();

  constructor(
    private readonly config: AppConfig,
    private readonly httpClient: HttpClient,
    private readonly tokenProvider: TokenProvider,
    private readonly logger: Logger,
    private readonly metrics: Metrics,
  ) {
    this.nodeCache = new MemoryCache(
      config.CACHE_TTL_MS,
      config.CACHE_MAX_ENTRIES,
    );
    this.imageCache = new MemoryCache(
      config.IMAGE_CACHE_TTL_MS ?? config.CACHE_TTL_MS,
      config.CACHE_MAX_ENTRIES,
    );
    this.vectorCache = new MemoryCache(
      config.VECTOR_CACHE_TTL_MS ?? config.CACHE_TTL_MS,
      config.CACHE_MAX_ENTRIES,
    );
    this.variablesCache = new MemoryCache(
      config.VARIABLE_CACHE_TTL_MS ?? config.CACHE_TTL_MS,
      config.CACHE_MAX_ENTRIES,
    );
    this.variableProbeCache = new MemoryCache(
      config.VARIABLE_CACHE_TTL_MS ?? config.CACHE_TTL_MS,
      config.CACHE_MAX_ENTRIES,
    );
    this.authenticationProbeCache = new MemoryCache(
      config.AUTH_CACHE_TTL_MS ?? config.CACHE_TTL_MS,
      config.CACHE_MAX_ENTRIES,
    );
  }

  private defaultWorkspace(
    workspace?: WorkspaceRequestOptions,
  ): WorkspaceRequestOptions {
    return workspace ?? {
      workspaceRoot: process.cwd(),
      useCache: true,
    };
  }

  async fetchNodes(
    target: ResolvedNodeTarget,
    workspace: WorkspaceRequestOptions,
  ): Promise<{
    fileKey: string;
    documents: Array<{ nodeId: string; document: Record<string, unknown> }>;
  }> {
    const effectiveWorkspace = this.defaultWorkspace(workspace);
    const cacheKey = `nodes:${target.fileKey}:${target.nodeIds.join(",")}`;
    return await rememberInRequestCache(cacheKey, async () => {
      const memoryHit = this.nodeCache.get(cacheKey);
      if (memoryHit) {
        this.metrics.increment("figma_cache_hit_total", 1, { resource: "nodes" });
        return memoryHit;
      }
      const diskHit = effectiveWorkspace.useCache
        ? await this.restCache.readJson<{
            fileKey: string;
            documents: Array<{ nodeId: string; document: Record<string, unknown> }>;
          }>(effectiveWorkspace.workspaceRoot, "nodes", target.fileKey, cacheKey)
        : undefined;
      if (diskHit) {
        this.nodeCache.set(cacheKey, diskHit);
        this.metrics.increment("figma_cache_hit_total", 1, { resource: "nodes" });
        return diskHit;
      }
      this.metrics.increment("figma_cache_miss_total", 1, { resource: "nodes" });

      const body = await this.httpClient.getJson<{
        nodes?: Record<string, { document?: Record<string, unknown> }>;
      }>({
        path: `/v1/files/${target.fileKey}/nodes`,
        headers: {
          "X-Figma-Token": this.tokenProvider.getToken(),
        },
        query: {
          ids: target.nodeIds.join(","),
          geometry: "paths",
        },
      });

      const documents = target.nodeIds.flatMap((nodeId) => {
        const document = body.nodes?.[nodeId]?.document;
        if (!document) {
          return [];
        }
        return [{ nodeId, document }];
      });

      if (documents.length !== target.nodeIds.length) {
        throw new ServiceError({
          category: "SourceNotFoundError",
          code: "figma_node_not_found",
          stage: "fetch_snapshot",
          message: "One or more requested Figma nodes were not found.",
          suggestion: "Check the file key, node id, and Figma access permissions.",
          retryable: false,
          details: {
            expected: target.nodeIds,
            resolved: documents.map((entry) => entry.nodeId),
          },
        });
      }

      const result = {
        fileKey: target.fileKey,
        documents,
      };
      this.nodeCache.set(cacheKey, result);
      await this.restCache.writeJson(
        effectiveWorkspace.workspaceRoot,
        "nodes",
        target.fileKey,
        cacheKey,
        result,
      );
      return result;
    });
  }

  async fetchImages(
    fileKey: string,
    workspace: WorkspaceRequestOptions,
  ): Promise<Record<string, string>> {
    const effectiveWorkspace = this.defaultWorkspace(workspace);
    const cacheKey = `images:${fileKey}`;
    return await rememberInRequestCache(cacheKey, async () => {
      const cached = this.imageCache.get(cacheKey);
      if (cached) {
        this.metrics.increment("figma_cache_hit_total", 1, { resource: "images" });
        return cached;
      }
      const diskHit = effectiveWorkspace.useCache
        ? await this.restCache.readJson<Record<string, string>>(
            effectiveWorkspace.workspaceRoot,
            "images",
            fileKey,
            cacheKey,
          )
        : undefined;
      if (diskHit) {
        this.imageCache.set(cacheKey, diskHit);
        this.metrics.increment("figma_cache_hit_total", 1, { resource: "images" });
        return diskHit;
      }
      this.metrics.increment("figma_cache_miss_total", 1, { resource: "images" });

      const body = await this.httpClient.getJson<{
        meta?: {
          images?: Record<string, string>;
        };
        images?: Record<string, string>;
      }>({
        path: `/v1/files/${fileKey}/images`,
        headers: {
          "X-Figma-Token": this.tokenProvider.getToken(),
        },
      });

      const images = body.meta?.images ?? body.images ?? {};
      this.imageCache.set(cacheKey, images);
      await this.restCache.writeJson(
        effectiveWorkspace.workspaceRoot,
        "images",
        fileKey,
        cacheKey,
        images,
      );
      return images;
    });
  }

  async fetchVectors(
    fileKey: string,
    ids: string[],
    workspace: WorkspaceRequestOptions,
  ): Promise<Record<string, string>> {
    const effectiveWorkspace = this.defaultWorkspace(workspace);
    if (ids.length === 0) {
      return {};
    }

    const cacheKey = `vectors:${fileKey}:${ids.join(",")}`;
    return await rememberInRequestCache(cacheKey, async () => {
      const cached = this.vectorCache.get(cacheKey);
      if (cached) {
        this.metrics.increment("figma_cache_hit_total", 1, { resource: "vectors" });
        return cached;
      }
      const diskHit = effectiveWorkspace.useCache
        ? await this.restCache.readJson<Record<string, string>>(
            effectiveWorkspace.workspaceRoot,
            "vectors",
            fileKey,
            cacheKey,
          )
        : undefined;
      if (diskHit) {
        this.vectorCache.set(cacheKey, diskHit);
        this.metrics.increment("figma_cache_hit_total", 1, { resource: "vectors" });
        return diskHit;
      }
      this.metrics.increment("figma_cache_miss_total", 1, { resource: "vectors" });

      const signedUrls = await fetchSvgSignedUrls({
        fileKey,
        ids,
        token: this.tokenProvider.getToken(),
        httpClient: this.httpClient,
        logger: this.logger,
        flow: "fetchVectors",
      });
      const vectors = Object.fromEntries(
        await Promise.all(
          Object.entries(signedUrls).map(async ([nodeId, signedUrl]) => [
            nodeId,
            await this.httpClient.getText({
              url: signedUrl,
            }),
          ]),
        ),
      );
      this.vectorCache.set(cacheKey, vectors);
      await this.restCache.writeJson(
        effectiveWorkspace.workspaceRoot,
        "vectors",
        fileKey,
        cacheKey,
        vectors,
      );
      return vectors;
    });
  }

  async fetchVariables(
    fileKey: string,
    workspace: WorkspaceRequestOptions,
  ): Promise<unknown | undefined> {
    const effectiveWorkspace = this.defaultWorkspace(workspace);
    if (!this.config.ENABLE_VARIABLES) {
      return undefined;
    }

    const cacheKey = `variables:${fileKey}`;
    return await rememberInRequestCache(cacheKey, async () => {
      const cached = this.variablesCache.get(cacheKey);
      if (cached !== undefined) {
        this.metrics.increment("figma_cache_hit_total", 1, { resource: "variables" });
        return cached;
      }
      const diskHit = effectiveWorkspace.useCache
        ? await this.restCache.readJson<unknown>(
            effectiveWorkspace.workspaceRoot,
            "variables",
            fileKey,
            cacheKey,
          )
        : undefined;
      if (diskHit !== undefined) {
        this.variablesCache.set(cacheKey, diskHit);
        this.metrics.increment("figma_cache_hit_total", 1, { resource: "variables" });
        return diskHit;
      }
      this.metrics.increment("figma_cache_miss_total", 1, { resource: "variables" });

      try {
        const variables = await this.httpClient.getJson<unknown>({
          path: `/v1/files/${fileKey}/variables/local`,
          headers: {
            "X-Figma-Token": this.tokenProvider.getToken(),
          },
        });
        this.variablesCache.set(cacheKey, variables);
        await this.restCache.writeJson(
          effectiveWorkspace.workspaceRoot,
          "variables",
          fileKey,
          cacheKey,
          variables,
        );
        return variables;
      } catch (error) {
        this.logger.warn("Variables fetch failed; continuing with degraded support", {
          fileKey,
          error: error instanceof Error ? error.message : String(error),
        });
        this.metrics.increment("figma_variables_fetch_failed");
        return undefined;
      }
    });
  }

  async probeVariables(
    fileKey?: string,
    workspace?: WorkspaceRequestOptions,
  ): Promise<boolean> {
    if (!this.config.ENABLE_VARIABLES || !fileKey) {
      return false;
    }

    const cacheKey = `variables-probe:${fileKey}`;
    const cached = this.variableProbeCache.get(cacheKey);
    if (cached !== undefined) {
      this.metrics.increment("figma_cache_hit_total", 1, { resource: "variable_probe" });
      return cached;
    }
    this.metrics.increment("figma_cache_miss_total", 1, { resource: "variable_probe" });

    const variables = await this.fetchVariables(fileKey, workspace ?? {
      workspaceRoot: process.cwd(),
      useCache: true,
    });
    const supported = variables !== undefined;
    this.variableProbeCache.set(cacheKey, supported);
    return supported;
  }

  async probeAuthentication(): Promise<boolean> {
    const cacheKey = "authentication-probe";
    return await rememberInRequestCache(cacheKey, async () => {
      const cached = this.authenticationProbeCache.get(cacheKey);
      if (cached !== undefined) {
        this.metrics.increment("figma_cache_hit_total", 1, { resource: "auth_probe" });
        return cached;
      }
      this.metrics.increment("figma_cache_miss_total", 1, { resource: "auth_probe" });

      if (!this.tokenProvider.hasToken()) {
        this.authenticationProbeCache.set(cacheKey, false);
        return false;
      }

      try {
        await this.httpClient.getJson<Record<string, unknown>>({
          path: "/v1/me",
          headers: {
            "X-Figma-Token": this.tokenProvider.getToken(),
          },
        });
        this.authenticationProbeCache.set(cacheKey, true);
        return true;
      } catch (error) {
        if (error instanceof ServiceError) {
          const authenticated =
            error.category !== "AuthenticationError" &&
            error.category !== "AuthorizationError";
          this.authenticationProbeCache.set(cacheKey, authenticated);
          return authenticated;
        }

        return true;
      }
    });
  }
}
