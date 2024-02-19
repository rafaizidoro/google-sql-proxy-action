import * as core from "@actions/core";
import * as os from "os";
import axios from "axios";
import { RunnerInfo } from "./types";
import * as fs from "fs/promises";

const getLatestRelease = async (): Promise<String> => {
  const url = `https://api.github.com/repos/GoogleCloudPlatform/cloudsql-proxy/releases/latest`;
  try {
    const response = await axios.get(url);
    return response.data.name;
  } catch (error) {
    core.setFailed(
      `Failed to fetch the latest Cloud SQL Proxy release: ${error}`,
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
      "Successfully downloaded and set execution permissions on Cloud SQL Proxy",
    );

    return filePath;
  } catch (error: any) {
    core.setFailed(`Failed to download Cloud SQL Proxy: ${error.message}`);
    throw error;
  }
};
