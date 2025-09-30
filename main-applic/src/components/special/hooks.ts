/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { useState, useEffect, useCallback, useRef } from "react";
import { createFlowRun, getFlowRun, getPrefectLogs, cancelFlowRunCompletely, getDeploymentId } from "src/tools/prefectApi";
import { TERMINAL_STATUSES } from "./Helpers";

export const useDeployment = (deploymentName: string) => {
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

export const useFlowRun = () => {
    const [runId, setRunId] = useState<string | null>(null);
    const [status, setStatus] = useState("NOT_STARTED");
    const [logs, setLogs] = useState<any[]>([]);
    const [runtime, setRuntime] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<Date | null>(null);

    const updateRun = useCallback(async (id: string): Promise<boolean> => {
        if (!id) {
            return false;
        }

        const { data: flowRun, error: flowError } = await getFlowRun(id);

        if (flowError || !flowRun) {
            setError(flowError?.message || "FlowRun not found");
            setStatus("FAILED");
            return true; // Завершено с ошибкой
        }

        const currentStatus = flowRun.state?.type || "UNKNOWN";

        setStatus(currentStatus);

        if (startTimeRef.current) {
            const { data: logsRes } = await getPrefectLogs(id, 100, startTimeRef.current);

            if (logsRes) { setLogs(logsRes); }
            setRuntime(Math.round((Date.now() - startTimeRef.current.getTime()) / 1000));
        }

        const isCompleted = TERMINAL_STATUSES.includes(currentStatus);

        return isCompleted;
    }, []);

    const startFlow = async (deploymentId: string, params = {}) => {
        setLoading(true);
        const { data, error: startError } = await createFlowRun(deploymentId, params);

        if (startError) {
            setError(startError.message);
            setStatus("FAILED");
            setLoading(false);
            return;
        }

        if (data) {
            setRunId(data);
            startTimeRef.current = new Date();
            setLogs([]);

            let retryCount = 0;
            const maxRetryDelay = 10000;

            const poll = async () => {
                const isComplete = await updateRun(data);

                if (!isComplete) {
                    retryCount++;
                    const delay = Math.min(1000 * Math.pow(1.5, retryCount), maxRetryDelay);

                    setTimeout(poll, delay);
                }
                else {
                    intervalRef.current = null;
                }
            };

            if (!intervalRef.current) {
                void poll();
            }
            await updateRun(data);
        }

        setLoading(false);
    };

    const stopFlow = async (id: string) => {
        if (!id) { return; }
        setLoading(true);

        const { error: stopError } = await cancelFlowRunCompletely(id);

        if (stopError) { setError(stopError.message); }

        await updateRun(id);

        setLoading(false);
    };

    useEffect(() => {
        return () => {
            if (intervalRef.current) { clearInterval(intervalRef.current); }
        };
    }, []);

    return { runId, status, logs, runtime, loading, error, startFlow, stopFlow };
};
