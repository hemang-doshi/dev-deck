export type LogSeverity = "info" | "warning" | "error";
export type LogStream = "stdout" | "stderr";

export type LogEvent = {
  id: number;
  service: string;
  line: string;
  isStackTrace: boolean;
  ports: number[];
  severity: LogSeverity;
  stream: LogStream;
  timestamp: string;
  urls: string[];
};
