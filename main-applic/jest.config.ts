import nextJest from "next/jest.js";
import type { Config } from "jest";

const createJestConfig = nextJest({
    dir: ".",
});

const config: Config = {
    testEnvironment: "node",
    modulePaths: ["<rootDir>"],
    verbose: true,
    forceExit: true,
    detectOpenHandles: true,
    testPathIgnorePatterns: [".e2e."],
};

export default createJestConfig(config);
