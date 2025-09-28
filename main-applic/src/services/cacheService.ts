import Redis from "ioredis";
import NodeCache from "node-cache";

const isWindows = process.platform === "win32";

let redisClient: Redis | null = null;

if (!isWindows) {
    if (process.env.REDIS_PASSW) {
        redisClient = new Redis(`redis://default:${process.env.REDIS_PASSW}@redis:6379`);
        redisClient.on("error", (err) => {
            console.error("Redis error:", err);
        });
    }
    else {
        redisClient = undefined;
    }
}

const localCache = new NodeCache();

const isEmptyValue = (value: any): boolean => {
    if (value === null || value === undefined) { return true; }
    if (typeof value === "string" && value.trim() === "") { return true; }
    if (Array.isArray(value) && value.length === 0) { return true; }
    if (typeof value === "object" && Object.keys(value).length === 0) { return true; }
    return false;
};

export const cacheSet = async (key: string, value: any, ttlSeconds = 259200): Promise<void> => {
    if (isEmptyValue(value)) {
        console.warn(`⚠️ Skipping cacheSet: value for key "${key}" is empty.`);
        return;
    }
    if (!isWindows && redisClient) {
        try {
            await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
        }
        catch (error) {
            console.error(`cacheSet error for key "${key}":`, error);
        }
    }
    else {
        localCache.set(key, value, ttlSeconds);
    }
};

export const cacheGet = async <T = any>(key: string): Promise<T | null> => {
    if (!isWindows && redisClient) {
        const data = await redisClient.get(key);

        if (!data) {
            return null;
        }
        try {
            return JSON.parse(data) as T;
        }
        catch (error) {
            console.error(`cacheGet JSON.parse error for key "${key}":`, error);
            return null;
        }
    }
    else {
        return localCache.get<T>(key) || null;
    }
};
