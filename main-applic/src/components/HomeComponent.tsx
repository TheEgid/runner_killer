import React from "react";
import { Anchor, Space } from "@mantine/core";
import PipelineStarter from "./special/Starter";

const HomeComponent = (): React.JSX.Element => {
    return (
        <>
            <Space h="md" />
            <Anchor
                href="https://docs.google.com/spreadsheets/d/1oVqo_6XjKnxFtb92xudq2G7oMcuOL5hnCG0uh8stpE0/edit?gid=1904625815#gid=1904625815"
                target="_blank"
                rel="noopener noreferrer"
            >
                Перейти на таблицу с urls
            </Anchor>

            <PipelineStarter
                deploymentName="seo_content_pipeline_light"
            />
        </>
    );
};

export default HomeComponent;
