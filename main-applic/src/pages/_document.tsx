import React from "react";
import { mantineHtmlProps } from "@mantine/core";
import { Html, Head, Main, NextScript } from "next/document";

const Document = (): React.JSX.Element => {
    return (
        <Html lang="ru" {...mantineHtmlProps}>
            <Head />
            <body>
                <Main />
                <NextScript />
            </body>
        </Html>
    );
};

export default Document;
