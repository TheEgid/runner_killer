import React from "react";
import { Anchor, Button, Fieldset, Group, Paper, PasswordInput, Space, Stack, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { useRouter } from "next/router";
import { userRegisterFx } from "src/models/user-state";
import { waitFor } from "src/tools/some-tools";
import { validateEmail, validatePassword, validateRePassword } from "./validation";

const RegistrationComponent = (): React.JSX.Element => {
    const [visiblePassword, { toggle: togglePassword }] = useDisclosure(false);
    const [visibleRePassword, { toggle: toggleRePassword }] = useDisclosure(false);
    const router = useRouter();

    const form = useForm({
        initialValues: { email: "", password: "", rePassword: "" },
        validateInputOnChange: true,
        validate: {
            email: validateEmail,
            password: validatePassword,
            rePassword: validateRePassword,
        },
    });

    const handleSubmit = async (values: typeof form.values): Promise<void> => {
        try {
            await waitFor(20);
            await userRegisterFx({ email: values.email, password: values.password });
            await waitFor(20);
            form.reset();
            await router.push("/auth-pages/login");
        }
        catch (error) {
            form.setErrors({
                email: `${(error as Error).message} Регистрация не удалась. Попробуйте ещё раз`,
            });
        }
    };

    return (
        <>
            <Space h="sm" />
            <Paper withBorder shadow="xs" p="sm">
                <Stack gap="sm" align="center">
                    <form onSubmit={form.onSubmit(handleSubmit)}>
                        <Fieldset legend="" w={600}>
                            <Space h="sm" />
                            <TextInput
                                disabled={true}
                                withAsterisk
                                label="Электронная почта"
                                placeholder="Электронная почта"
                                {...form.getInputProps("email")}
                            />
                            <Space h="sm" />
                            <PasswordInput
                                disabled={true}
                                withAsterisk
                                label="Пароль"
                                // description="Не менее 6 символов"
                                description="Такой же как электронная почта"
                                placeholder="Пароль"
                                visible={visiblePassword}
                                onVisibilityChange={togglePassword}
                                {...form.getInputProps("password")}
                            />
                            <Space h="sm" />
                            <PasswordInput
                                disabled={true}
                                withAsterisk
                                label="Повторите пароль"
                                placeholder="Повторите пароль"
                                visible={visibleRePassword}
                                onVisibilityChange={toggleRePassword}
                                {...form.getInputProps("rePassword")}
                            />
                            <Space h="sm" />
                            <Group justify="flex-end">
                                <Button type="submit" variant="outline" disabled={!form.isValid()}>
                                    Регистрация
                                </Button>
                            </Group>
                        </Fieldset>
                    </form>
                    <Space h="sm" />
                    <Group gap="sm" justify="flex-start" align="flex-start">
                        <Title order={5}>Уже зарегистрированы?</Title>
                        <Anchor href="/auth-pages/login/">
                            <Title order={5}>Войти</Title>
                        </Anchor>
                    </Group>
                </Stack>
            </Paper>
        </>
    );
};

export default RegistrationComponent;
