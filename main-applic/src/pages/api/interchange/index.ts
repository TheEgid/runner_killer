import fs from "fs/promises"; // Используем async версии (promises)
import { type NextApiRequest, type NextApiResponse } from "next";
import path from "path";

const PROJECT_ROOT = process.cwd(); // e.g., /path/to/runner_killer/main-applic
const CACHE_DIR = process.env.CACHE_DIR ?? path.resolve(PROJECT_ROOT, "../python-applic/pipeline_cache");

const validateFileName = (fileName: string): boolean => {
    if (!fileName || typeof fileName !== "string") { return false; }

    const decoded = decodeURIComponent(fileName);

    if (!/^[\w\-.]+\.(json|md|xlsx|txt|csv)$/i.test(decoded)) { return false; }

    if (path.basename(decoded) !== decoded) { return false; }

    return true;
};

const handleDownload = async (fileName: string, res: NextApiResponse): Promise<void> => {
    try {
    // Валидация
        if (!validateFileName(fileName)) {
            res.status(400).json({ success: false, error: "Invalid file name" });
            return;
        }

        const decodedFileName = decodeURIComponent(fileName);
        const fullPath = path.join(CACHE_DIR, decodedFileName);

        // Проверяем существование файла (async)
        try {
            await fs.access(fullPath);
        }
        catch (accessError: any) {
            if (accessError.code === "ENOENT") {
                res.status(404).json({ success: false, error: `File ${decodedFileName} not found` });
                return;
            }
            throw accessError;
        }

        // Получаем stat async
        const stat = await fs.stat(fullPath);
        const fileSize = stat.size;

        // Определяем Content-Type
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

        // Устанавливаем headers
        res.setHeader("Content-Disposition", `attachment; filename="${decodedFileName}"`);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", fileSize.toString());

        // Stream файл async (fs.createReadStream из sync fs, но это ok для response)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const syncFs = require("fs"); // Локальный импорт sync только для stream
        const fileStream = syncFs.createReadStream(fullPath);

        fileStream.pipe(res);

        // Обработка ошибок stream
        fileStream.on("error", (streamError) => {
            console.error("Stream error:", streamError);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: "Error streaming file" });
            }
        });

        // Успех: res уже streamed, не нужно JSON
        res.status(200);

    }
    catch (error: any) {
        console.error("Download error:", error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: `Error reading file: ${error.message}` });
        }
    }
};

const handleDelete = async (fileName: string, res: NextApiResponse): Promise<void> => {
    try {
    // Валидация
        if (!validateFileName(fileName)) {
            res.status(400).json({ success: false, error: "Invalid file name" });
            return;
        }

        const decodedFileName = decodeURIComponent(fileName);
        const fullPath = path.join(CACHE_DIR, decodedFileName);

        // Проверяем существование async
        try {
            await fs.access(fullPath);
        }
        catch (accessError: any) {
            if (accessError.code === "ENOENT") {
                res.status(404).json({
                    success: false,
                    error: `File ${decodedFileName} not found`,
                });
                return;
            }
            throw accessError;
        }

        // Удаляем async
        await fs.unlink(fullPath);

        console.log(`File deleted successfully: ${fullPath}`); // Лог для отладки

        // Успешный ответ с success: true (чтобы фронт не ошибся!)
        res.status(200).json({
            success: true,
            message: `File ${decodedFileName} deleted successfully`,
        });

    }
    catch (error: any) {
        console.error("Delete error:", error);
        if (error.code === "EACCES") {
            res.status(403).json({
                success: false,
                error: "Permission denied to delete file",
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: `Error deleting file: ${error.message}`,
            });
        }
    }
};

// POST /api/interchange | PUT /api/interchange
const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {

    const rawFileName = req.query.file;

    if (!rawFileName || typeof rawFileName !== "string") {
        res.status(400).json({ success: false, error: "File name is required" });
        return;
    }

    try {
        if (req.method === "POST") {
            await handleDownload(rawFileName, res);
        }
        else if (req.method === "PUT") {
            await handleDelete(rawFileName, res);
        }
        else {
            res.status(405).json({ success: false, error: "Method not allowed (use POST for download, PUT for delete)" });
        }
    }
    catch (error: any) {
        console.error("Unexpected handler error:", error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: `Unexpected error: ${error.message}`,
            });
        }
    }
};

export default handler;
