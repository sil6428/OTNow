(() => {
  const allowedPaths = [
    /^\/api\/v1\/planner\/items(?:\?|$)/,
    /^\/api\/v1\/courses(?:\?|$)/,
  ];

  function allowed(path) {
    return !path.includes("..") && allowedPaths.some((pattern) => pattern.test(path));
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "canvas:fetch") return false;
    const path = String(message.path || "");
    if (!allowed(path)) {
      sendResponse({ status: 0, error: "Canvas path not allowed" });
      return false;
    }

    (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch(`${location.origin}${path}`, {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
        const type = response.headers.get("content-type") || "";
        const result = {
          status: response.status,
          redirected: response.redirected,
          loginRedirect: /\/login(?:\?|$)/i.test(response.url || ""),
          type,
          link: response.headers.get("link"),
        };
        if (response.ok && type.includes("json")) {
          result.json = await response.json();
        } else {
          result.body = (await response.text()).slice(0, 500);
        }
        sendResponse(result);
      } catch (error) {
        sendResponse({ status: 0, error: String(error?.message || error) });
      } finally {
        clearTimeout(timer);
      }
    })();
    return true;
  });

  chrome.runtime.sendMessage({ type: "canvas:page-ready" }).catch(() => {});
})();
