import { setCookie } from "cookies-next/server";
import { type NextApiRequest, type NextApiResponse } from "next";
import { AuthService } from "src/services/authService";
import prisma from "src/services/databaseService";
import type { IAuthFormInput } from "src/types/types";

const loginUser = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const authService = new AuthService();

    try {
        const { email, password } = req.body as IAuthFormInput;

        const existingUser = await prisma.user.findFirst({ where: { email } });

        if (!existingUser) { throw new Error("Email is invalid"); }

        const isValid = await authService.argonVerify(existingUser.password, password);

        if (!isValid) { throw new Error("Password is invalid"); }

        const { id, role, tokenversion, isemailconfirmed, email: userEmail } = existingUser;
        const tokens = authService.assignTokens(id, role, tokenversion);

        await setCookie("refreshToken", tokens.refreshToken, {
            req,
            res,
            httpOnly: false,
            maxAge: 1000 * 60 * 60,
            sameSite: "strict",
            path: "/",
        });

        return res.status(200).json({ role, isemailconfirmed, email: userEmail, ...tokens });
    }
    catch (error) {
        return res.status(400).json({ error: `Login Error: ${(error as Error).message}` });
    }
};

// POST /api/user-auth/login
const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    if (req.method === "POST") {
        await loginUser(req, res);
    }
    else {
        return res.status(405).json({ message: "Method not allowed" });
    }
};

export default handler;
