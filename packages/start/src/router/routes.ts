import { addRoute, createRouter, findRoute } from "rou3";
import fileRoutes from "vinxi/routes";

interface Route {
  path: string;
  id: string;
  children?: Route[];
  page?: boolean;
  $component?: any;
  $GET?: any;
  $POST?: any;
  $PUT?: any;
  $PATCH?: any;
  $DELETE?: any;
}

interface RouteData {
  [key: `$${string}`]: any
}

declare module "vinxi/routes" {
  export interface Register {
    route: {
      path: string;
      children?: Route[];
    };
  }
}

export const pageRoutes = defineRoutes(
  (fileRoutes as unknown as Route[]).filter(o => o.page)
);

function defineRoutes(fileRoutes: Route[]) {
  function processRoute(routes: Route[], route: Route, id: string, full: string) {
    const parentRoute = Object.values(routes).find(o => {
      return id.startsWith(o.id + "/");
    });

    if (!parentRoute) {
      routes.push({ ...route, id, path: id.replace(/\/\([^)/]+\)/g, "").replace(/\([^)/]+\)/g, "") });
      return routes;
    }
    processRoute(
      parentRoute.children || (parentRoute.children = []),
      route,
      id.slice(parentRoute.id.length),
      full
    );

    return routes;
  }

  return fileRoutes
    .sort((a, b) => a.path.length - b.path.length)
    .reduce((prevRoutes: Route[], route) => {
      return processRoute(prevRoutes, route, route.path, route.path);
    }, []);
}

export function matchAPIRoute(path: string, method: string) {
  const match = findRoute(router, method, path);
  if (match && match.data) {
    const data = match.data as RouteData;
    const handler = data[`$${method}` as keyof RouteData];
    if (handler === undefined) return;
    return {
      handler,
      params: match.params
    };
  }
}

function containsHTTP(route: Route) {
  return route["$GET"] || route["$POST"] || route["$PUT"] || route["$PATCH"] || route["$DELETE"];
}

const router = createRouter();
(fileRoutes as unknown as Route[]).forEach((route) => {
  if (containsHTTP(route)) {
    let path = route.path
      .replace(/\/\([^)/]+\)/g, "")
      .replace(/\([^)/]+\)/g, "")
      .replace(/\*([^/]*)/g, (_, m) => `**:${m}`)
      .split('/')
      .map(s => (s.startsWith(':') || s.startsWith('*')) ? s : encodeURIComponent(s))
      .join('/');

    if (/:[^/]*\?/g.test(path)) {
      throw new Error(`Optional parameters are not supported in API routes: ${path}`);
    }

    // todo: duplicate check.
    

    if (route.$GET) addRoute(router, "GET", path, { route });
    if (route.$POST) addRoute(router, "POST", path, { route });
    if (route.$PUT) addRoute(router, "PUT", path, { route });
    if (route.$PATCH) addRoute(router, "PATCH", path, { route });
    if (route.$DELETE) addRoute(router, "DELETE", path, { route });
  }
});