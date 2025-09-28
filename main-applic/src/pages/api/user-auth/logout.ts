import { setCookie } from "cookies-next";
import type { NextApiRequest, NextApiResponse } from "next";

const logoutHandler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {

    try {
        // await setCookie("accessToken", "", { req, res, maxAge: 0, path: "/" });
        await setCookie("refreshToken", "", { req, res, maxAge: 0, path: "/" });

        res.status(200).json({ message: "Logged out, cookies cleared" });
    }
    catch (error) {
        return res.status(400).json({ error: `Login Error: ${(error as Error).message}` });
    }
};

// PUT /api/user-auth/logout
const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    if (req.method === "PUT") {
        await logoutHandler(req, res);
    }
    else {
        return res.status(405).json({ message: "Method not allowed" });
    }
};

export default handler;
