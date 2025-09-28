import { type user, PrismaClient } from "../../prisma/generated/prisma-client/client";
import type { ILoginResponse } from "src/types/types";

export type IUser = user & ILoginResponse;

const DATABASE_URL = process.platform === "win32"
    ? "file:./../prisma/database-sql-lite.db"
    : process.env.DATABASE_URL;

if (!DATABASE_URL) { throw new Error("DATABASE_URL не задан. Проверь .env"); }

const prisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
    log: ["warn", "error", "info", "query"],
    // log: process.env.NODE_ENV === "development" ? ["warn", "error", "info", "query"] : ["error"],
    // log: ["error"],
});

if (process.env.NODE_ENV === "development") {
    global.prisma = prisma;
}

export default prisma;
