import React from "react";
import { AppShell, Container } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import NextNProgress from "nextjs-progressbar";
import LeftNavbar from "./LeftNavbar";
import TopAppShellHeader from "./TopAppShellHeader";

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [opened, { toggle }] = useDisclosure();

    return (
        <>
            <AppShell navbar={{ width: 170, breakpoint: "sm", collapsed: { mobile: !opened } }}>
                <TopAppShellHeader opened={opened} toggle={toggle} />
                <LeftNavbar />
                <NextNProgress color="#495057" startPosition={0.5} stopDelayMs={50} height={2} showOnShallow options={{ showSpinner: false }} />
                <AppShell.Main pt={37}>
                    <Container fluid>
                        {children}
                    </Container>
                </AppShell.Main>
            </AppShell>
        </>
    );
};

export default MainLayout;
