import type { AssetMaterializer } from "../../core/interfaces.js";

export class NoopAssetMaterializer implements AssetMaterializer {
  async materialize({ snapshot }: Parameters<AssetMaterializer["materialize"]>[0]) {
    return snapshot;
  }
}
