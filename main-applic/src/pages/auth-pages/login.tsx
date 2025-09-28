import React from "react";
import RootComponent from "src/components/common/RootComponent";
import LoginComponent from "src/components/user-common-components/LoginComponent";

const LoginPage = (): React.JSX.Element => {
    return (
        <RootComponent pageName="Войти" elem={<LoginComponent />} />
    );
};

export default LoginPage;
