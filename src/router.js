export function createRouter({ routes, fallback, onRoute }) {
  function resolve() {
    let hash = window.location.hash || fallback;

    if (!routes[hash]) {
      hash = fallback;
    }

    if (window.location.hash !== hash) {
      window.location.hash = hash;
      return;
    }

    onRoute(hash);
  }

  function handleHashChange() {
    resolve();
  }

  return {
    start() {
      if (!window.location.hash) {
        window.history.replaceState(null, '', fallback);
      }
      resolve();
      window.addEventListener('hashchange', handleHashChange);
    },

    navigate(hash) {
      if (window.location.hash === hash) {
        resolve();
        return;
      }
      window.location.hash = hash;
    },

    destroy() {
      window.removeEventListener('hashchange', handleHashChange);
    },
  };
}
