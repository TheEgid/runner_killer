/* eslint-disable @typescript-eslint/explicit-function-return-type */
import ky, { HTTPError } from "ky";

const API_BASE
    = typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "http://127.0.0.1:4200/api"
        : "/api/python";

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
    deployment_id?: string
}

export type Result<T> = { data?: T, error?: PrefectError };

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

// --- API wrappers
export const getDeploymentId = (name: string) =>
    request(async () => {
        const deployments = await ky
            .post(`${API_BASE}/deployments/filter`, { json: { name: { any_: [name] } } })
            .json<{ id: string, name: string }[]>();

        return deployments.find((d) => d.name === name)?.id ?? null;
    }, "Failed to fetch deployment");

export const createFlowRun = (deploymentId: string, params = {}) =>
    request(async () => {
        const res = await ky
            .post(`${API_BASE}/deployments/${deploymentId}/create_flow_run`, { json: { parameters: params } })
            .json<{ id: string }>();

        return res.id;
    }, "Failed to create flow run");

export const getFlowRun = (id: string) =>
    request(() => ky.get(`${API_BASE}/flow_runs/${id}`).json(), "Failed to get flow run");

// 🔥 теперь по умолчанию cascade = true
export const deleteFlowRun = (id: string, cascade = true) =>
    request(async () => {
        await ky.delete(`${API_BASE}/flow_runs/${id}`, { searchParams: { cascade: String(cascade) } });
        return true;
    }, "Failed to delete flow run");

export const deleteFlowRuns = (ids: string[], cascade = true) =>
    Promise.all(ids.map((id) => deleteFlowRun(id, cascade)));

export const cancelFlowRun = (id: string) =>
    request(async () => {
        await ky.post(`${API_BASE}/flow_runs/${id}/cancel`);
        return true;
    }, "Failed to cancel flow run");

export const setFlowRunState = (id: string, state: string) =>
    request(async () => {
        await ky.post(`${API_BASE}/flow_runs/${id}/set_state`, { json: { state: { type: state } } });
        return true;
    }, "Failed to set flow run state");

export const getFlowRuns = (limit = 50) =>
    request(() => ky.post(`${API_BASE}/flow_runs/filter`, { json: { limit, sort: "START_TIME_DESC" } }).json(), "Failed to fetch flow runs");

export const getLogs = (runId: string, startTime?: Date) =>
    request(async () => {
        const logs = await ky
            .post(`${API_BASE}/logs/filter`, { json: { flow_run_id: { any_: [runId] }, limit: 100, sort: "TIMESTAMP_DESC" } })
            .json<any[]>();

        return logs.filter((log) => !startTime || new Date(log.timestamp) >= startTime);
    }, "Failed to fetch logs");

export const getFlowRunGraph = (id: string) =>
    request(() => ky.get(`${API_BASE}/flow_runs/${id}/graph`).json(), "Failed to fetch flow run graph");
