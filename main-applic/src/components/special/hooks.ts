
import { useState, useEffect, useRef, useCallback } from "react";
import { type FlowRun, cancelFlowRunWithDependencies, createFlowRun, getDeploymentId, getFlowRun, getLogs } from "src/tools/prefectApi";

export const useDeployment = (deploymentName: string): any => {
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

export const useFlowRun = (autoDeleteRuns = false): any => {
    const [runId, setRunId] = useState<string | null>(null);
    const [status, setStatus] = useState("NOT_STARTED");
    const [logs, setLogs] = useState<any[]>([]);
    const [runtime, setRuntime] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const updateRun = useCallback(
        async (startTime: Date) => {
            if (!runId) { return; }
            const { data: flowRun, error } = await getFlowRun(runId);

            if (error || !flowRun) {
                setError(error?.message || "FlowRun not found");
                setStatus("FAILED");
                setLoading(false);
                return;
            }
            setStatus(flowRun.state?.type || "UNKNOWN");

            const { data: logsRes } = await getLogs(runId, 100, startTime);

            if (logsRes) { setLogs(logsRes); }

            if ((flowRun).state?.type === "RUNNING" && startTime) { setRuntime(Math.round((Date.now() - startTime.getTime()) / 1000)); }
            else { setRuntime(0); }

            // if (["COMPLETED", "FAILED"].includes((flowRun as FlowRun).state?.type) && autoDeleteRuns) {
            //     await api.deleteFlowRun(runId);
            // }

            if ((flowRun).state?.type !== "RUNNING") { setLoading(false); }
        },
        [runId, autoDeleteRuns],
    );

    useEffect(() => {
        if (!runId) { return; }
        const startTime = new Date();

        setLoading(true);
        intervalRef.current = setInterval(() => updateRun(startTime), 2000);
        return (): void => intervalRef.current && clearInterval(intervalRef.current);
    }, [runId, updateRun]);

    const startFlow = async (deploymentId: string, params = {}): Promise<void> => {
        setLoading(true);
        const { data, error } = await createFlowRun(deploymentId, params);

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

    const stopFlow = async (runId: string): Promise<void> => {
        setLoading(true);
        const { error } = await cancelFlowRunWithDependencies(runId);

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        let flowRun: FlowRun;

        while (true) {
            const { data, error: getError } = await getFlowRun(runId);

            if (getError) {
                setError(getError.message);
                break;
            }

            flowRun = data;

            if (!flowRun) {
                setError("FlowRun not found");
                break;
            }

            if (!["RUNNING", "PENDING", "SCHEDULED"].includes(flowRun.state.type)) {
                setStatus(flowRun.state.type);
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 сек пауза
        }

        setLoading(false);
    };

    return { runId, status, logs, runtime, loading, error, startFlow, stopFlow, updateRun };
};
