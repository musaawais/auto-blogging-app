export const logger = {
  info:  (obj: unknown, msg?: string) => console.log("[INFO]",  msg || "", typeof obj === 'object' ? JSON.stringify(obj) : obj),
  warn:  (obj: unknown, msg?: string) => console.warn("[WARN]",  msg || "", typeof obj === 'object' ? JSON.stringify(obj) : obj),
  error: (obj: unknown, msg?: string) => console.error("[ERROR]", msg || "", typeof obj === 'object' ? JSON.stringify(obj) : obj),
  debug: (obj: unknown, msg?: string) => console.debug("[DEBUG]", msg || "", typeof obj === 'object' ? JSON.stringify(obj) : obj),
  child: (_opts: unknown) => logger,
};
