import React from "react";
import { Text, Space, Group, AppShell, Burger, Indicator } from "@mantine/core";
import { useUnit } from "effector-react";
import Link from "next/link";
import { $visitor } from "src/models/user-state";

interface TopAppShellHeaderProps {
    opened: boolean,
    toggle: React.MouseEventHandler<HTMLButtonElement>
}

const TopAppShellHeader = ({ opened, toggle }: TopAppShellHeaderProps): React.JSX.Element => {
    const visitor = useUnit($visitor);

    const isLogin = !!visitor;
    const email = visitor?.email ?? "";

    return (
        <AppShell.Header h={40} w={1700}>
            <Group gap="md" px="sm" justify="space-between" style={{ width: "100%" }}>
                <Group>
                    <Space w={150} />
                    <Burger
                        opened={opened}
                        onClick={toggle}
                        hiddenFrom="sm"
                        size="sm"
                        aria-label="Toggle navigation"
                    />
                    <Link href="/" passHref style={{ textDecoration: "none" }}>
                        <Group align="baseline" gap="0" style={{ cursor: "pointer" }}>
                            <Text style={{ fontSize: "160%" }} c="gray" fw={700}>
                                SEO&nbsp;
                            </Text>
                            <Text style={{ fontSize: "160%" }} c="gray" fw={500}>
                                Killer
                            </Text>
                        </Group>
                    </Link>
                </Group>

                <Group justify="flex-end">
                    <Group justify="flex-end" gap={0}>
                        <Text size="xs" c="black">
                            На сервере вы&nbsp;
                        </Text>
                        <Indicator
                            color="gray"
                            position="top-end"
                            radius="sm"
                            withBorder
                            inline
                        >
                            {isLogin
                                ? (
                                    <Text size="xs" fw={700} c="blue">
                                        {email}
                                    </Text>
                                )
                                : (
                                    <Text size="xs">Гость</Text>
                                )}
                        </Indicator>
                    </Group>
                </Group>
            </Group>
        </AppShell.Header>
    );
};

export default TopAppShellHeader;
