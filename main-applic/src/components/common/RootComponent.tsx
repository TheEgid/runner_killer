import React from "react";
import Head from "next/head";

export interface IRootComponentProps {
    pageName?: string,
    elem: React.JSX.Element
}

const RootComponent = (props: IRootComponentProps): React.JSX.Element => {
    const { pageName, elem } = props;
    const documentTitle = `Loader | ${pageName || ""}`;

    return (
        <>
            <Head>
                <title>{documentTitle}</title>
            </Head>
            {elem}
        </>
    );
};

export default RootComponent;

// Use dynamic import to disable SSR
// const RootComponent = dynamic(() => Promise.resolve(RootComponentContent), { ssr: false });
