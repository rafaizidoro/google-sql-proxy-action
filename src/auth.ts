import dedent from "ts-dedent";

import {
  authenticateGcloudSDK,
  isAuthenticated,
} from "@google-github-actions/setup-cloud-sdk";

export const auth = async (): Promise<boolean> => {
  // this envvar comes from google-github-actions/auth
  const credFile = process.env.GOOGLE_GHA_CREDS_PATH;

  if (credFile) {
    await authenticateGcloudSDK(credFile);
    core.info("Successfully authenticated on Google Cloud");

    return true;
  } else {
    try {
      core.info("Checking Google Cloud authentication");

      return isAuthenticated();
    } catch (error) {
      let msg = dedent`
          Could not authenticate on Google Cloud
          Authenticate by adding the "google-github-actions/auth
          prior this one.`;

      core.error(msg);

      throw error;
    }
  }
};
