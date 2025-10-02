import React from "react";
import { Center, Space, Title, Text } from "@mantine/core";
import { useUnit } from "effector-react";
import Link from "next/link";
import RootComponent from "src/components/common/RootComponent";
import HomeComponent from "src/components/HomeComponent";
import { $visitor } from "src/models/user-state";

const HomePage = (): React.JSX.Element => {
    const visitor = useUnit($visitor);
    const isLogin = !!visitor;

    if (!isLogin) {
        return (
            <>
                <Space h="lg" />
                <Center>
                    <Text component="div">
                        <Link href="/auth-pages/login/" style={{ textDecoration: "none" }}>
                            <Title order={5} style={{ color: "inherit" }}>
                                Войти чтобы увидеть эту страницу
                            </Title>
                        </Link>
                    </Text>
                </Center>
            </>
        );
    }

    return (
        <RootComponent pageName="Main" elem={<HomeComponent />} />
    );
};

export default HomePage;
