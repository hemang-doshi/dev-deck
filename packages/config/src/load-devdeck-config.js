import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { isMap, parseDocument } from "yaml";
import { ConfigError } from "./errors.js";
import { normalizeConfig, validateRawConfig } from "./normalize-devdeck-config.js";
import { validateDependencyGraph } from "./validate-dependency-graph.js";
const CONFIG_FILE_NAME = "devdeck.yml";
export async function findDevdeckConfigPath(startDirectory = process.cwd()) {
    let currentDirectory = path.resolve(startDirectory);
    while (true) {
        const candidatePath = path.join(currentDirectory, CONFIG_FILE_NAME);
        try {
            await access(candidatePath);
            return candidatePath;
        }
        catch {
            const parentDirectory = path.dirname(currentDirectory);
            if (parentDirectory === currentDirectory) {
                return null;
            }
            currentDirectory = parentDirectory;
        }
    }
}
export async function loadDevdeckConfig(startDirectory = process.cwd()) {
    const configPath = await findDevdeckConfigPath(startDirectory);
    if (!configPath) {
        throw new ConfigError("DD-ERR-0001", `Could not find ${CONFIG_FILE_NAME} starting from ${path.resolve(startDirectory)}.`, "Run 'devdeck init' to create a starter devdeck.yml file in the current directory.");
    }
    const source = await readFile(configPath, "utf8");
    const document = parseDocument(source, { uniqueKeys: false });
    const duplicateServiceName = getDuplicateServiceName(document);
    if (duplicateServiceName) {
        throw new ConfigError("DD-ERR-0003", `Duplicate service name "${duplicateServiceName}" found in ${configPath}.`, "Ensure all service names under the 'services' key in devdeck.yml are unique.");
    }
    if (document.errors.length > 0) {
        throw new ConfigError("DD-ERR-0002", `Invalid YAML in ${configPath}: ${document.errors[0]?.message ?? "parse failed"}`, "Fix the YAML syntax errors in devdeck.yml.");
    }
    const parsed = document.toJS();
    const directory = path.dirname(configPath);
    const raw = validateRawConfig(parsed, configPath);
    const config = await normalizeConfig(raw, directory, configPath);
    validateDependencyGraph(config, configPath);
    return {
        path: configPath,
        directory,
        config,
    };
}
function getDuplicateServiceName(document) {
    const servicesNode = document.get("services", true);
    if (!isMap(servicesNode)) {
        return null;
    }
    const seenServiceNames = new Set();
    for (const item of servicesNode.items) {
        const serviceName = String(item.key);
        if (seenServiceNames.has(serviceName)) {
            return serviceName;
        }
        seenServiceNames.add(serviceName);
    }
    return null;
}
