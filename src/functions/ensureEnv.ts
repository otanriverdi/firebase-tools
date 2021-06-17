import { configstore } from "../configstore";
import { FirebaseError } from "../error";
import { promptOnce } from "../prompt";
import { logWarning } from "../utils";
import * as envstore from "./envstore";
import * as getProjectId from "../getProjectId";

const ENVSTORE_INTERNAL_ID = "firebase-functions-internal";
const CONFIGSTORE_KEY = "envstore";
<<<<<<< HEAD:src/functions/ensureEnv.ts
const CONFIGSTORE_TTL = 1000 * 60 * 60 * 24; /* 1 day */
=======
>>>>>>> 5ca42738 (Cache envstore checks.):src/functions/enableEnv.ts
const OPT_IN_MESSAGE =
  "functions:env family of commands helps you manage environment variables for Firebase Functions deployed in your project. " +
  "Learn more about this feature at https://firebase.google.com/docs/functions/env.\n\n" +
  "By opt-ing to have Firebase manage your function's environment variables, you may lose existing environment variables you've manually set up for your functions. " +
  "We recommend that you run firebase functions:env:migrate if you'd like to preserve existing environment variables.\n";

/**
 * Check if the EnvStore API is active.
 *
 * This is an bespoke method of checking whether EnvStore API has ever
 * been used on users's project.
 *
 * We define EnvStore to be active if ENV_ID=${ENVSTORE_INTERNAL_ID} contains
 * non-empty collection of key-value pairs.
 *
 * @param projectId The project on which to check enablement.
 * @return Promise<boolean> True if EnvStore API is enabled.
 */
async function _check(projectId: string): Promise<boolean> {
  const resp = await envstore.getStore(projectId, ENVSTORE_INTERNAL_ID);
  return !!resp.vars;
}

/**
 * Check if the EnvStore API is active.
 *
 * @param projectId The project on which to check enablement.
 * @return Promise<boolean> True if EnvStore API is enabled.
 */
export async function check(projectId: string): Promise<boolean> {
  // Check actice state from local cache.
  const cached = configstore.get(CONFIGSTORE_KEY) as { lastActiveAt: string } | undefined;
  if (cached?.lastActiveAt) {
    const activeAt = new Date(cached.lastActiveAt);
    const diff = Date.now() - activeAt.getTime();
    if (diff <= CONFIGSTORE_TTL) {
      return true;
    }
    configstore.delete(CONFIGSTORE_KEY);
  }

  // Query the EnvStore API to check active state.
  const checked = await _check(projectId);
  if (checked) {
    configstore.set(CONFIGSTORE_KEY, { lastActiveAt: Date.now() });
    return true;
  }
  return false;
}

/**
 * Attempt to enable the EnvStore API.
 *
 * This is an bespoke method of "enabling" EnvStore API. We "enable" the
 * EnvStore API setting up a non-empty EnvStore ENV_ID=${ENVSTORE_INTERNAL_ID}
 * with a non-empty collection of key-value pairs.
 *
 * @param projectId The project in which to enable the EnvStore API.
 * @return Promise<void>
 */
export async function enable(projectId: string): Promise<void> {
  await envstore.patchStore(projectId, ENVSTORE_INTERNAL_ID, { ENABLED: "1" });
}

/**
 * Check if EnvStore API is enabled on the project.
 * If not enabled, prompt user for enablement.
 *
 * @param projectId The project on which to check enablement.
 * @return Promise<void>
 */
export async function ensure(options: any): Promise<void> {
  const projectId = getProjectId(options);
  const isEnabled = await check(projectId);
  if (isEnabled) {
    return;
  }
  logWarning(OPT_IN_MESSAGE);
  const proceed = await promptOnce({
    type: "confirm",
    name: "confirm",
    default: false,
    message: "Would you like to have Firebase manage your function's environment variables?",
  });
  if (!proceed) {
    throw new FirebaseError("Must opt-in to use functions:env:* commands.", { exit: 1 });
  }
  return enable(projectId);
}