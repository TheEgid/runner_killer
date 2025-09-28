import { type NextApiRequest, type NextApiResponse } from "next";
import { AuthService } from "src/services/authService";

const getTokens = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const authService = new AuthService();

    try {
        const bearerHeader = req.headers.authorization;
        const inputToken = bearerHeader?.split(" ")[1];

        if (!inputToken) { throw new Error("Token not provided"); }

        const { accessToken, refreshToken, user } = await authService.refreshTokens(inputToken);

        if (!accessToken || !user) { throw new Error("Invalid token or user not found"); }
        const { email } = user;

        return res.status(200).json({ accessToken, refreshToken, email });
    }
    catch (error) {
        return res.status(400).json({ error: `Error refreshing token: ${(error as Error).message}` });
    }
};

// POST /api/user-auth/refresh
const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    if (req.method === "POST") {
        await getTokens(req, res);
    }
    else {
        return res.status(405).json({ message: "Method not allowed" });
    }
};

export default handler;
