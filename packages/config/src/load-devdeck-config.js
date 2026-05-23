import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { isMap, parseDocument } from "yaml";
import { ConfigError } from "./errors.js";
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
        throw new ConfigError(`Could not find ${CONFIG_FILE_NAME} starting from ${path.resolve(startDirectory)}.`);
    }
    const source = await readFile(configPath, "utf8");
    const document = parseDocument(source, { uniqueKeys: false });
    const duplicateServiceName = getDuplicateServiceName(document);
    if (duplicateServiceName) {
        throw new ConfigError(`Duplicate service name "${duplicateServiceName}" found in ${configPath}.`);
    }
    if (document.errors.length > 0) {
        throw new ConfigError(`Invalid YAML in ${configPath}: ${document.errors[0]?.message ?? "parse failed"}`);
    }
    const parsed = document.toJS();
    const directory = path.dirname(configPath);
    const config = await validateConfig(parsed, directory, configPath);
    return {
        path: configPath,
        directory,
        config,
    };
}
async function validateConfig(parsed, directory, configPath) {
    if (!isRecord(parsed)) {
        throw new ConfigError(`Expected ${configPath} to contain a YAML object.`);
    }
    const project = parsed.project;
    const services = parsed.services;
    if (typeof project !== "string" || project.trim() === "") {
        throw new ConfigError(`Expected "project" to be a non-empty string in ${configPath}.`);
    }
    if (!isRecord(services) || Object.keys(services).length === 0) {
        throw new ConfigError(`Expected "services" to be a non-empty object in ${configPath}.`);
    }
    const validatedServices = {};
    for (const [serviceName, rawService] of Object.entries(services)) {
        validatedServices[serviceName] = await validateServiceConfig(serviceName, rawService, directory, configPath);
    }
    return {
        project: project.trim(),
        services: validatedServices,
    };
}
async function validateServiceConfig(serviceName, rawService, directory, configPath) {
    if (!isRecord(rawService)) {
        throw new ConfigError(`Expected service "${serviceName}" to be an object in ${configPath}.`);
    }
    const command = rawService.command;
    const cwd = rawService.cwd;
    const port = rawService.port;
    if (typeof command !== "string" || command.trim() === "") {
        throw new ConfigError(`Expected service "${serviceName}" to define a non-empty "command" in ${configPath}.`);
    }
    if (typeof cwd !== "string" || cwd.trim() === "") {
        throw new ConfigError(`Expected service "${serviceName}" to define a non-empty "cwd" in ${configPath}.`);
    }
    const resolvedCwd = path.resolve(directory, cwd);
    let cwdStats;
    try {
        cwdStats = await stat(resolvedCwd);
    }
    catch {
        throw new ConfigError(`Expected service "${serviceName}" cwd to exist: ${resolvedCwd}.`);
    }
    if (!cwdStats.isDirectory()) {
        throw new ConfigError(`Expected service "${serviceName}" cwd to be a directory: ${resolvedCwd}.`);
    }
    if (port !== undefined && (!Number.isInteger(port) || port <= 0)) {
        throw new ConfigError(`Expected service "${serviceName}" port to be a positive integer in ${configPath}.`);
    }
    return port === undefined
        ? { command: command.trim(), cwd }
        : { command: command.trim(), cwd, port };
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
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
