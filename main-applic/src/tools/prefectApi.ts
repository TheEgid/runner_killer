/* eslint-disable @typescript-eslint/explicit-function-return-type */
import ky, { HTTPError } from "ky";

const API_BASE
    = typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "http://127.0.0.1:4200/api"
        : "/api/python";

// --- Types ---
export interface LogEntry {
    message: string,
    timestamp: string,
    level?: string,
    flow_run_id?: string
}

export interface PrefectError {
    message: string,
    status?: number
}

export interface FlowRun {
    id: string,
    state: { type: string, timestamp?: string },
    deployment_id?: string,
    name?: string
}

export interface TaskRun {
    id: string,
    name: string,
    state: { type: string },
    flow_run_id: string
}

export type Result<T> = { data?: T, error?: PrefectError };

// --- Helpers ---
const handleError = (e: unknown, fallback: string): PrefectError =>
    e instanceof HTTPError
        ? { message: e.message, status: e.response.status }
        : { message: (e as Error).message || fallback };

async function request<T>(fn: () => Promise<T>, fallback: string): Promise<Result<T>> {
    try {
        return { data: await fn() };
    }
    catch (e) {
        return { error: handleError(e, fallback) };
    }
}

// --- Cancel flow + all tasks ---
export async function abortFlowRunCompletely(id: string): Promise<Result<boolean>> {
    try {
    // 1. Получаем task runs для flow run
        const taskRuns: TaskRun[] = await ky
            .post(`${API_BASE}/task_runs/filter`, {
                json: { "flow_run.id": { any_: [id] } },
            })
            .json<TaskRun[]>();

        // 2. Отменяем все task runs
        await Promise.all(
            taskRuns.map((t) =>
                ky.post(`${API_BASE}/task_runs/${t.id}/set_state`, {
                    json: { state: { type: "Cancelled", message: "Cancelled via API" } },
                }),
            ),
        );

        // 3. Отменяем сам flow run
        await ky.post(`${API_BASE}/flow_runs/${id}/set_state`, {
            json: { state: { type: "Cancelled", message: "Cancelled via API" } },
        });

        return { data: true };
    }
    catch (e) {
        if (e instanceof HTTPError && e.response.status === 404) {
            return { error: { message: "Flow run или task run не найден (404)", status: 404 } };
        }
        return { error: { message: (e as Error).message || "Неизвестная ошибка" } };
    }
}

// --- API ---
export const prefectAPI = {
    deployments: {
        getById: (name: string) =>
            request(async () => {
                const deployments = await ky
                    .post(`${API_BASE}/deployments/filter`, { json: { name: { any_: [name] } } })
                    .json<{ id: string, name: string }[]>();

                return deployments.find((d) => d.name === name)?.id ?? null;
            }, "Failed to fetch deployment"),

        createRun: (deploymentId: string, params = {}) =>
            request(async () => {
                const res = await ky
                    .post(`${API_BASE}/deployments/${deploymentId}/create_flow_run`, { json: { parameters: params } })
                    .json<{ id: string }>();

                return res.id;
            }, "Failed to create flow run"),
    },

    flowRuns: {
        get: (id: string) => request(() => ky.get(`${API_BASE}/flow_runs/${id}`).json<FlowRun>(), "Failed to get flow run"),

        cancelCompletely: (id: string) => request(() => abortFlowRunCompletely(id), "Failed to abort flow run completely"),

        delete: (id: string, cascade = true) =>
            request(() => ky.delete(`${API_BASE}/flow_runs/${id}`, { searchParams: { cascade: String(cascade) } }), "Failed to delete flow run"),

        setState: (id: string, state: string) =>
            request(() => ky.post(`${API_BASE}/flow_runs/${id}/set_state`, { json: { state: { type: state } } }), "Failed to set flow run state"),
    },

    logs: {
        get: (runId: string, limit = 100, startTime?: Date) =>
            request(async () => {
                const logs = await ky
                    .post(`${API_BASE}/logs/filter`, { json: { flow_run_id: { any_: [runId] }, limit, sort: "TIMESTAMP_DESC" } })
                    .json<LogEntry[]>();

                return startTime ? logs.filter((l) => new Date(l.timestamp) >= startTime) : logs;
            }, "Failed to fetch logs"),
    },
};

// --- Legacy aliases ---
export const getDeploymentId = prefectAPI.deployments.getById;
export const createFlowRun = prefectAPI.deployments.createRun;
export const getFlowRun = prefectAPI.flowRuns.get;
export const cancelFlowRunCompletely = prefectAPI.flowRuns.cancelCompletely;
export const deleteFlowRun = prefectAPI.flowRuns.delete;
export const setFlowRunState = prefectAPI.flowRuns.setState;
export const getLogs = prefectAPI.logs.get;
