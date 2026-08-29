declare module 'mssql' {
  export interface Config {
    server: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    options?: {
      trustServerCertificate?: boolean;
      encrypt?: boolean;
    };
    pool?: {
      max?: number;
    };
    connectionTimeout?: number;
    requestTimeout?: number;
  }

  export interface IRequest {
    query<T>(command: string): Promise<{ recordset: T[] }>;
  }

  export interface IConnectionPool {
    close(): Promise<void>;
    request(): IRequest;
  }

  export function connect(config: Config): Promise<IConnectionPool>;
}
