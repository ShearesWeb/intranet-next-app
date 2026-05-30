import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// This app is entirely dynamic (every route is force-dynamic / revalidate = 0),
// so there is no ISR data, no on-demand revalidation (revalidateTag/Path) and no
// generateStaticParams. That means NO tag cache (D1) and NO revalidation queue (DO)
// are needed. We keep only the R2 incremental cache (binding NEXT_INC_CACHE_R2_BUCKET),
// which is cheap and matches the documented production default.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
