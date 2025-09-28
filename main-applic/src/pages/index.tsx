import React from "react";
import { Anchor, Center, Space, Title, Text } from "@mantine/core";
import { useUnit } from "effector-react";
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
                        <Anchor href="/auth-pages/login/">
                            <Title order={5}>Войти чтобы увидеть эту страницу</Title>
                        </Anchor>
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
