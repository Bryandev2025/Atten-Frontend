const routes = new Map();

export function registerRoute(path, render) {
  routes.set(path, render);
}

export function go(path) {
  location.hash = path;
}

export function startRouter() {
  const run = () => {
    const hash = location.hash.replace("#", "") || "/login";
    const render = routes.get(hash) || routes.get("/404");
    render();
  };
  window.addEventListener("hashchange", run);
  run();
}
