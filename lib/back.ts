/** What a just-added thing is called in the "… added" toast on the page an Add went back to. */
export const ADDED = { code: "QR code added", prize: "Prize added", sponsor: "Sponsor added", location: "Location added" } as const;
export type AddedKind = keyof typeof ADDED;

/**
 * Where an Add goes once it's saved: back to the page its form was opened from (the form's `back`,
 * components/form.tsx BackField), saying what was added; without one (the add page opened by its
 * address), the new thing's own page, as before.
 */
export function afterAdd(fd: FormData, ownPage: string, kind: AddedKind) {
  const back = fd.get("back");
  if (typeof back !== "string" || !back.startsWith("/") || back.startsWith("//") || back.startsWith("/\\")) return `${ownPage}?added=1`;
  const url = new URL(back, "http://admin.local");
  url.searchParams.set("added", kind);
  return url.pathname + url.search;
}
