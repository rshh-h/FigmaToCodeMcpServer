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
        message: "The service is not configured with FIGMA_ACCESS_TOKEN.",
        suggestion: "Set FIGMA_ACCESS_TOKEN in the server environment before starting the MCP server.",
        retryable: false,
      });
    }

    return this.config.FIGMA_ACCESS_TOKEN;
  }
}
