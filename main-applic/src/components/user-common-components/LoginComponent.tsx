import React from "react";
import { Anchor, Button, Fieldset, Group, Paper, PasswordInput, Space, Stack, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { useRouter } from "next/router";
import { userLoginFx } from "src/models/user-state";
import { waitFor } from "src/tools/some-tools";
import { validateEmail, validatePassword } from "./validation";

const LoginComponent = (): React.JSX.Element => {
    const [visiblePassword, { toggle: togglePassword }] = useDisclosure(false);
    const router = useRouter();

    const form = useForm({
        mode: "uncontrolled",
        validateInputOnChange: true,
        initialValues: { email: "", password: "" },
        validate: {
            email: validateEmail,
            password: validatePassword,
        },
    });

    const handleSubmit = async (values: typeof form.values): Promise<void> => {
        try {
            await waitFor(20);
            await userLoginFx({ email: values.email, password: values.password });
            await waitFor(20);
            form.reset();
            await router.push("/");
        }
        catch (error) {
            form.setErrors({
                email: `${(error as Error).message} Логин не удался. Попробуйте снова`,
            });
        }
    };

    return (
        <>
            <Space h="sm" />
            <Paper withBorder shadow="xs" p="sm">
                <Stack gap="sm" align="center">
                    <form onSubmit={form.onSubmit((values) => handleSubmit(values))}>
                        <Fieldset legend="" w={600}>
                            <Space h="sm" />
                            <TextInput
                                withAsterisk
                                label="Электронная почта"
                                placeholder="Электронная почта"
                                {...form.getInputProps("email")}
                            />
                            <Space h="sm" />
                            <PasswordInput
                                withAsterisk
                                label="Пароль"
                                description="Такой же как электронная почта"
                                placeholder="Пароль"
                                visible={visiblePassword}
                                onVisibilityChange={togglePassword}
                                {...form.getInputProps("password")}
                            />
                            <Space h="sm" />
                            <Group justify="flex-end">
                                <Button type="submit" variant="outline" disabled={!form.isValid()}>
                                    Войти
                                </Button>
                            </Group>
                        </Fieldset>
                    </form>
                    <Group gap="sm" justify="flex-start" align="flex-start">
                        <Title order={5}>Еще не зарегистрированы?</Title>
                        <Anchor href="/auth-pages/register/">
                            <Title order={5}>Зарегистрироваться</Title>
                        </Anchor>
                    </Group>
                </Stack>
            </Paper>
        </>
    );
};

export default LoginComponent;
