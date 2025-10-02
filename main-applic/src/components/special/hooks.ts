import { useState, useEffect, useCallback, useRef } from "react";
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
    const [runId, setRunId] = useState<string | null>(null);
    const [status, setStatus] = useState("NOT_STARTED");
    const [logs, setLogs] = useState<any[]>([]);
    const [runtime, setRuntime] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<Date | null>(null);
    const stopTimeRef = useRef<number | null>(null);
    const isStoppedRef = useRef(false);

    const clearAllTimeouts = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const stoppedTooLong = useCallback(() => {
        return isStoppedRef.current && stopTimeRef.current && (Date.now() - stopTimeRef.current > 12000);
    }, []);

    const updateRun = useCallback(async (id: string): Promise<boolean> => {
        if (!id) { return true; }

        if (stoppedTooLong()) { return true; }

        const { data: flowRun, error: flowError } = await getFlowRun(id);

        if (flowError || !flowRun) {
            if (!isStoppedRef.current) {
                setError(flowError?.message || "FlowRun not found");
                setStatus("FAILED");
            }
            return true;
        }

        const currentStatus = flowRun.state?.type || "UNKNOWN";

        if (!stoppedTooLong()) {
            setStatus(currentStatus);
        }

        if (startTimeRef.current && !stoppedTooLong()) {
            const { data: logsRes } = await getPrefectLogs(id, 100, startTimeRef.current);

            if (logsRes) { setLogs(logsRes); }
            setRuntime(Math.round((Date.now() - startTimeRef.current.getTime()) / 1000));
        }

        return TERMINAL_STATUSES.includes(currentStatus) || stoppedTooLong();
    }, [stoppedTooLong]);

    const startFlow = async (deploymentId: string, params = {}): Promise<void> => {
        setLoading(true);
        setError(null);
        isStoppedRef.current = false;
        stopTimeRef.current = null;

        const { data, error: startError } = await createFlowRun(deploymentId, params);

        if (startError) {
            setError(startError.message);
            setStatus("FAILED");
            setLoading(false);
            return;
        }

        if (!data) {
            setLoading(false);
            return;
        }

        setRunId(data);
        startTimeRef.current = new Date();
        setLogs([]);
        setStatus("PENDING");

        let retryCount = 0;
        const maxRetryDelay = 10000;

        const poll = async (): Promise<void> => {
            if (stoppedTooLong()) { return; }

            const isComplete = await updateRun(data);

            if (!isComplete) {
                retryCount++;
                const delay = Math.min(1000 * Math.pow(1.5, retryCount), maxRetryDelay);

                timeoutRef.current = setTimeout(poll, delay);
            }
            else {
                clearAllTimeouts();
            }
            setLoading(false);
        };

        clearAllTimeouts();
        void poll();
    };

    const stopFlow = async (id: string): Promise<void> => {
        if (!id) { return; }

        setLoading(true);
        isStoppedRef.current = true;
        stopTimeRef.current = Date.now();

        const { error: stopError } = await cancelFlowRunCompletely(id);

        if (stopError) { setError(stopError.message); }
        else { setStatus("CANCELLED"); }

        await updateRun(id);
        setLoading(false);
    };

    useEffect(() => {
        return (): void => {
            isStoppedRef.current = true;
            clearAllTimeouts();
        };
    }, [clearAllTimeouts]);

    return { runId, status, logs, runtime, loading, error, startFlow, stopFlow };
};
