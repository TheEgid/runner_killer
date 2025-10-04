import { useState, useEffect, useCallback, useRef } from "react";
import { useUnit } from "effector-react";
import { $logs, $runId, $runtime, $status, appendLogs, resetLogs, updateRunId, updateRuntime, updateStatus } from "src/models/flow-run-state";
import { createFlowRun, getFlowRun, getPrefectLogs, cancelFlowRunCompletely, getDeploymentId } from "src/tools/prefectApi";
import { TERMINAL_STATUSES } from "./Helpers";

export const useDeployment = (deploymentName: string): { deploymentId: string | null, error: string | null } => {
    const [deploymentId, setDeploymentId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!deploymentName) { return; }
        void getDeploymentId(deploymentName).then(({ data, error }) => {
            if (error) { setError(error.message); }
            else { setDeploymentId(data ?? null); }
        });
    }, [deploymentName]);

    return { deploymentId, error };
};

export const useFlowRun = (): any => {
    const { runId, status, logs, runtime } = useUnit({
        runId: $runId,
        status: $status,
        logs: $logs,
        runtime: $runtime,
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<Date | null>(null);
    const lastLogTimestampRef = useRef<string | null>(null);

    const clearTimeouts = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    // Обновление run: получаем статус и новые логи (по timestamp)
    const updateRun = useCallback(async (id: string): Promise<boolean> => {
        if (!id) { return true; }

        const { data: flowRun, error: flowError } = await getFlowRun(id);

        if (flowError || !flowRun) {
            setError(flowError?.message || "FlowRun not found");
            updateStatus("FAILED");
            return true;
        }

        const currentStatus = flowRun.state?.type || "UNKNOWN";

        updateStatus(currentStatus);

        // // Получаем новые логи с последнего известного timestamp или старта
        // const sinceTime = lastLogTimestampRef.current
        //     ? new Date(new Date(lastLogTimestampRef.current).getTime() + 1) // +1 мс, чтобы не дублировать последний лог
        //     : startTimeRef.current;

        const { data: logsRes } = await getPrefectLogs(id, 200);

        if (logsRes?.length) {
            appendLogs(logsRes); // Добавляем новые уникальные логи
            const latestLog = logsRes[logsRes.length - 1];

            if (latestLog?.timestamp) {
                lastLogTimestampRef.current = latestLog.timestamp; // Обновляем последний timestamp
            }
        }

        // Обновляем runtime с момента старта
        if (startTimeRef.current) {
            updateRuntime(Math.round((Date.now() - startTimeRef.current.getTime()) / 1000));
        }

        return TERMINAL_STATUSES.includes(currentStatus);
    }, []);

    // Старт flow
    const startFlow = useCallback(async (deploymentId: string) => {
        setLoading(true);
        setError(null);
        resetLogs();
        lastLogTimestampRef.current = null; // Сбрасываем timestamp при новом старте

        const { data: runIdFromApi, error } = await createFlowRun(deploymentId, {});

        if (error || !runIdFromApi) {
            setError(error?.message || "Не удалось создать FlowRun");
            updateStatus("FAILED");
            setLoading(false);
            return;
        }

        updateRunId(runIdFromApi);
        updateStatus("PENDING");
        startTimeRef.current = new Date();

        const poll = async (): Promise<void> => {
            const done = await updateRun(runIdFromApi);

            if (!done) {
                timeoutRef.current = setTimeout(poll, 4000);
            }
            else {
                setLoading(false);
            }
        };

        void poll();
    }, [updateRun]);

    // Остановка flow
    const stopFlow = useCallback(async (id: string) => {
        if (!id) { return; }
        setLoading(true);

        const { error: cancelError } = await cancelFlowRunCompletely(id);

        updateStatus("CANCELLED");
        if (cancelError) { setError(cancelError.message); }

        void updateRun(id);
        setLoading(false);
    }, [updateRun]);

    // Автовозобновление опроса при перезагрузке страницы (если run активный)
    useEffect(() => {
        if (runId && status && !TERMINAL_STATUSES.includes(status) && !loading) {
            // Восстанавливаем startTime из persisted runtime (если доступно)
            const estimatedStartTime = runtime > 0 ? new Date(Date.now() - runtime * 1000) : new Date();

            startTimeRef.current = estimatedStartTime;

            // Устанавливаем последний лог timestamp из persisted логов (если есть)
            if (logs.length > 0) {
                lastLogTimestampRef.current = logs[logs.length - 1].timestamp;
            }

            // Запускаем сброс опроса для получения новых логов
            void updateRun(runId);
            const poll = async (): Promise<void> => {
                const done = await updateRun(runId);

                if (!done) {
                    timeoutRef.current = setTimeout(poll, 4000);
                }
            };

            void poll(); // Возобновляем опрос
        }
    }, [runId, status, runtime]);

    useEffect(() => clearTimeouts, [clearTimeouts]);

    return { runId, status, logs, runtime, loading, error, startFlow, stopFlow };
};
