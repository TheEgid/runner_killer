import { AuthService } from "src/services/authService";
import type { NextApiRequest, NextApiResponse } from "next";

const authCheckHandler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const authService = new AuthService();

    try {
        const refreshToken = req.cookies["refreshToken"];

        if (!refreshToken) {
            return res.status(401).json({ error: "refreshTokenMissing" });
        }

        const user = await authService.verifyRefreshToken(refreshToken);

        if (!user) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }

        res.status(200).json({ message: "Authorized" });
    }
    catch (error) {
        res.status(401).json({ error: `Authorization check failed: ${(error as Error).message}` });
    }
};

// POST | GET /api/user-auth/authcheck
const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    if (req.method === "GET" || req.method === "POST") {
        await authCheckHandler(req, res);
    }
    else {
        return res.status(405).json({ message: "Method not allowed" });
    }
};

export default handler;
