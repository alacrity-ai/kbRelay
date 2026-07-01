/** Generate a prefixed, URL-safe id, e.g. `prj_1a2b...`. */
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}
