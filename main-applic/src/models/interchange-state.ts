import { createEffect, createEvent, createStore, sample } from "effector";
import { apiRoot } from "src/apis/api";
import { messageNotify } from "src/components/common/Common";

interface FilesResponse {
    files: string[]
}

interface DeleteResponse {
    success: boolean,
    message?: string
}

export const $files = createStore<string[]>([]);

export const startDownloadFile = createEvent<string>();

export const fetchFilesFx = createEffect(async (): Promise<string[]> => {
    try {
        const response = await apiRoot.get("interchange/list");

        if (!response.ok) {
            const errorText = await response.text();

            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data: FilesResponse = await response.json();

        if (!data || !Array.isArray(data.files)) {
            console.warn("Invalid API response:", data);
            return [];
        }

        return data.files;
    }
    catch (error) {
        console.error("Fetch files error:", error);
        throw new Error(`Fetch files failed: ${(error as Error).message || "Unknown error"}`);
    }
});

export const deleteFileFx = createEffect(async (fileName: string): Promise<string> => {
    try {
        const response = await apiRoot.put(`interchange?file=${encodeURIComponent(fileName)}`);

        if (!response.ok) {
            const errorText = await response.text();

            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result: DeleteResponse = await response.json();

        if (!result.success) {
            throw new Error(result.message || "File deletion failed");
        }

        return fileName;
    }
    catch (error) {
        throw new Error(`Delete file failed: ${(error as Error).message}`);
    }
});

export const downloadFileFx = createEffect(async (fileName: string) => {
    const response = await apiRoot.post(`interchange?file=${encodeURIComponent(fileName)}`);

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(`Download failed: ${response.status} ${errorText}`);
    }

    const blob = await response.blob();

    if (blob.size === 0) {
        throw new Error("Downloaded file is empty");
    }

    const contentDisposition = response.headers.get("Content-Disposition") || "";
    const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/);
    const filename = filenameMatch?.[1]?.replace(/"/g, "") || fileName || "downloaded_file";

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
});

const displayDeleteSuccessFx = createEffect((fileName: string) => {
    messageNotify({ message: `Файл "${fileName}" удалён`, isError: false });
});

const displayDeleteErrorFx = createEffect((error: Error) => {
    messageNotify({ message: `Ошибка удаления файла: ${error.message}`, isError: true });
});

const displayDownloadErrorFx = createEffect((error: Error) => {
    messageNotify({ message: `Ошибка скачивания файла: ${error.message}`, isError: true });
});

const displayFetchErrorFx = createEffect((error: Error) => {
    messageNotify({ message: `Ошибка загрузки списка файлов: ${error.message}`, isError: true });
});

sample({
    clock: fetchFilesFx.doneData,
    target: $files,
});

sample({
    clock: fetchFilesFx.fail,
    fn: () => [],
    target: $files,
});

sample({
    clock: fetchFilesFx.failData,
    target: displayFetchErrorFx,
});

$files.on(deleteFileFx.doneData, (files, fileName) =>
    files.filter((f) => f !== fileName),
);

sample({
    clock: deleteFileFx.doneData,
    target: displayDeleteSuccessFx,
});

sample({
    clock: deleteFileFx.failData,
    target: displayDeleteErrorFx,
});

sample({
    clock: startDownloadFile,
    target: downloadFileFx,
});

sample({
    clock: downloadFileFx.failData,
    target: displayDownloadErrorFx,
});
