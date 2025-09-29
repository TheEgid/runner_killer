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
    const startTime = Date.now();

    console.log(`🚀 [${new Date().toISOString()}] START abortFlowRunCompletely for flow run: ${id}`);

    try {
        // 1. Получаем все task runs для данного flow run
        console.log(`📋 [${new Date().toISOString()}] Step 1: Fetching task runs for flow run ${id}`);
        console.log(`🌐 [${new Date().toISOString()}] Making API call: POST ${API_BASE}/task_runs/filter`);

        const taskRuns: TaskRun[] = await ky
            .post(`${API_BASE}/task_runs/filter`, {
                json: {
                    flow_run_id: { any_: [id] },
                },
            })
            .json<TaskRun[]>();

        console.log(`✅ [${new Date().toISOString()}] Successfully fetched ${taskRuns.length} task runs`);
        console.log(`📊 [${new Date().toISOString()}] Task runs details:`, {
            total: taskRuns.length,
            running: taskRuns.filter((t) => t.state.type === "RUNNING").length,
            completed: taskRuns.filter((t) => t.state.type === "COMPLETED").length,
            cancelled: taskRuns.filter((t) => t.state.type === "CANCELLED").length,
            failed: taskRuns.filter((t) => t.state.type === "FAILED").length,
            taskRunIds: taskRuns.map((t) => t.id),
        });

        // 2. Принудительно отменяем все task runs
        console.log(`🔄 [${new Date().toISOString()}] Step 2: Starting cancellation of ${taskRuns.length} task runs`);

        const taskCancellationResults = await Promise.allSettled(
            taskRuns.map(async (taskRun, index) => {
                const taskStartTime = Date.now();

                console.log(`🔧 [${new Date().toISOString()}] Cancelling task run ${index + 1}/${taskRuns.length}: ${taskRun.id} (${taskRun.name})`);
                console.log(`📝 [${new Date().toISOString()}] Task ${taskRun.id} current state: ${taskRun.state.type}`);

                try {
                    await ky.post(`${API_BASE}/task_runs/${taskRun.id}/set_state`, {
                        json: {
                            state: {
                                type: "CANCELLED",
                                name: "Cancelled",
                            },
                            force: true,
                        },
                    });

                    const taskDuration = Date.now() - taskStartTime;

                    console.log(`✅ [${new Date().toISOString()}] Successfully cancelled task run ${taskRun.id} in ${taskDuration}ms`);
                    return { success: true, taskId: taskRun.id, duration: taskDuration };

                }
                catch (taskError) {
                    const taskDuration = Date.now() - taskStartTime;

                    console.error(`❌ [${new Date().toISOString()}] Failed to cancel task run ${taskRun.id} after ${taskDuration}ms:`, {
                        error: taskError instanceof Error ? taskError.message : String(taskError),
                        taskId: taskRun.id,
                        taskName: taskRun.name,
                        currentState: taskRun.state.type,
                    });
                    return { success: false, taskId: taskRun.id, error: taskError, duration: taskDuration };
                }
            }),
        );

        // Анализ результатов отмены задач
        const successfulTasks = taskCancellationResults.filter((r) => r.status === "fulfilled" && r.value.success);
        const failedTasks = taskCancellationResults.filter((r) => r.status === "fulfilled" && !r.value.success);
        const rejectedTasks = taskCancellationResults.filter((r) => r.status === "rejected");

        console.log(`📈 [${new Date().toISOString()}] Task cancellation summary:`, {
            total: taskCancellationResults.length,
            successful: successfulTasks.length,
            failed: failedTasks.length,
            rejected: rejectedTasks.length,
            successRate: `${((successfulTasks.length / taskCancellationResults.length) * 100).toFixed(1)}%`,
        });

        // 3. Принудительно отменяем сам flow run
        console.log(`🎯 [${new Date().toISOString()}] Step 3: Cancelling parent flow run ${id}`);
        console.log(`🌐 [${new Date().toISOString()}] Making API call: POST ${API_BASE}/flow_runs/${id}/set_state`);

        const flowRunStartTime = Date.now();

        await ky.post(`${API_BASE}/flow_runs/${id}/set_state`, {
            json: {
                state: {
                    type: "CANCELLED",
                    name: "Cancelled",
                },
                force: true,
            },
        });

        const flowRunDuration = Date.now() - flowRunStartTime;

        console.log(`✅ [${new Date().toISOString()}] Successfully cancelled flow run ${id} in ${flowRunDuration}ms`);

        // Финальная статистика
        const totalDuration = Date.now() - startTime;

        console.log(`🏁 [${new Date().toISOString()}] COMPLETED abortFlowRunCompletely in ${totalDuration}ms`, {
            flowRunId: id,
            totalTasks: taskRuns.length,
            successfullyCancelledTasks: successfulTasks.length,
            failedTaskCancellations: failedTasks.length + rejectedTasks.length,
            totalDuration: `${totalDuration}ms`,
            flowRunCancellationDuration: `${flowRunDuration}ms`,
        });

        return { data: true };

    }
    catch (e) {
        const errorTime = Date.now();
        const totalDuration = errorTime - startTime;

        console.error(`💥 [${new Date().toISOString()}] ERROR in abortFlowRunCompletely after ${totalDuration}ms:`, {
            flowRunId: id,
            error: e instanceof Error
                ? {
                    name: e.name,
                    message: e.message,
                    stack: e.stack,
                }
                : String(e),
            timestamp: new Date().toISOString(),
            totalDuration: `${totalDuration}ms`,
        });

        if (e instanceof HTTPError) {
            console.error(`🌐 [${new Date().toISOString()}] HTTP Error details:`, {
                status: e.response.status,
                statusText: e.response.statusText,
                url: e.response.url,
                method: e.request?.method,
                requestBody: e.request?.body,
            });

            if (e.response.status === 404) {
                return { error: { message: "Flow run или task run не найден (404)", status: 404 } };
            }

            return { error: {
                message: `HTTP Error: ${e.response.status} - ${e.message}`,
                status: e.response.status,
            } };
        }

        return { error: {
            message: (e as Error).message || "Неизвестная ошибка при отмене flow run",
        } };
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
