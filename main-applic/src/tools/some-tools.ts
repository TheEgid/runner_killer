import dayjs from "dayjs";
import type { KyResponse } from "ky";

export const getBlob = async (file: KyResponse): Promise<Blob> => file.blob();

const allMonths = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

export const toDateRu = (inputDate: string, _keyValue?: string): string => {
    if (inputDate?.length > 30) { inputDate = dayjs(inputDate).format("YYYY-MM-DD"); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inputDate)) { return ""; }

    const [year, month, day] = inputDate.split("-");
    const monthIndex = Number(month) - 1;

    if (monthIndex < 0 || monthIndex >= allMonths.length) { return ""; }

    return `«${day}» ${allMonths[monthIndex]} ${year} г.`;
};

export const isEmail = (email: string): boolean => {
    const pattern = /^[a-zA-Z0-9]+([._%+-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

    return pattern.test(email);
};

export const isWindows = (): boolean => process.platform.indexOf("win32") !== -1;

export const waitFor = (delay: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, delay));

export const toBool = (str: string): boolean | string => {
    if (!["ИСТИНА", "ЛОЖЬ"].includes(str)) { return str; }
    return str === "ИСТИНА";
};

export const splitByEqualsSorted = (input: string): string[] => {
    const regex = /(\S+)=([^=]+?(?=\s\S+=|$))/g;
    const result = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
        result.add(match[0]);
    }

    return Array.from(result).sort((a, b) => {
        const keyA = a.split("=").at(0);
        const keyB = b.split("=").at(0);

        return keyA.localeCompare(keyB);
    });
};

export const fixBooleanValue = (key: string, value: any): any => {
    if (!key.startsWith("is")) { return value; }
    return value === true ? "1" : "0";
};

export const excelDateToJsDate = (date: string): string => {
    const excelEpoch = 25569; // Эпоха Excel начинается с 1899-12-30
    const millisecondsPerDay = 86400 * 1000; // Переводим дни в миллисекунды
    const parsedDate = parseInt(date, 10);

    if (isNaN(parsedDate) || parsedDate < 1) { return ""; }
    const jsDate = new Date(Math.round((parsedDate - excelEpoch) * millisecondsPerDay));

    if (jsDate.getFullYear() < 1900) { return ""; }
    return jsDate.toISOString().split("T")[0]; // Возвращаем дату в формате YYYY-MM-DD
};

export const safeJSONParse = (str: string): unknown => {
    if (!str || typeof str !== "string") { return null; }
    try {
        const parsed = JSON.parse(str);

        return typeof parsed === "object" && parsed !== null ? parsed : null;
    }
    catch {
        return null;
    }
};

export const cleanFileName = (fileName: string): string => {
    try {
        const cleanEdges = (input: string): string => {
            let mod = input;

            while (mod.startsWith("_") || mod.startsWith("-")) {
                mod = mod.slice(1);
            }
            while (mod.endsWith("_") || mod.endsWith("-")) {
                mod = mod.slice(0, -1);
            }
            return mod;
        };

        const clearSymbls = (input: string): string => {
            if (!input) { return ""; } // Handle null or undefined input
            let mod = input.toLocaleLowerCase();

            mod = mod.replace(/[^a-zа-я0-9_\-.]/gi, "_"); // Replace all not allowed symbols
            mod = mod.replace(/-+/g, "_"); // Replace all double dashes
            mod = mod.replace(/_+/g, "_"); // Replace all double underscores

            mod = mod.replace(/[\n\r\t\s]+/g, " ").replace(/\s{2,}/g, " ").trim();
            return mod;
        };

        const transliterate = (text: string): string =>
            text
                .replace(/\u0401/g, "YO")
                .replace(/\u0419/g, "I")
                .replace(/\u0426/g, "TS")
                .replace(/\u0423/g, "U")
                .replace(/\u041A/g, "K")
                .replace(/\u0415/g, "E")
                .replace(/\u041D/g, "N")
                .replace(/\u0413/g, "G")
                .replace(/\u0428/g, "SH")
                .replace(/\u0429/g, "SCH")
                .replace(/\u0417/g, "Z")
                .replace(/\u0425/g, "H")
                .replace(/\u042A/g, "")
                .replace(/\u0451/g, "yo")
                .replace(/\u0439/g, "i")
                .replace(/\u0446/g, "ts")
                .replace(/\u0443/g, "u")
                .replace(/\u043A/g, "k")
                .replace(/\u0435/g, "e")
                .replace(/\u043D/g, "n")
                .replace(/\u0433/g, "g")
                .replace(/\u0448/g, "sh")
                .replace(/\u0449/g, "sch")
                .replace(/\u0437/g, "z")
                .replace(/\u0445/g, "h")
                .replace(/\u044A/g, "'")
                .replace(/\u0424/g, "F")
                .replace(/\u042B/g, "I")
                .replace(/\u0412/g, "V")
                .replace(/\u0410/g, "a")
                .replace(/\u041F/g, "P")
                .replace(/\u0420/g, "R")
                .replace(/\u041E/g, "O")
                .replace(/\u041B/g, "L")
                .replace(/\u0414/g, "D")
                .replace(/\u0416/g, "ZH")
                .replace(/\u042D/g, "E")
                .replace(/\u0444/g, "f")
                .replace(/\u044B/g, "i")
                .replace(/\u0432/g, "v")
                .replace(/\u0430/g, "a")
                .replace(/\u043F/g, "p")
                .replace(/\u0440/g, "r")
                .replace(/\u043E/g, "o")
                .replace(/\u043B/g, "l")
                .replace(/\u0434/g, "d")
                .replace(/\u0436/g, "zh")
                .replace(/\u044D/g, "e")
                .replace(/\u042F/g, "Ya")
                .replace(/\u0427/g, "CH")
                .replace(/\u0421/g, "S")
                .replace(/\u041C/g, "M")
                .replace(/\u0418/g, "I")
                .replace(/\u0422/g, "T")
                .replace(/\u042C/g, "'")
                .replace(/\u0411/g, "B")
                .replace(/\u042E/g, "YU")
                .replace(/\u044F/g, "ya")
                .replace(/\u0447/g, "ch")
                .replace(/\u0441/g, "s")
                .replace(/\u043C/g, "m")
                .replace(/\u0438/g, "i")
                .replace(/\u0442/g, "t")
                .replace(/\u044C/g, "'")
                .replace(/\u0431/g, "b")
                .replace(/\u044E/g, "yu");

        const cleanedInput = cleanEdges(clearSymbls(fileName));

        return transliterate(cleanedInput);
    }
    catch {
        return "";
    }
};
