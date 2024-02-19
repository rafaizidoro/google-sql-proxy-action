import * as core from "@actions/core";
import { spawn } from "child_process";
import { ProxySocket } from "./types";
import { sleep } from "@google-github-actions/actions-utils";
import * as fs from "fs/promises";

function startCloudSQLProxyInBackground(cmd: string, args: string[]): void {
  core.info(`Spawning command: ${cmd} with args ${args}`);
  const subprocess = spawn(cmd, args, {
    detached: true,
    stdio: ["inherit", "inherit", "inherit"],
  });

  subprocess.unref(); // This allows your script to exit independently of the subprocess

  subprocess.on("error", (err) => {
    core.error(`Failed to start subprocess: ${err.message}`);
  });

  subprocess.on("exit", (code, signal) => {
    if (code !== null) {
      core.info(`Subprocess exited with code ${code}`);
    } else {
      core.info(`Subprocess terminated by signal ${signal}`);
    }
  });

  core.info(
    `Cloud SQL Proxy started in background with PID: ${subprocess.pid}`,
  );
}

const waitForSocketFile = async (
  socketFilePath: string,
  timeout: number = 10000,
): Promise<ProxySocket | undefined> => {
  const startTime = Date.now();

  let attempts = 1;

  while (true) {
    core.info(`[${attempts}] Waiting for socket ${socketFilePath}`);

    let sockets: string[] = [];

    sockets = await fs.readdir(socketFilePath);

    if (sockets.length > 0) {
      core.info(
        "Socket files exists, Cloud SQL Proxy is ready for connections.",
      );

      const socketFileDir = [socketFilePath, sockets[0]].join("/");
      const socketFile = await fs.readdir(socketFileDir);

      return { path: socketFileDir, file: socketFile[0] };
    } else {
      if (Date.now() - startTime > timeout) {
        throw new Error("Timeout reached waiting for socket file.");
      }

      attempts++;
      await sleep(1000);
    }
  }
};
