import React from "react";
import { Center, Loader } from "@mantine/core";
import { notifications } from "@mantine/notifications";

export const CenteredLoader = (): React.JSX.Element => <Center mt="lg"><Loader type="bars" /></Center>;

export const messageNotify = (props: { message: string, isError?: boolean }): string => {
    const { message, isError } = props;
    const color = isError ? "red" : "orange";

    return notifications.show({ color, message, withBorder: true });
};
