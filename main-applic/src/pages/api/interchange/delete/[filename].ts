import fs from "fs/promises";
import { type NextApiRequest, type NextApiResponse } from "next";
import path from "path";

const CACHE_DIR = process.env.CACHE_DIR ?? "./../python-applic/pipeline_cache";

const handleDelete = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    try {
        const { filename } = req.query;

        if (!filename || Array.isArray(filename)) {
            return res.status(400).json({ error: "Укажите ?filename=имя_файла" });
        }

        const filePath = path.join(CACHE_DIR, filename);

        if (!path.resolve(filePath).startsWith(path.resolve(CACHE_DIR))) {
            return res.status(400).json({ error: "Неверный путь" });
        }

        await fs.unlink(filePath);
        return res.status(200).json({ message: `Файл ${filename} удалён` });
    }
    catch (error) {
        return res.status(400).json({ error: `Error handleDelete: ${(error as Error).message}` });
    }
};

// DELETE /api/interchange/delete
const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    if (req.method === "DELETE") {
        await handleDelete(req, res);
    }
    else {
        return res.status(405).json({ message: "Method not allowed" });
    }
};

export default handler;
