import React, { useEffect, useState } from "react";
import { Text, Space, Group, AppShell, Burger, Indicator } from "@mantine/core";
import { useUnit } from "effector-react";
import Link from "next/link";
import { $visitor } from "src/models/user-state";

const TopAppShellHeader = (props: { opened: boolean, toggle: React.MouseEventHandler<HTMLButtonElement> }): React.JSX.Element => {
    const { opened, toggle } = props;
    const [mvisitor, setMVisitor] = useState(null);

    const visitor = useUnit($visitor);

    useEffect(() => {
        setMVisitor(visitor);
    }, []);

    const isLogin = !!mvisitor;
    const email = mvisitor?.email ?? "";

    return (
        <AppShell.Header h={40} w={1700}>
            <Group gap="md" px="sm" justify="space-between" style={{ width: "100%" }}>
                <Group>
                    <Space w={150} />
                    <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
                    <Link href="/" passHref style={{ textDecoration: "none" }}>
                        <Group align="baseline" gap="0" style={{ cursor: "pointer" }}>
                            <Text style={{ fontSize: "150%" }} c="gray" fw={700}>Загрузчик&nbsp;</Text>
                            <Text style={{ fontSize: "105%" }} c="gray">универсальный</Text>
                        </Group>
                    </Link>
                </Group>
                <Group justify="flex-end">
                    <Group justify="flex-end" gap={0}>

                        <Text size="xs" c="black">На сервере вы&nbsp;</Text>
                        <Indicator color="gray" position="top-end" radius="sm" withBorder>
                            {isLogin ? <Text size="xs" fw={700} c="gray">{email}</Text> : <Text size="xs">Гость</Text>}
                        </Indicator>
                    </Group>
                </Group>
            </Group>
        </AppShell.Header>
    );
};

export default TopAppShellHeader;
