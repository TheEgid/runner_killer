import { type NextApiRequest, type NextApiResponse } from "next";

const handleGet = async (_req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    try {
        return res.status(200).json("ok");
    }
    catch (error) {
        return res.status(400).json({ error: `Error handleGet: ${(error as Error).message}` });
    }
};

// GET /api/healthcheck
const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    if (req.method === "GET") {
        await handleGet(req, res);
    }
    else {
        return res.status(405).json({ message: "Method not allowed" });
    }
};

export default handler;
