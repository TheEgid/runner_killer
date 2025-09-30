import fs from "fs/promises";
import { type NextApiRequest, type NextApiResponse } from "next";
import path from "path";

const PROJECT_ROOT = process.cwd(); // e.g., /path/to/runner_killer/main-applic
const CACHE_DIR = process.env.CACHE_DIR ?? path.resolve(PROJECT_ROOT, "../python-applic/pipeline_cache");

const filterAllowedFiles = async (files: string[], allowedExtensions: string[]): Promise<string[]> => {

    return files
        .filter((f) => !f.startsWith("."))
        .filter((f) => allowedExtensions.some((ext) => f.toLowerCase().endsWith(ext.toLowerCase())))
        .sort();
};

const handleGet = async (res: NextApiResponse): Promise<void> => {
    try {
        try {
            await fs.access(CACHE_DIR);
        }
        catch (accessError: any) {
            if (accessError.code === "ENOENT") {
                res.status(200).json({ success: true, files: [], count: 0, cacheDir: CACHE_DIR });
                return;
            }
            throw accessError;
        }

        const entries = await fs.readdir(CACHE_DIR, { withFileTypes: true });
        const files = entries
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name);

        const allowedExtensions = [".json", ".md", ".xlsx"];
        const filteredFiles = await filterAllowedFiles(files, allowedExtensions);

        console.log(`Found ${filteredFiles.length} allowed files in ${CACHE_DIR}`);

        res.status(200).json({
            success: true,
            files: filteredFiles,
            count: filteredFiles.length,
            // cacheDir: CACHE_DIR, // Опционально: для debug, удалите в prod
        });
    }
    catch (error: any) {
        console.error("List files error:", error);
        if (error.code === "EACCES") {
            res.status(403).json({
                success: false,
                error: "Permission denied to read cache directory",
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: `Error listing files: ${error.message}`,
            });
        }
    }
};

// GET /api/interchange/list
const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    if (req.method !== "GET") {
        res.status(405).json({
            success: false,
            error: "Method not allowed (use GET to list files)",
        });
        return;
    }

    try {
        await handleGet(res);
    }
    catch (error: any) {
        console.error("Unexpected list error:", error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: `Unexpected error: ${error.message}`,
            });
        }
    }
};

export default handler;
