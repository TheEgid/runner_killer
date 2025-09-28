import React from "react";
import "dayjs/locale/ru";
import { generateColors } from "@mantine/colors-generator";
import { createTheme, MantineProvider, type MantineColorsTuple } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { Notifications } from "@mantine/notifications";
import { type AppProps } from "next/app";
import dynamic from "next/dynamic";
import { CenteredLoader } from "src/components/common/Common";
import MainLayout from "src/components/layout/MainLayout";

import "../styles/styles.scss";

const themePalette: MantineColorsTuple = [
    "#f4f4f4",
    "#e7e7e7",
    "#d0d0d0",
    "#b2b2b2",
    "#8e8e8e",
    "#7b7b7b",
    "#6f6f6f",
    "#5f5f5f",
    "#575757",
    "#4e4e4e",
];

const theme = createTheme({
    primaryColor: "mainColor",
    colors: { mainColor: themePalette, gray: generateColors("#747474") },
});

const App = ({ Component, ...rest }: AppProps): React.JSX.Element => {
    const isLoading = false;

    return (
        <MantineProvider theme={theme}>
            <DatesProvider settings={{ locale: "ru", firstDayOfWeek: 1, weekendDays: [0, 6] }}>
                <Notifications autoClose={2000} position="top-center" />
                {isLoading
                    ? <CenteredLoader />
                    : (
                        <MainLayout>
                            <Component {...rest.pageProps} />
                        </MainLayout>
                    )}
            </DatesProvider>
        </MantineProvider>
    );
};

export default dynamic(() => Promise.resolve(App), { ssr: false });

// export default App;
