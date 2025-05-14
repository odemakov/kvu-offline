import { IncomingMessage, ServerResponse } from 'http';

export interface MiddlewareRequest extends IncomingMessage {
  json(): Promise<any>;
  text(): Promise<string>;
  formData(): Promise<Record<string, any>>;
}

export interface MiddlewareResponse extends ServerResponse {
  json(data: any): MiddlewareResponse;
  text(data: string): MiddlewareResponse;
  html(data: string): MiddlewareResponse;
}

export interface MiddlewareOptions {
  name: string;
  handler: (req: MiddlewareRequest, res: MiddlewareResponse) => Promise<void | undefined>;
}

export function defineMiddleware(options: MiddlewareOptions): any {
  // Extend request with additional methods
  const enhanceRequest = (req: IncomingMessage): MiddlewareRequest => {
    const enhancedReq = req as MiddlewareRequest;
    
    enhancedReq.json = async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const body = Buffer.concat(chunks).toString('utf8');
      return JSON.parse(body);
    };
    
    enhancedReq.text = async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      return Buffer.concat(chunks).toString('utf8');
    };
    
    enhancedReq.formData = async () => {
      const text = await enhancedReq.text();
      const result: Record<string, any> = {};
      new URLSearchParams(text).forEach((value, key) => {
        result[key] = value;
      });
      return result;
    };
    
    return enhancedReq;
  };
  
  // Extend response with additional methods
  const enhanceResponse = (res: ServerResponse): MiddlewareResponse => {
    const enhancedRes = res as MiddlewareResponse;
    
    enhancedRes.json = (data: any) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return enhancedRes;
    };
    
    enhancedRes.text = (data: string) => {
      res.setHeader('Content-Type', 'text/plain');
      res.end(data);
      return enhancedRes;
    };
    
    enhancedRes.html = (data: string) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(data);
      return enhancedRes;
    };
    
    return enhancedRes;
  };
  
  return {
    name: options.name,
    configureServer(server: any) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        try {
          const enhancedReq = enhanceRequest(req);
          const enhancedRes = enhanceResponse(res);
          
          const result = await options.handler(enhancedReq, enhancedRes);
          
          if (result === undefined) {
            next();
          }
        } catch (error) {
          console.error(`Error in ${options.name} middleware:`, error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      });
    }
  };
}