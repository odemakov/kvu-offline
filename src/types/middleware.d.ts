declare module '@vufold/middleware' {
  import { IncomingMessage, ServerResponse } from 'http';

  interface MiddlewareRequest extends IncomingMessage {
    json(): Promise<any>;
    text(): Promise<string>;
    formData(): Promise<Record<string, any>>;
  }

  interface MiddlewareResponse extends ServerResponse {
    json(data: any): MiddlewareResponse;
    text(data: string): MiddlewareResponse;
    html(data: string): MiddlewareResponse;
  }

  interface MiddlewareOptions {
    name: string;
    handler: (req: MiddlewareRequest, res: MiddlewareResponse) => Promise<void | undefined>;
  }

  export function defineMiddleware(options: MiddlewareOptions): any;
}