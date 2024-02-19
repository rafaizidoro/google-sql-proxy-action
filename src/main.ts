import { presence } from "@google-github-actions/actions-utils";
import * as fs from "fs/promises";
import * as core from "@actions/core";

const run = async (): Promise<void> => {
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
};

if (require.main === module) {
  run();
}
