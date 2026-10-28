// Railway configuration for the daily profile job: project SCRIPTORIVM, service profile-cron.
//
// It replaced railway.json on 2026-10-27, because Railway stops reading Config as Code on 2026-12-01.
// Railway never reads this directory during a deploy. Editing it and running `railway up` changes
// nothing: run `railway config plan`, read the plan, then apply exactly that plan.
// https://docs.railway.com/infrastructure-as-code
//
//  - restartPolicyType is ALWAYS, not ON_FAILURE. The service is a long-lived daemon
//    (scripts/cron/daemon.mjs), so any exit is wrong, and a retry cap would let it die for good and
//    freeze the profile without a sound. `railway config migrate` generated NEVER here, because it
//    copied the service's own setting rather than railway.json's; never apply its output.
//  - No `source`: the service is deployed with `railway up` from this directory, not from GitHub.
//  - `partial` keeps the file to this one service, and `variables: { managed: false }` leaves
//    GH_TOKEN and PROFILE_RUN_AT where they are, on Railway.
import { defineRailway, project, service } from "railway/iac";

export const partial = "profile-cron";

export default defineRailway((ctx) => {
  const profileCron = service("profile-cron", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "deploy/Dockerfile" },
    replicas: { "us-east4-eqdc4a": 1 },
    deploy: { restartPolicyType: "ALWAYS" },
  });

  // The linked project's own name, so this file can never rename the project.
  return project(ctx.projectName ?? "SCRIPTORIVM", {
    variables: { managed: false },
    resources: [profileCron],
  });
});
