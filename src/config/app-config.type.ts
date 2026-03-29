export type AppConfig = {
  nodeEnv: string;
  name: string;
  workingDirectory: string;
  frontendDomain?: string;
  backendDomain: string;
  port: number;
  apiPrefix: string;
  fallbackLanguage: string;
  headerLanguage: string;
  /** When false, do not send logs to Better Stack even if a source token is set. */
  betterStackEnabled: boolean;
  betterStackSourceToken?: string;
  betterStackEndpoint?: string;
};
