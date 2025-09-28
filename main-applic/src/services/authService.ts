import * as argon2 from "argon2";
import { sign, verify } from "jsonwebtoken";
import prisma from "./databaseService";
import type { IAccessTokenPayload, IRefreshTokenPayload } from "src/types/types";

export class AuthService {
    private secretKey: string;

    constructor() {
        this.secretKey = process.env.NEXT_PUBLIC_ENV_SECRETKEY || "";
        this.validateSecretKey();
    }

    private validateSecretKey(): void {
        if (!this.secretKey || this.secretKey.length < 5) {
            throw new Error("Invalid secret key configuration. Check environment variables!");
        }
    }

    createAccessToken = ({ userId, role }: IAccessTokenPayload): string =>
        sign({ userId, role }, this.secretKey, { expiresIn: "15m" });

    createRefreshToken = ({ userId, tokenversion }: IRefreshTokenPayload): string =>
        sign({ userId, tokenversion }, this.secretKey, { expiresIn: "7d" });

    assignTokens = (userId: string, role: string, tokenversion: number): { accessToken: string, refreshToken: string } => ({
        accessToken: this.createAccessToken({ userId, role }),
        refreshToken: this.createRefreshToken({ userId, tokenversion }),
    });

    refreshTokens = async (refreshToken: string): Promise<{ user: any, accessToken: string, refreshToken: string }> => {
        try {
            const { userId, tokenversion } = verify(refreshToken, this.secretKey) as IRefreshTokenPayload;

            const user = await prisma.user.findFirst({ where: { id: userId } });

            if (!user || user.tokenversion !== tokenversion) { throw new Error("Invalid token. Please register or sign in"); }

            const { id, role } = user;

            return { user, ...this.assignTokens(id, role, tokenversion) };
        }
        catch (error) {
            throw new Error(`Invalid or expired refresh token: ${(error as Error).message}`);
        }
    };

    argonVerify = async (existingPassword: string, verifPassword: string): Promise<boolean> =>
        argon2.verify(existingPassword, verifPassword);

    getConfirmationCode = (email: string): string =>
        sign({ email, timestamp: Date.now() }, this.secretKey, { expiresIn: "1d" });

    verifyRefreshToken = async (token: string): Promise<{ userId: string } | null> => {
        try {
            const payload = verify(token, this.secretKey) as { userId: string, tokenversion: number, iat: number, exp: number };

            return { userId: payload.userId };
        }
        catch (_error) {
            return null;
        }
    };
}
