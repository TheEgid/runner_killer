/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { useState, useEffect, useRef, useCallback } from "react";
import * as api from "../../tools/prefectApi";
import type { FlowRun } from "../../tools/prefectApi";

export const useDeployment = (deploymentName: string) => {
    const [deploymentId, setDeploymentId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!deploymentName) { return; }
        void api.getDeploymentId(deploymentName).then(({ data, error }) => {
            if (error) { setError(error.message); }
            else { setDeploymentId(data ?? null); }
        });
    }, [deploymentName]);

    return { deploymentId, error };
};

export const useFlowRun = (autoDeleteRuns = false) => {
    const [runId, setRunId] = useState<string | null>(null);
    const [status, setStatus] = useState("NOT_STARTED");
    const [logs, setLogs] = useState<any[]>([]);
    const [runtime, setRuntime] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const updateRun = useCallback(
        async (startTime: Date | null) => {
            if (!runId) { return; }
            const { data: flowRun, error } = await api.getFlowRun(runId);

            if (error || !flowRun) {
                setError(error?.message || "FlowRun not found");
                setStatus("FAILED");
                setLoading(false);
                return;
            }
            setStatus((flowRun as FlowRun).state?.type || "UNKNOWN");

            const { data: logsRes } = await api.getLogs(runId, startTime ?? undefined);

            if (logsRes) { setLogs(logsRes); }

            if ((flowRun as FlowRun).state?.type === "RUNNING" && startTime) { setRuntime(Math.round((Date.now() - startTime.getTime()) / 1000)); }
            else { setRuntime(0); }

            if (["COMPLETED", "FAILED"].includes((flowRun as FlowRun).state?.type) && autoDeleteRuns) {
                await api.deleteFlowRun(runId);
            }

            if ((flowRun as FlowRun).state?.type !== "RUNNING") { setLoading(false); }
        },
        [runId, autoDeleteRuns],
    );

    useEffect(() => {
        if (!runId) { return; }
        const startTime = new Date();

        setLoading(true);
        intervalRef.current = setInterval(() => updateRun(startTime), 2000);
        return () => intervalRef.current && clearInterval(intervalRef.current);
    }, [runId, updateRun]);

    const startFlow = async (deploymentId: string, params = {}) => {
        setLoading(true);
        const { data, error } = await api.createFlowRun(deploymentId, params);

        if (error) {
            setError(error.message);
            setStatus("FAILED");
        }
        else if (data) {
            setRunId(data);
            void updateRun(new Date());
        }
        setLoading(false);
    };

    const stopFlow = async (runId: string) => {
        if (!runId) { return; }
        await api.cancelFlowRun(runId);
        setRunId(null);
        setStatus("STOPPED");
    };

    return { runId, status, logs, runtime, loading, error, startFlow, stopFlow, updateRun };
};
