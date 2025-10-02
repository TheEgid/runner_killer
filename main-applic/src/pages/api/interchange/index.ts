import * as syncFs from "fs";
import fs from "fs/promises";
import { type NextApiRequest, type NextApiResponse } from "next";
import path from "path";

const PROJECT_ROOT = process.cwd();
const CACHE_DIR = process.env.CACHE_DIR ?? path.resolve(PROJECT_ROOT, "../python-applic/pipeline_cache");

const validateFileName = (fileName: string): boolean => {
    if (!fileName || typeof fileName !== "string") { return false; }

    const decoded = decodeURIComponent(fileName);

    if (!/^[\w\-.]+\.(json|md|xlsx|txt|csv)$/i.test(decoded)) { return false; }

    if (path.basename(decoded) !== decoded) { return false; }

    return true;
};

const downloadFile = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const rawFileName = req.query.file;

    if (!rawFileName || typeof rawFileName !== "string") {
        return res.status(400).json({ success: false, error: "File name is required" });
    }

    try {
        if (!validateFileName(rawFileName)) {
            return res.status(400).json({ success: false, error: "Invalid file name" });
        }

        const decodedFileName = decodeURIComponent(rawFileName);
        const fullPath = path.join(CACHE_DIR, decodedFileName);

        try {
            await fs.access(fullPath);
        }
        catch (accessError: any) {
            if (accessError.code === "ENOENT") {
                return res.status(404).json({ success: false, error: `File ${decodedFileName} not found` });
            }
            throw accessError;
        }

        const stat = await fs.stat(fullPath);
        const fileSize = stat.size;

        let contentType: string;

        if (decodedFileName.endsWith(".md")) {
            contentType = "text/markdown; charset=utf-8";
        }
        else if (decodedFileName.endsWith(".xlsx")) {
            contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        }
        else if (decodedFileName.endsWith(".json")) {
            contentType = "application/json; charset=utf-8";
        }
        else {
            contentType = "application/octet-stream";
        }

        res.setHeader("Content-Disposition", `attachment; filename="${decodedFileName}"`);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", fileSize.toString());

        // Используем импортированный syncFs
        const fileStream = syncFs.createReadStream(fullPath);

        fileStream.pipe(res);

        fileStream.on("error", (streamError) => {
            console.error("Stream error:", streamError);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: "Error streaming file" });
            }
        });

        res.status(200);
    }
    catch (error: any) {
        console.error("Download error:", error);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, error: `Error reading file: ${error.message}` });
        }
    }
};

const deleteFile = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const rawFileName = req.query.file;

    if (!rawFileName || typeof rawFileName !== "string") {
        return res.status(400).json({ success: false, error: "File name is required" });
    }

    try {
        if (!validateFileName(rawFileName)) {
            return res.status(400).json({ success: false, error: "Invalid file name" });
        }

        const decodedFileName = decodeURIComponent(rawFileName);
        const fullPath = path.join(CACHE_DIR, decodedFileName);

        try {
            await fs.access(fullPath);
        }
        catch (accessError: any) {
            if (accessError.code === "ENOENT") {
                return res.status(404).json({
                    success: false,
                    error: `File ${decodedFileName} not found`,
                });
            }
            throw accessError;
        }

        await fs.unlink(fullPath);

        console.log(`File deleted successfully: ${fullPath}`);

        return res.status(200).json({
            success: true,
            message: `File ${decodedFileName} deleted successfully`,
        });
    }
    catch (error: any) {
        console.error("Delete error:", error);
        if (error.code === "EACCES") {
            return res.status(403).json({
                success: false,
                error: "Permission denied to delete file",
            });
        }
        return res.status(500).json({
            success: false,
            error: `Error deleting file: ${error.message}`,
        });
    }
};

// PUT /api/interchange - delete
// POST /api/interchange - download
const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    if (req.method === "POST") {
        await downloadFile(req, res);
    }
    else if (req.method === "PUT") {
        await deleteFile(req, res);
    }
    else {
        return res.status(405).json({
            success: false,
            error: "Method not allowed (use POST for download, PUT for delete)",
        });
    }
};

export default handler;
