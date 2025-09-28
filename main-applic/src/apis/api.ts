import { getCookie } from "cookies-next/server";
import { createEvent, sample } from "effector";
import ky, { type BeforeErrorHook, type KyResponse, type HTTPError, type BeforeRequestHook, type BeforeRetryHook, type KyInstance } from "ky";
import router from "next/router";
import { $visitor, logoutFx, userRefreshFx } from "src/models/user-state";
import type { IUser } from "src/services/databaseService";
import type { ILoginResponse } from "src/types/types";

const apiUrl = process.env.NEXT_PUBLIC_BASE_PATH?.length > 0 ? "/ui/api/" : "/api/";

const beforeRequest: BeforeRequestHook = (request) => {
    const initiateBeforeRequest = createEvent();

    sample({
        clock: initiateBeforeRequest,
        source: $visitor,
        fn: (user: IUser) => {
            const accessToken = user?.accessToken;

            if (accessToken) {
                request.headers.set("Authorization", `Bearer ${accessToken}`);
                request.headers.set("Access-Control-Allow-Origin", "*");
            };
        },
    });

    initiateBeforeRequest();
};

const beforeError: BeforeErrorHook = async (error) => {
    const { response } = error;

    if (response?.body) {
        const { name, message } = response as unknown as HTTPError;

        error.name = name;
        error.message = message;
    }

    return error;
};

const beforeRetry: BeforeRetryHook = async () => {
    const currentRefreshToken = await getCookie("refreshToken");

    if (currentRefreshToken) {
        let currentUser: IUser;

        const initiateBeforeRetry = createEvent();

        sample({
            clock: initiateBeforeRetry,
            source: $visitor,
            fn: (user: IUser) => { currentUser = user; },
        });

        initiateBeforeRetry();

        const refresh: KyResponse = await ky.post(`${apiUrl}user-auth/refresh`, { headers: { Authorization: `Bearer ${currentRefreshToken}` } });
        const tokens: ILoginResponse = await refresh?.json();
        const updatedUser = { ...currentUser, ...tokens };

        await userRefreshFx({ updatedUser });
    }
    else {
        await logoutFx();
        await router.push("/");
    }
};

export const apiRoot: KyInstance = ky.create({
    prefixUrl: apiUrl,
    credentials: "include",
    headers: {
        "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
    },
    retry: {
        limit: 3,
        methods: ["get", "post", "patch", "put"],
        statusCodes: [403],
        backoffLimit: 3000,
    },
    hooks: {
        beforeRequest: [beforeRequest],
        beforeError: [beforeError],
        beforeRetry: [beforeRetry],
    },
});
