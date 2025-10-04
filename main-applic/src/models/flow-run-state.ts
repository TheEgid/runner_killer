import { createEvent, createStore, sample } from "effector";
import { persist } from "effector-storage/local";
import type { LogEntry } from "src/tools/prefectApi";

// --- Stores ---
export const $runId = createStore<string | null>(null);
export const $status = createStore<string>("NOT_STARTED");
export const $logs = createStore<LogEntry[]>([]);
export const $runtime = createStore<number>(0);

// --- Events ---
export const updateRunId = createEvent<string | null>();
export const updateStatus = createEvent<string>();
export const appendLogs = createEvent<LogEntry[]>();
export const setLogs = createEvent<LogEntry[]>();
export const resetLogs = createEvent<void>();
export const updateRuntime = createEvent<number>();
export const clearAllData = createEvent<void>();

// --- Constants ---
const LOG_LIMIT = 200;

// --- Store updates ---
$runId.on(updateRunId, (_, id) => id);
$status.on(updateStatus, (_, status) => status);

$logs
    .on(appendLogs, (state, newLogs) => {
        if (!newLogs?.length) { return state; }

        const key = (log: LogEntry): string =>
            `${log.flow_run_id ?? "unknown"}-${log.timestamp}-${log.message}`;

        const existingSet = new Set(state.map(key));
        const uniqueNewLogs = newLogs.filter((log) => !existingSet.has(key(log)));

        return [...state, ...uniqueNewLogs].slice(-LOG_LIMIT);
    })
    .on(setLogs, (_, logs) => logs.slice(-LOG_LIMIT))
    .on(resetLogs, () => []);

$runtime.on(updateRuntime, (_, runtime) => runtime);

// --- Очистка всех данных через sample ---
sample({
    clock: clearAllData,
    target: [
        updateRunId.prepend(() => null),
        updateStatus.prepend(() => "NOT_STARTED"),
        resetLogs,
        updateRuntime.prepend(() => 0),
    ],
});

// --- Persist (сохраняем/загружаем автоматически на клиенте) ---
persist({ store: $runId, key: "flowRunId" });
persist({ store: $status, key: "flowStatus" });
persist({ store: $logs, key: "flowLogs" });
persist({ store: $runtime, key: "flowRuntime" });
