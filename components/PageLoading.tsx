import { HoldProgress } from "./Progress";

/** While a page loads (inside the frame, which stays put): its outline, shimmering. */
export function PageLoading() {
  return (
    <div className="skel" role="status" aria-label="Loading">
      <HoldProgress />
      <div className="skel__head" aria-hidden="true">
        <i className="skel__line skel__line--eyebrow" />
        <i className="skel__line skel__line--title" />
        <i className="skel__line skel__line--lead" />
      </div>
      <div className="skel__grid" aria-hidden="true">
        <i className="skel__block skel__block--tall" />
        <div className="skel__col">
          <i className="skel__block" />
          <i className="skel__block" />
        </div>
      </div>
    </div>
  );
}
