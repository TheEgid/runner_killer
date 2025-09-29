/* eslint-disable @stylistic/indent-binary-ops */
import React from "react";
import { Badge, Button, Group, Stack, Text, Title } from "@mantine/core";
import { FaPlay, FaRegSquare } from "react-icons/fa";
import { getBadgeColor, LogsCard } from "./Helpers";
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
        || (logs.length === 0 && ["COMPLETED", "FAILED"].includes(status) ? "Ошибка выполнения" : undefined);

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
                        loading={loading && status === "NOT_STARTED"}
                        disabled={!deploymentId || ["RUNNING", "PENDING", "SCHEDULED"].includes(status)}
                    >
                        Запустить Пайплайн
                    </Button>

                    <Button
                        leftSection={<FaRegSquare size={18} />}
                        color="red"
                        onClick={() => runId && stopFlow(runId)}
                        loading={stopLoading}
                        disabled={!runId || !["RUNNING", "NOT_STARTED"].includes(status)}
                    >
                        Остановить Пайплайн
                    </Button>

                    {status !== "NOT_STARTED" && <Badge color={getBadgeColor(status)}>{status}</Badge>}

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
