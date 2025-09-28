import { useState, useRef, useEffect } from "react";
import {
    type LogEntry,
    createFlowRun,
    stopFlowRun,
    getDeploymentId,
    getFlowRun,
    getLogs,
    isPrefectError,
} from "../../tools/prefectApi";

export const useDeployment = (deploymentName: string): { deploymentId: string | null, error: string | null } => {
    const [deploymentId, setDeploymentId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!deploymentName) { return; }

        getDeploymentId(deploymentName)
            .then((res) => {
                if (typeof res === "string") { setDeploymentId(res); }
                else { setError(isPrefectError(res) ? res.message : "Deployment не найден"); }
            })
            .catch(() => setError("Ошибка загрузки Deployment"));
    }, [deploymentName]);

    return { deploymentId, error };
};

export type FlowRunResponse = { id: string, state?: { type: string }, message?: string };

export const useFlowRun = (autoDeleteRuns = false): any => {
    const [runId, setRunId] = useState<string | null>(null);
    const [status, setStatus] = useState("NOT_STARTED");
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [runtime, setRuntime] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Функция обновления статуса и логов
    const updateRun = async (currentRunId: string | null, startTime: Date | null): Promise<void> => {
        if (!currentRunId) { return; }

        try {
            const flowRun = (await getFlowRun(currentRunId)) as FlowRunResponse | null;

            if (!flowRun || isPrefectError(flowRun)) {
                setStatus("FAILED");
                setError(flowRun?.message || "Run не найден");
                setLoading(false);
                return;
            }

            const newStatus = flowRun.state?.type || "UNKNOWN";

            setStatus(newStatus);

            const logsResult = await getLogs(currentRunId, startTime);

            if (Array.isArray(logsResult)) { setLogs(logsResult); }
            else if (isPrefectError(logsResult)) { setError(logsResult.message); }

            if (newStatus === "RUNNING" && startTime) {
                setRuntime(Math.round((Date.now() - startTime.getTime()) / 1000));
            }
            else { setRuntime(0); }

            if ((newStatus === "COMPLETED" || newStatus === "FAILED") && autoDeleteRuns && newStatus === "COMPLETED") {
                await stopFlowRun(currentRunId).catch(console.error);
            }

            if (newStatus !== "RUNNING") { setLoading(false); }
        }
        catch (err) {
            console.error(err);
            setStatus("FAILED");
            setError("Ошибка обновления данных");
            setLoading(false);
        }
    };

    // Авто-обновление через интервал
    useEffect(() => {
        if (!runId) { return; }

        const startTime = new Date();

        setLoading(true);

        intervalRef.current = setInterval(() => updateRun(runId, startTime), 2000);

        return (): void => {
            if (intervalRef.current) { clearInterval(intervalRef.current); }
        };
    }, [runId, autoDeleteRuns]);

    const startFlow = async (deploymentId: string): Promise<void> => {
        setError(null);
        setLoading(true);
        const startTime = new Date();

        try {
            const result = await createFlowRun(deploymentId, { resume: true });

            if (isPrefectError(result)) {
                setError(result.message);
                setStatus("FAILED");
            }
            else {
                setRunId(result);
                await updateRun(result, startTime);
            }
        }
        catch {
            setError("Ошибка запуска FlowRun");
            setStatus("FAILED");
        }
        finally {
            setLoading(false);
        }
    };

    const stopFlow = async (runIdToStop: string): Promise<void> => {
        try {
            const result = await stopFlowRun(runIdToStop);

            if (isPrefectError(result)) { setError(result.message); }
            setRunId(null);
            setStatus("STOPPED");
            setLoading(false);
        }
        catch {
            setError("Не удалось остановить FlowRun");
        }
    };

    return { runId, status, logs, runtime, loading, error, startFlow, stopFlow };
};
