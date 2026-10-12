const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reducedMotion) {
  addEventListener("pointermove", (event) => {
    document.documentElement.style.setProperty("--x", `${event.clientX}px`);
    document.documentElement.style.setProperty("--y", `${event.clientY}px`);
  });
}
