const routes = new Map();

export function registerRoute(path, render) {
  routes.set(path, render);
}

export function go(path) {
  location.hash = path;
}

export function startRouter() {
  const run = () => {
    const raw = location.hash.replace("#", "") || "/login";
    const [pathPart, queryPart = ""] = raw.split("?");
    const render = routes.get(pathPart) || routes.get("/404");
    const query = Object.fromEntries(new URLSearchParams(queryPart).entries());
    render({ path: pathPart, query, raw });
  };
  window.addEventListener("hashchange", run);
  run();
}
