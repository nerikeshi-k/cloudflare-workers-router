import { createPathTestFragments, resolveDynamicPath } from './parser';
import {
  DynamicRoute,
  Handler,
  Method,
  METHODS,
  METHOD_ANY,
  StaticHandler,
  StaticRoute,
} from './types';

const DYNAMIC_ROUTE_TREE_KEY_END = '\0';
const DYNAMIC_ROUTE_TREE_KEY_WILDCARD = ':';
const DYNAMIC_ROUTE_TREE_KEY_IGNORE_AFTER = '*';
type DynamicRouteTree = Map<string, DynamicRouteTree | DynamicRoute>;
function isDynamicRouteTreeEnd(
  value: DynamicRouteTree | DynamicRoute
): value is DynamicRoute {
  return !(value instanceof Map);
}
function assertIsDynamicRouteTreeEnd(
  value: DynamicRouteTree | DynamicRoute
): asserts value is DynamicRoute {
  if (!isDynamicRouteTreeEnd(value)) {
    throw new Error('Implementation Error');
  }
}

export class Router {
  private staticRoutes: Map<string, StaticRoute> = new Map();
  private dynamicRouteTree: DynamicRouteTree = new Map(
    METHODS.map((method) => [method, new Map()])
  );
  private fallbackHandler: StaticHandler | null;

  constructor(options: { fallback?: StaticHandler } = {}) {
    this.fallbackHandler = options.fallback ?? null;
  }

  private createStaticRouteMapKey(method: string, path: string): string {
    return `${method.toLowerCase()}::${path}`;
  }

  private checkIsAppendingPathValid(path: string) {
    return /^\/(?:\:?[0-9a-zA-Z_\-.~]+\/?)*\*?$/.test(path);
  }

  private findDynamicRoute(method: string, path: string): DynamicRoute | null {
    const fragments = [
      method.toLowerCase(),
      ...path.split('/'),
      DYNAMIC_ROUTE_TREE_KEY_END,
    ];
    const fallbackAny = () =>
      method !== METHOD_ANY ? this.findDynamicRoute(METHOD_ANY, path) : null;
    let cursor = this.dynamicRouteTree;
    for (let fragment of fragments) {
      const next =
        cursor.get(fragment) ?? cursor.get(DYNAMIC_ROUTE_TREE_KEY_WILDCARD);
      if (next == null) {
        const ignoreAfterRoute = cursor.get(
          DYNAMIC_ROUTE_TREE_KEY_IGNORE_AFTER
        );
        if (ignoreAfterRoute != null) {
          assertIsDynamicRouteTreeEnd(ignoreAfterRoute);
          return ignoreAfterRoute;
        }
        return fallbackAny();
      }
      if (isDynamicRouteTreeEnd(next)) {
        return next;
      }
      cursor = next;
    }
    return fallbackAny();
  }

  private appendRoute(method: Method, path: string, handler: Handler) {
    if (!this.checkIsAppendingPathValid(path)) {
      throw new Error(`can not append path "${path}"`);
    }
    const isDynamic = /[:\*]/.test(path);
    if (isDynamic) {
      this.appendDynamicRoute(method, path, handler);
    } else {
      const key = this.createStaticRouteMapKey(method, path);
      if (this.staticRoutes.has(key)) {
        throw new Error(`static path config duplicated ${path}`);
      }
      this.staticRoutes.set(this.createStaticRouteMapKey(method, path), {
        method,
        path,
        handler: handler as StaticHandler,
      });
    }
  }

  private appendDynamicRoute(method: Method, path: string, handler: Handler) {
    const fragments = [
      method.toLowerCase(),
      ...path.split('/').map((f) => {
        if (f === DYNAMIC_ROUTE_TREE_KEY_IGNORE_AFTER) {
          return DYNAMIC_ROUTE_TREE_KEY_IGNORE_AFTER;
        }
        if (f.startsWith(':')) {
          return DYNAMIC_ROUTE_TREE_KEY_WILDCARD;
        }
        return f;
      }),
      DYNAMIC_ROUTE_TREE_KEY_END,
    ];
    let cursor = this.dynamicRouteTree;
    for (let fragment of fragments) {
      if (
        fragment === DYNAMIC_ROUTE_TREE_KEY_IGNORE_AFTER ||
        fragment === DYNAMIC_ROUTE_TREE_KEY_END
      ) {
        if (cursor.get(fragment) != null) {
          throw new Error(`dynamic path config duplicated ${path}`);
        }
        cursor.set(fragment, {
          method,
          rawPath: path,
          tests: createPathTestFragments(path),
          handler,
        });
      } else {
        const next = cursor.get(fragment) ?? new Map();
        if (isDynamicRouteTreeEnd(next)) {
          throw new Error('Implementation Error');
        }
        cursor.set(fragment, next);
        cursor = next;
      }
    }
  }

  private async resolveRequest(request: Request): Promise<Response> {
    const { method } = request;
    const { pathname } = new URL(request.url);
    // try to resolve as static path
    {
      const route =
        this.staticRoutes.get(this.createStaticRouteMapKey(method, pathname)) ??
        this.staticRoutes.get(
          this.createStaticRouteMapKey(METHOD_ANY, pathname)
        );
      if (route != null) {
        return route.handler(request);
      }
    }
    // if path is not resolved as static path,
    // try to resolve it as dynamic path
    {
      const route = this.findDynamicRoute(method, pathname);
      if (route != null) {
        const params = resolveDynamicPath(pathname, route.tests);
        if (params != null) {
          return route.handler(request, params);
        }
      }
    }

    // no matches
    if (this.fallbackHandler != null) {
      return this.fallbackHandler(request);
    }
    return new Response('no content', {
      status: 404,
      statusText: 'content not found',
    });
  }

  get(path: string, handler: Handler) {
    return this.appendRoute('get', path, handler);
  }

  post(path: string, handler: Handler) {
    return this.appendRoute('post', path, handler);
  }
  patch(path: string, handler: Handler) {
    return this.appendRoute('patch', path, handler);
  }

  delete(path: string, handler: Handler) {
    return this.appendRoute('delete', path, handler);
  }

  option(path: string, handler: Handler) {
    return this.appendRoute('option', path, handler);
  }

  head(path: string, handler: Handler) {
    return this.appendRoute('head', path, handler);
  }

  trace(path: string, handler: Handler) {
    return this.appendRoute('trace', path, handler);
  }

  any(path: string, handler: Handler) {
    return this.appendRoute(METHOD_ANY, path, handler);
  }

  async handle(request: Request): Promise<Response> {
    return this.resolveRequest(request);
  }
}
