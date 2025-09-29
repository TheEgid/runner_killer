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

// --- Core request handler ---
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

// --- Suspend + Cancel helpers ---
async function suspendFlowRun(id: string) {
    try {
        await ky.get(`${API_BASE}/flow_runs/${id}`);
        await ky.post(`${API_BASE}/flow_runs/${id}/set_state`, {
            json: { state: { type: "SUSPENDED" } },
        });
        return { success: true };
    }
    catch (e) {
        if (e instanceof HTTPError && e.response.status === 404) { return { success: false, error: "Flow run не найден (404)" }; }
        return { success: false, error: (e as Error).message || "Неизвестная ошибка" };
    }
}

async function cancelFlowRunSafe(id: string) {
    const suspendResult = await suspendFlowRun(id);

    if (!suspendResult.success) { return suspendResult; }

    try {
        await ky.post(`${API_BASE}/flow_runs/${id}/cancel`);
        return { success: true };
    }
    catch (e) {
        if (e instanceof HTTPError && e.response.status === 404) { return { success: false, error: "Flow run не найден (404)" }; }
        return { success: false, error: (e as Error).message || "Неизвестная ошибка" };
    }
}

async function cancelFlowRunWithDependenciesSafe(id: string) {
    const suspendResult = await suspendFlowRun(id);

    if (!suspendResult.success) { return suspendResult; }

    try {
        await ky.post(`${API_BASE}/flow_runs/${id}/cancel`);

        const taskRuns: TaskRun[] = await ky
            .post(`${API_BASE}/task_runs/filter`, { json: { flow_run_id: { any_: [id] } } })
            .json();

        await Promise.all(taskRuns.map((t) => ky.post(`${API_BASE}/task_runs/${t.id}/cancel`)));
        return { success: true };
    }
    catch (e) {
        if (e instanceof HTTPError && e.response.status === 404) { return { success: false, error: "Flow run или task run не найден (404)" }; }
        return { success: false, error: (e as Error).message || "Неизвестная ошибка" };
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
        list: (limit = 50, sort = "START_TIME_DESC") =>
            request(() => ky.post(`${API_BASE}/flow_runs/filter`, { json: { limit, sort } }).json<FlowRun[]>(), "Failed to fetch flow runs"),

        cancel: (id: string) => request(() => cancelFlowRunSafe(id), "Failed to cancel flow run"),
        cancelWithDependencies: (id: string) =>
            request(() => cancelFlowRunWithDependenciesSafe(id), "Failed to cancel flow run with dependencies"),

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

    graph: {
        get: (flowRunId: string) =>
            request(() => ky.get(`${API_BASE}/flow_runs/${flowRunId}/graph`).json(), "Failed to fetch flow run graph"),
    },
};

// --- Legacy aliases ---
export const getDeploymentId = prefectAPI.deployments.getById;
export const createFlowRun = prefectAPI.deployments.createRun;
export const getFlowRun = prefectAPI.flowRuns.get;
export const getFlowRuns = prefectAPI.flowRuns.list;
export const cancelFlowRun = prefectAPI.flowRuns.cancel;
export const cancelFlowRunWithDependencies = prefectAPI.flowRuns.cancelWithDependencies;
export const deleteFlowRun = prefectAPI.flowRuns.delete;
export const setFlowRunState = prefectAPI.flowRuns.setState;
export const getLogs = prefectAPI.logs.get;
export const getFlowRunGraph = prefectAPI.graph.get;

// Batch operations
export const deleteFlowRuns = (ids: string[], cascade = true) =>
    Promise.all(ids.map((id) => prefectAPI.flowRuns.delete(id, cascade)));
