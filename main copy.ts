import * as core from "@actions/core";
import * as os from "os";
import axios from "axios";
import { spawn } from "child_process";

import { presence, sleep } from "@google-github-actions/actions-utils";
import {
  authenticateGcloudSDK,
  isAuthenticated,
} from "@google-github-actions/setup-cloud-sdk";
import * as fs from "fs/promises";
import dedent from "ts-dedent";

type RunnerInfo = {
  os: string;
  arch: string;
};

export const downloadProxy = async (binPath: string): Promise<string> => {
  const executable = "cloud_sql_proxy";
  const info = getRunnerInfo();
  const version = await getLatestRelease();
  const url = `https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/${version}/cloud-sql-proxy.${info.os}.${info.arch}`;

  const directory = binPath;
  const filePath = `${directory}/${executable}`;

  core.info(filePath);

  try {
    core.info(`Verifying access to ${directory}`);
    await fs.access(directory, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    await fs.mkdir(directory);
  }

  core.info(`Downloading Cloud SQL Proxy from ${url} to ${directory}`);

  try {
    const response = await axios({
      method: "get",
      url: url,
      responseType: "stream",
    });

    await fs.writeFile(filePath, response.data);
    await fs.chmod(filePath, 0o755); // Make the binary executable

    core.info(
      "Successfully downloaded and set execution permissions on Cloud SQL Proxy"
    );

    return filePath;
  } catch (error: any) {
    core.setFailed(`Failed to download Cloud SQL Proxy: ${error.message}`);
    throw error;
  }
};

async function googleAuth(): Promise<boolean> {
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
}

const getLatestRelease = async (): Promise<String> => {
  const url = `https://api.github.com/repos/GoogleCloudPlatform/cloudsql-proxy/releases/latest`;
  try {
    const response = await axios.get(url);
    return response.data.name;
  } catch (error) {
    core.setFailed(
      `Failed to fetch the latest Cloud SQL Proxy release: ${error}`
    );
    throw error;
  }
};

const getRunnerInfo = (): RunnerInfo => {
  const osVersion: string = os.platform();
  let archType = os.arch();

  if (archType === "x64") {
    archType = "amd64";
  }

  if (archType === "x86") {
    archType = "386";
  }

  return {
    os: osVersion,
    arch: archType,
  };
};

type ProxySocket = {
  path: string
  file: string
}

const waitForSocketFile = async (
  socketFilePath: string,
  timeout: number = 10000
): Promise<ProxySocket | undefined> => {
  const startTime = Date.now();

  let attempts = 1;

  while (true) {
    core.info(`[${attempts}] Waiting for socket ${socketFilePath}`);

    let sockets: string[] = [];

    sockets = await fs.readdir(socketFilePath);

    if (sockets.length > 0) {
      core.info(
        "Socket files exists, Cloud SQL Proxy is ready for connections."
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
    `Cloud SQL Proxy started in background with PID: ${subprocess.pid}`
  );
}

async function run(): Promise<void> {
  try {
    core.info("Starting download");

    let port = presence(core.getInput("port"));
    let address = presence(core.getInput("address"));

    const instanceConnectionName = core.getInput("instance_connection_name", {
      required: true,
    });
    const privateIP = presence(core.getInput("private_ip"));

    const binPath = core.getInput("bin_path");
    const executablePath: string = await downloadProxy(binPath);

    const proxyArgs = [`${instanceConnectionName}`, "--gcloud-auth"];

    if (address) {
      proxyArgs.push(`--address`);
      proxyArgs.push(address);
    }

    if (port) {
      proxyArgs.push(`--port`);
      proxyArgs.push(port);
    }

    if (privateIP) {
      proxyArgs.push(`--private-ip`);
      proxyArgs.push(privateIP);
    }

    const socketPath = "/tmp/cloudsql";
    await fs.mkdir(socketPath);

    proxyArgs.push(`--unix-socket`);
    proxyArgs.push(socketPath);

    await googleAuth();

    startCloudSQLProxyInBackground(executablePath, proxyArgs);

    const socket = await waitForSocketFile(socketPath);

    if (socket) {
      core.exportVariable("CLOUDSQL_SOCKET_PATH", socket.path);
      core.exportVariable("CLOUDSQL_SOCKET_FILE", socket.file);

      core.setOutput("socket_path", socket.path);
      core.setOutput("socket_file", socket.file);

      core.addPath(socket.path);
    } else {
      core.setFailed("Unable to get cloudsql socket");
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

if (require.main === module) {
  run();
}
