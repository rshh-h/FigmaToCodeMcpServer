import type { Framework, PluginSettings } from "./pluginTypes.js";

export interface KernelSourceSnapshot {
  fileKey: string;
  targetNodeIds: string[];
  sourceNodes: Array<{
    nodeId: string;
    document: Record<string, unknown>;
  }>;
  imageRefs: string[];
  imageUrls: Record<string, string>;
  localImagePaths?: Record<string, string>;
  vectorCandidates: Array<{
    id: string;
    name?: string;
    depth: number;
    reason?: string;
  }>;
  vectorUrls: Record<string, string>;
  localVectorPaths?: Record<string, string>;
  localVectorRootMappings?: Array<{
    rootNodeId: string;
    childNodeIds: string[];
    path: string;
  }>;
  variablesRaw?: unknown;
  metadata: {
    fetchedAt: string;
    requestCount: number;
  };
}

export interface KernelSettings extends PluginSettings {}

export interface KernelWarningSink {
  warn(message: string): void;
}

export interface KernelArtifact {
  framework: Framework;
  code: string;
}
