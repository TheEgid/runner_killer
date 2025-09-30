/* eslint-disable @stylistic/indent-binary-ops */
import React from "react";
import { Badge, Button, Group, Stack, Text, Title } from "@mantine/core";
import { FaPlay, FaRegSquare } from "react-icons/fa";
import { fetchFilesFx } from "src/models/interchange-state";
import { ACTIVE_STATUSES, getBadgeColor, LogsCard, STOPPABLE_STATUSES, TERMINAL_STATUSES } from "./Helpers";
import { useDeployment, useFlowRun } from "./hooks";

interface Props {
    deploymentName: string
}

const PipelineStarter: React.FC<Props> = ({ deploymentName }) => {
    const { deploymentId, error: deploymentError } = useDeployment(deploymentName);
    const { runId, status, logs, runtime, loading, error, startFlow, stopFlow } = useFlowRun();

    const stopLoading = loading && status === "RUNNING";
    const anyError
        = deploymentError
        || error
        || (logs.length === 0 && TERMINAL_STATUSES.includes(status) ? "Ошибка выполнения" : undefined);

    const handleStopClick = (): void => {
        if (runId) {
            void stopFlow(runId);
            void fetchFilesFx();
        }
    };

    return (
        <>
            <Title mt="md" order={1}>
                <Text ff="monospace">{`Пайплайн ${deploymentName}`}</Text>
            </Title>

            <Stack mt="md" gap="md">
                <Group justify="apart">
                    <Button
                        leftSection={<FaPlay size={18} />}
                        onClick={() => deploymentId && startFlow(deploymentId)}
                        loading={loading && !status}
                        disabled={!deploymentId || ACTIVE_STATUSES.includes(status)}
                    >
                        Запустить Пайплайн
                    </Button>

                    <Button
                        leftSection={<FaRegSquare size={18} />}
                        color="red"
                        onClick={handleStopClick}
                        loading={stopLoading}
                        disabled={!runId || !STOPPABLE_STATUSES.includes(status)}
                    >
                        Остановить Пайплайн
                    </Button>

                    {status && status !== "NOT_STARTED" && (
                        <Badge color={getBadgeColor(status)}>{status}</Badge>
                    )}

                    {status === "RUNNING" && (
                        <Text size="sm" c="dimmed">
                            ⏱
                            {" "}
                            {runtime}
                            {" "}
                            сек
                        </Text>
                    )}
                </Group>

                {anyError && (
                    <Text size="sm" c="red" ta="center">
                        ❌
                        {" "}
                        {anyError}
                    </Text>
                )}

                <LogsCard logs={logs} loading={loading} status={status} />
            </Stack>
        </>
    );
};

export default PipelineStarter;
