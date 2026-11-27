import { pathToFileURL } from 'url';
import { net, protocol } from 'electron';
import { APP_HOST, APP_ORIGIN, APP_SCHEME, resolveRendererFile } from './protocolResolver';

export { APP_HOST, APP_ORIGIN, APP_SCHEME, resolveRendererFile };

export function registerAppProtocol(rendererRoot: string): void {
  protocol.handle(APP_SCHEME, (request) => {
    const filePath = resolveRendererFile(rendererRoot, request.url);
    if (!filePath) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}
