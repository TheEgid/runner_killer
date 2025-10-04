import ky, { HTTPError, type KyResponse } from "ky";

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

export async function abortFlowRunCompletely(id: string): Promise<Result<boolean>> {
    try {
        const taskRuns: TaskRun[] = await ky
            .post(`${API_BASE}/task_runs/filter`, {
                json: { flow_run_id: { any_: [id] } },
            })
            .json<TaskRun[]>();

        await Promise.allSettled(
            taskRuns.map(async (taskRun) => {
                try {
                    await ky.post(`${API_BASE}/task_runs/${taskRun.id}/set_state`, {
                        json: {
                            state: { type: "CANCELLED", name: "Cancelled" },
                            force: true,
                        },
                    });
                }
                catch (_e) {
                    // Игнорируем ошибки отмены отдельных задач
                }
            }),
        );

        await ky.post(`${API_BASE}/flow_runs/${id}/set_state`, {
            json: {
                state: { type: "CANCELLED", name: "Cancelled" },
                force: true,
            },
        });

        return { data: true };
    }
    catch (e) {
        if (e instanceof HTTPError) {
            if (e.response.status === 404) {
                return { error: { message: "Flow run не найден", status: 404 } };
            }
            return { error: {
                message: `HTTP Error: ${e.response.status}`,
                status: e.response.status,
            } };
        }

        return { error: {
            message: (e as Error).message || "Неизвестная ошибка",
        } };
    }
}

export const prefectAPI = {
    deployments: {
        getById: (name: string): Promise<any> =>
            request(async () => {
                const deployments = await ky
                    .post(`${API_BASE}/deployments/filter`, { json: { name: { any_: [name] } } })
                    .json<{ id: string, name: string }[]>();

                return deployments.find((d) => d.name === name)?.id ?? null;
            }, "Failed to fetch deployment"),

        createRun: (deploymentId: string, params = {}): Promise<any> =>
            request(async () => {
                const res = await ky
                    .post(`${API_BASE}/deployments/${deploymentId}/create_flow_run`, { json: { parameters: params } })
                    .json<{ id: string }>();

                return res.id;
            }, "Failed to create flow run"),
    },

    flowRuns: {
        get: (id: string): Promise<Result<FlowRun>> => request(() => ky.get(`${API_BASE}/flow_runs/${id}`).json<FlowRun>(), "Failed to get flow run"),

        cancelCompletely: (id: string): Promise<Result<Result<boolean>>> => request(() => abortFlowRunCompletely(id), "Failed to abort flow run completely"),

        delete: (id: string, cascade = true): Promise<Result<KyResponse<unknown>>> =>
            request(() => ky.delete(`${API_BASE}/flow_runs/${id}`, { searchParams: { cascade: String(cascade) } }), "Failed to delete flow run"),

        setState: (id: string, state: string): Promise<Result<KyResponse<unknown>>> =>
            request(() => ky.post(`${API_BASE}/flow_runs/${id}/set_state`, { json: { state: { type: state } } }), "Failed to set flow run state"),
    },

    fetchLogs: {
        // ВАЖНО: поддержка массива runIds
        get: (runIds: string | string[], limit = 200): Promise<Result<LogEntry[]>> =>
            request(async () => {
                const ids = Array.isArray(runIds) ? runIds : [runIds];

                const allLogs: LogEntry[] = [];
                let offset = 0;
                const step = 200;

                while (limit > 0) {
                    const query: Record<string, any> = {
                        flow_run_id: { any_: ids },
                        limit: Math.min(step, limit),
                        order_by: [{ timestamp: "ASC" }],
                        offset,
                    };

                    const logs = await ky
                        .post(`${API_BASE}/logs/filter`, { json: query })
                        .json<LogEntry[]>();

                    if (!logs.length) { break; }

                    allLogs.push(...logs); // <- ранее было закомментировано
                    offset += logs.length;
                    limit -= logs.length;
                }

                return allLogs.slice(-200); // ограничиваем последние 200 логов
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
export const getPrefectLogs = prefectAPI.fetchLogs.get;
