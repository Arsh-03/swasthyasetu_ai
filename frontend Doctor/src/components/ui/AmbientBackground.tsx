/**
 * Ambient background: large, soft, blurred organic blobs (ice, primarySoft, sand) fixed behind the
 * content so the glass has something to refract. Pure CSS (utilities.css `.ambient*`), static, no images.
 * Peak opacities match the contrast check (ice 70%, primarySoft 16%, sand 70%).
 * Place it once as the first child of a `relative isolate` page container; content must sit above it.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="ambient -z-10">
      <span className="ambient-blob ambient-blob-ice" />
      <span className="ambient-blob ambient-blob-primary" />
      <span className="ambient-blob ambient-blob-sand" />
    </div>
  );
}
