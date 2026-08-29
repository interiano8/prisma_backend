declare module 'pg' {
  export interface PoolClient {
    query(text: string): Promise<void>;
  }
  export interface PoolConfig {
    connectionString?: string;
    idleTimeoutMillis?: number;
    max?: number;
    onConnect?: (client: PoolClient) => void;
  }
  export class Pool {
    constructor(config?: PoolConfig);
    end(): Promise<void>;
  }
}
