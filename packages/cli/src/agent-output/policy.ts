export type AgentOutputPolicy = {
  maxServices: number;
  maxIssues: number;
  maxEvidence: number;
  includeHealthyServices: "always" | "summary" | "only-if-small";
  includeTimestamps: boolean;
  includePaths: boolean;
  includeCommands: boolean;
  includeNormalLogs: boolean;
};

export const defaultAgentStatusPolicy: AgentOutputPolicy = {
  maxServices: 8,
  maxIssues: 5,
  maxEvidence: 0,
  includeHealthyServices: "only-if-small",
  includeTimestamps: false,
  includePaths: false,
  includeCommands: false,
  includeNormalLogs: false,
};

export const defaultAgentSnapshotPolicy: AgentOutputPolicy = {
  maxServices: 8,
  maxIssues: 5,
  maxEvidence: 8,
  includeHealthyServices: "summary",
  includeTimestamps: false,
  includePaths: false,
  includeCommands: false,
  includeNormalLogs: false,
};

export const defaultAgentLogsPolicy: AgentOutputPolicy = {
  maxServices: 4,
  maxIssues: 5,
  maxEvidence: 8,
  includeHealthyServices: "summary",
  includeTimestamps: false,
  includePaths: false,
  includeCommands: false,
  includeNormalLogs: false,
};
