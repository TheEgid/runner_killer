import React from "react";
import RootComponent from "src/components/common/RootComponent";
import RegistrationComponent from "src/components/user-common-components/RegistrationComponent";

const RegistrationPage = (): React.JSX.Element => {
    return (
        <RootComponent pageName="Регистрация" elem={<RegistrationComponent />} />
    );
};

export default RegistrationPage;
