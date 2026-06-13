import { ServiceError } from "../core/errors.js";
import type { AppConfig } from "./config.js";

export class TokenProvider {
  constructor(private readonly config: AppConfig) {}

  hasToken(): boolean {
    return Boolean(this.config.FIGMA_ACCESS_TOKEN);
  }

  getToken(): string {
    if (!this.config.FIGMA_ACCESS_TOKEN) {
      throw new ServiceError({
        category: "AuthenticationError",
        code: "missing_figma_access_token",
        stage: "fetch_snapshot",
        message: "FIGMA_ACCESS_TOKEN is not configured. Cannot call Figma API without a token.",
        suggestion:
          "Add FIGMA_ACCESS_TOKEN to the MCP server env configuration, then retry the request.",
        retryable: true,
      });
    }

    return this.config.FIGMA_ACCESS_TOKEN;
  }
}
