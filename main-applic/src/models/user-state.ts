import { createEffect, createEvent, createStore, sample } from "effector";
import { type Fail, persist } from "effector-storage/local";
import { apiRoot } from "src/apis/api";
import { messageNotify } from "src/components/common/Common";
import type { IUser } from "src/services/databaseService";

export const $visitor = createStore<IUser | undefined>(undefined, { skipVoid: false });

export const userRegisterFx = createEffect(async (params: { email: string, password: string }) => {
    try {
        const response = await apiRoot.post("user-auth/register", { json: params });
        const user: IUser = await response?.json();

        return user.accessToken ? user : Promise.reject(new Error("Invalid user data"));
    }
    catch (error) {
        throw new Error(`Registration failed: ${(error as Error).message || ""}`);
    }
});

export const userLoginFx = createEffect(async (params: { email: string, password: string }) => {
    try {
        const response = await apiRoot.post("user-auth/login", { json: params });
        const user: IUser = await response?.json();

        return user.accessToken ? user : Promise.reject(new Error("Invalid user data"));
    }
    catch (error) {
        throw new Error(`Login failed: ${(error as Error).message || ""}`);
    }
});

export const userRefreshFx = createEffect((params: { updatedUser: IUser }) => {
    if ("accessToken" in params.updatedUser) {
        return params.updatedUser;
    }
    throw new Error("User token missing");
});

export const userLogoutFx = createEffect(async () => {
    try {
        const response = await apiRoot.put("user-auth/logout");
        const res: { message: string } = await response?.json();

        if (!res.message) { await Promise.reject(new Error("Invalid data")); }
    }
    catch (error) {
        throw new Error(`Logout failed: ${(error as Error).message || ""}`);
    }
});

const displayLoginSuccessFx = createEffect((user: IUser) => {
    messageNotify({ message: `Вы вошли как ${user.email}` });
});

const displayRegisterSuccessFx = createEffect((user: IUser) => {
    if (user.email) { messageNotify({ message: `Вы зарегистрировались как ${user.email}` }); }
});

sample({
    clock: userLoginFx.doneData,
    target: [$visitor, displayLoginSuccessFx.prepend((userData: IUser) => userData)],
});

sample({
    clock: userRegisterFx.doneData,
    target: [$visitor, displayRegisterSuccessFx.prepend((userData: IUser) => userData)],
});

const displayErrorFx = createEffect((error: Error) => {
    messageNotify({ message: `Ошибка: ${error.message}`, isError: true }); ;
});

sample({
    clock: userRefreshFx.doneData,
    target: $visitor,
});

sample({
    clock: userLoginFx.failData,
    target: displayErrorFx,
});

sample({
    clock: userRegisterFx.failData,
    target: displayErrorFx,
});

export const logoutFx = createEffect(async () => {
    await userLogoutFx();
    await new Promise((resolve) => setTimeout(resolve, 10));
});

sample({
    clock: logoutFx.doneData,
    fn: () => undefined,
    target: $visitor.reset(),
});

persist({
    store: $visitor,
    key: "visitor",
    fail: createEvent<Fail<Error>>(),
});
