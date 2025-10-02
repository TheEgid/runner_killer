import React from "react";
import { Badge, Group, Space } from "@mantine/core";
import { TiAt } from "react-icons/ti";
import FilesManager from "./special/FilesManager";
import PipelineStarter from "./special/Starter";

const RootLink = (): React.JSX.Element => (
    <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none" }}
    >
        <Badge
            variant="gradient"
            gradient={{ from: "black", to: "gray", deg: 90 }}
            leftSection={<TiAt size={12} />}
            style={{ cursor: "pointer" }}
        >
            Prefect Dashboards
        </Badge>
    </a>
);

const GoogleSheetLink = (): React.JSX.Element => (
    <a
        href="https://docs.google.com/spreadsheets/d/1oVqo_6XjKnxFtb92xudq2G7oMcuOL5hnCG0uh8stpE0/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none" }}
    >
        <Badge
            variant="gradient"
            gradient={{ from: "green", to: "lightgreen", deg: 90 }}
            style={{ cursor: "pointer" }}
        >
            Перейти на таблицу с urls
        </Badge>
    </a>
);

const HomeComponent = (): React.JSX.Element => (
    <>
        <Space h="md" />
        <Group gap="md">
            <RootLink />
            <GoogleSheetLink />
        </Group>
        <Space h="md" />
        <FilesManager />
        <Space h="md" />
        <PipelineStarter deploymentName="seo_content_pipeline_light" />
    </>
);

export default HomeComponent;
