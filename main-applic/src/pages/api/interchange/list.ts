import fs from "fs/promises";
import { type NextApiRequest, type NextApiResponse } from "next";

const CACHE_DIR = process.env.CACHE_DIR ?? "./../python-applic/pipeline_cache";

const handleGet = async (_req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    try {
        const files = await fs.readdir(CACHE_DIR);
        const filteredFiles = files.filter((f) => f.endsWith(".json"));

        return res.status(200).json({ files: filteredFiles });
    }
    catch (_e) {
        return res.status(400).json({ error: "Error handleGet" });
    }
};

// GET /api/interchange/list
const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    if (req.method === "GET") {
        await handleGet(req, res);
    }
    else {
        return res.status(405).json({ message: "Method not allowed" });
    }
};

export default handler;
