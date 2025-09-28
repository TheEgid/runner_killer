import argon2 from "argon2";
import { AuthService } from "src/services/authService";
import prisma from "src/services/databaseService";
import { isEmail } from "src/tools/some-tools";
import type { NextApiRequest, NextApiResponse } from "next";
import type { IAuthFormInput } from "src/types/types";

const registerUser = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const authService = new AuthService();

    try {
        const { email, password, ...rest } = req.body as IAuthFormInput;

        if (!password) { throw new Error("Password are required"); }

        if (!isEmail(email)) { throw new Error("Invalid email format"); }

        const existingUser = await prisma.user.findUnique({ where: { email } });

        if (existingUser) { throw new Error("User already exists"); }

        const hashedPassword = await argon2.hash(password);
        const user = await prisma.user.create({ data: { ...rest, email, password: hashedPassword } });

        if (!user) { throw new Error("Failed to register user"); }

        const { id, role, tokenversion, isemailconfirmed } = user;

        return res.status(201).json({
            role,
            isemailconfirmed,
            email,
            ...authService.assignTokens(id, role, tokenversion),
        });
    }
    catch (error) {
        return res.status(400).json({ error: `Registration Error: ${(error as Error).message}` });
    }
};

// POST /api/user-auth/register
const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    if (req.method === "POST") {
        await registerUser(req, res);
    }
    else {
        return res.status(405).json({ message: "Method not allowed" });
    }
};

export default handler;
