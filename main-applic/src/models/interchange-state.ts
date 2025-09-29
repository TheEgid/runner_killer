import { createEffect, createStore, sample } from "effector";
// import { type Fail, persist } from "effector-storage/local";
import { apiRoot } from "src/apis/api";
import { messageNotify } from "src/components/common/Common";

// export interface IFileItem {
//     name: string,
//     size: number,
//     createdAt?: string
// }

export const $files = createStore<string[]>([], { skipVoid: false });

// --- Effects ---

export const fetchFilesFx = createEffect(async () => {
    try {
        const response = await apiRoot.get("interchange/list");
        const data: { files: string[] } = await response.json();
        const files = Array.isArray(data.files) ? data.files : [];

        return files;
    }
    catch (error) {
        throw new Error(`Fetch files failed: ${(error as Error).message || ""}`);
    }
});

export const deleteFileFx = createEffect(async (fileName: string) => {
    try {
        const response = await apiRoot.delete(`interchange/delete/${encodeURIComponent(fileName)}`);
        const result: { success: boolean, message?: string } = await response?.json();

        if (!result.success) {
            await Promise.reject(new Error(result.message || "File not deleted"));
        }

        return fileName;
    }
    catch (error) {
        throw new Error(`Delete file failed: ${(error as Error).message || ""}`);
    }
});

// --- Notifications ---

// const displayFetchErrorFx = createEffect((error: Error) => {
//     messageNotify({ message: `Ошибка загрузки файлов: ${error.message}`, isError: true });
// });

const displayDeleteSuccessFx = createEffect((fileName: string) => {
    messageNotify({ message: `Файл "${fileName}" удалён` });
});

const displayDeleteErrorFx = createEffect((error: Error) => {
    messageNotify({ message: `Ошибка удаления файла: ${error.message}`, isError: true });
});

// --- Bindings ---

sample({
    clock: fetchFilesFx.doneData,
    target: $files,
});

// sample({
//     clock: fetchFilesFx.failData,
//     target: displayFetchErrorFx,
// });

sample({
    clock: deleteFileFx.doneData,
    target: [displayDeleteSuccessFx, $files],
});

sample({
    clock: deleteFileFx.failData,
    target: displayDeleteErrorFx,
});

// Обновляем стор после удаления
$files.on(deleteFileFx.doneData, (files, fileName) =>
    files.filter((f) => f !== fileName),
);

// // --- Persistence (опционально) ---
// persist({
//     store: $files,
//     key: "files",
//     fail: createEvent<Fail<Error>>(),
// });
