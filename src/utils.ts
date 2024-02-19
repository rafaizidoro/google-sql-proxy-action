import { readdir } from "fs/promises";
import { sleep } from "@google-github-actions/actions-utils/dist/time";
import { ActionError, ErrorType } from "errors";

/**
 * Waits for a file to appear in the specified directory path.
 * @param path The path of the directory to watch.
 * @param timeout The timeout duration in seconds (default: 20).
 * @param sleepInterval The sleep interval between retries in seconds (default: 1).
 * @returns The full path of the first file found in the directory.
 * @throws {ActionError} If a timeout occurs while waiting for the file.
 */
export const waitFile = async (
  path: string,
  timeout: number = 20,
  sleepInterval: number = 1,
): Promise<string> => {
  const startTime = Date.now();

  while (true) {
    try {
      const files = await readdir(path);
      if (files.length > 0) {
        return files[0];
      }
    } catch (error) {
      throw new ActionError({
        type: ErrorType.INTERNAL,
        message: `Error reading directory: ${error.message}`,
      });
    }

    if (Date.now() - startTime > timeout * 1000) {
      throw new ActionError({
        type: ErrorType.TIMEOUT,
        message: "Timeout reached waiting for file.",
      });
    }

    await sleep(sleepInterval * 1000);
  }
};
