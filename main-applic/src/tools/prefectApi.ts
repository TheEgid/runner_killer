import ky, { HTTPError } from "ky";

const API_BASE
    = typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "http://127.0.0.1:4200/api"
        : "/api/python";

export enum LogLevel {
    INFO = "INFO", ERROR = "ERROR", WARNING = "WARNING",
}

export interface Deployment {
    id: string,
    name: string,
    description?: string
}

export interface FlowRun {
    id: string,
    state: { type: string, timestamp?: string },
    deployment_id?: string
}

export interface LogEntry {
    message: string,
    timestamp: string,
    level?: LogLevel,
    flow_run_id?: string
}

export interface PrefectError {
    message: string,
    status?: number
}

// Type guard для ошибок
export const isPrefectError = (obj: any): obj is PrefectError =>
    obj && typeof obj === "object" && "message" in obj;

const handleError = (e: unknown, fallback: string): PrefectError =>
    e instanceof HTTPError
        ? { message: e.message, status: e.response.status }
        : { message: (e as Error).message || fallback };

export const getDeploymentId = async (name: string): Promise<string | PrefectError | null> => {
    try {
        const deployments = await ky.post(`${API_BASE}/deployments/filter`, {
            json: { name: { any_: [name] } },
        }).json<Deployment[]>();

        return deployments.find((d) => d.name === name)?.id ?? null;
    }
    catch (e) {
        return handleError(e, "Failed to fetch deployment");
    }
};

export const createFlowRun = async (deploymentId: string, params = {}): Promise<string | PrefectError> => {
    try {
        const res = await ky.post(`${API_BASE}/deployments/${deploymentId}/create_flow_run`, {
            json: { parameters: params },
        }).json<{ id: string }>();

        return res.id;
    }
    catch (e) {
        return handleError(e, "Failed to create flow run");
    }
};

export const getFlowRun = async (runId: string): Promise<FlowRun | PrefectError> => {
    try {
        return await ky.get(`${API_BASE}/flow_runs/${runId}`).json<FlowRun>();
    }
    catch (e) {
        return handleError(e, "Failed to get flow run");
    }
};

export const getLogs = async (runId: string, startTime?: Date, errorsOnly = false): Promise<LogEntry[] | PrefectError> => {
    try {
        let logs = await ky.post(`${API_BASE}/logs/filter`, {
            json: {
                flow_run_id: { any_: [runId] },
                limit: 100,
                sort: "TIMESTAMP_DESC",
            },
        }).json<LogEntry[]>();

        logs = (logs || []).filter((log) => !startTime || new Date(log.timestamp) >= startTime);
        if (errorsOnly) { logs = logs.filter((log) => log.level === LogLevel.ERROR); }

        return logs;
    }
    catch (e) {
        return handleError(e, "Failed to fetch logs");
    }
};

const deleteFlowRun = async (runId: string): Promise<true | PrefectError> => {
    try {
        await ky.delete(`${API_BASE}/flow_runs/${runId}`);
        return true;
    }
    catch (e) {
        return handleError(e, "Failed to delete flow run");
    }
};

export const stopFlowRun = async (runId: string): Promise<true | PrefectError> => {
    const result = await deleteFlowRun(runId);

    if (isPrefectError(result)) { return result; }

    const flowRun = await getFlowRun(runId);

    if (!isPrefectError(flowRun) && flowRun.state?.type !== "CANCELED") {
        return { message: "Run не остановлен" } as PrefectError;
    }
    return true;
};
