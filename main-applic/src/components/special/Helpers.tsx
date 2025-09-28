/* eslint-disable @stylistic/indent */
import React from "react";
import { Card, Group, Loader, ScrollArea, Text } from "@mantine/core";
import { TbTerminal } from "react-icons/tb";
import type { LogEntry } from "src/tools/prefectApi";

export const getBadgeColor = (stat: string): string =>
({
    RUNNING: "blue",
    COMPLETED: "green",
    FAILED: "red",
    STOPPED: "orange",
}[stat] || "gray");

interface Props {
    logs: LogEntry[],
    loading: boolean,
    status: string
}

export const LogsCard: React.FC<Props> = ({ logs, loading, status }) => (
    <Card withBorder w={1200}>
        <Card.Section withBorder inheritPadding py="xs">
            <Group justify="space-between">
                <Group>
                    <TbTerminal size={16} />
                    <Text size="sm">Логи</Text>
                </Group>
                {status === "RUNNING" && <Loader size="xs" />}
            </Group>
        </Card.Section>

        <Card.Section>
            <ScrollArea h={300} p="sm">
                {logs.length > 0
                    ? logs.map((log, idx) => (
                        <div key={idx} style={{ marginBottom: 4 }}>
                            <Text
                                size="xs"
                                ff="monospace"
                                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.4, color: getBadgeColor(log.level) }}
                            >
                                <span style={{ color: "#868e96" }}>
                                    [
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                    ]
                                </span>
                                {" "}
                                {log.message}
                            </Text>
                        </div>
                    ))
                    : <Text size="xs" c="dimmed">{loading ? "Ожидание логов..." : "Логи пока отсутствуют"}</Text>}
            </ScrollArea>
        </Card.Section>
    </Card>
);
