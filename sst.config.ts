// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    const stage = input?.stage ?? "preprod";

    return {
      name: `${stage}-web-intranet`,
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["prd"].includes(stage),
      home: "aws",
    };
  },
  async run() {
    const stage = $app.stage;

    const envVars = {
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    };

    // Stage-specific settings
    const isProd = stage === "prd";
    const domainName = isProd
      ? "intranet.shweb.org"
      : "intranet-beta.shweb.org";

    new sst.aws.Nextjs(`intranet`, {
      domain: domainName,
      environment: envVars,
    });

  },
});
