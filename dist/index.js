import { Plugin } from "@opencode/plugin";
/**
 * This package is a TUI-only plugin. OpenCode can load it from `cli.json`
 * (CLI-only plugins) or from `opencode.json` (the server loads `.` and the CLI
 * loads `./tui` automatically).
 *
 * The server context has no UI domain, so it must not pull OpenTUI in through a
 * static import. The TUI module is loaded only when the context can render.
 */
function isTuiContext(context) {
  const candidate = context;
  return typeof candidate.ui?.slot === "function" && typeof candidate.storage?.store === "function";
}
export default Plugin.define({
  id: "deepseek-balance",
  async setup(context) {
    if (!isTuiContext(context)) return;
    const {
      start
    } = await import("./tui.js");
    return start(context);
  }
});
//# sourceMappingURL=index.js.map