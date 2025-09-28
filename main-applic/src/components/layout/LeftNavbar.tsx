import React from "react";
import { AppShell, NavLink, Stack, Text, Space } from "@mantine/core";
import { useUnit } from "effector-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { FaHouseChimney, FaBarsStaggered, FaRightToBracket, FaUserCheck, FaUserTie, FaMapLocationDot } from "react-icons/fa6";
import { GiWheat } from "react-icons/gi";
import { $visitor, logoutFx } from "src/models/user-state";

const NavRouterLink = (props: { path: string, name: string }): React.JSX.Element => {
    const { path, name } = props;
    const router = useRouter();

    let icon: React.JSX.Element | undefined;

    switch (name) {
    case "Главная":
        icon = <FaHouseChimney size="1rem" stroke="1.5" />;
        break;
    case "Заявления":
        icon = <FaBarsStaggered size="1rem" stroke="1.5" />;
        break;
    case "СХ Гео":
        icon = <FaMapLocationDot size="1rem" stroke="1.5" />;
        break;
    case "СХ Урожай":
        icon = <GiWheat size="1rem" stroke="1.5" />;
        break;
    case "Войти":
        icon = <FaUserCheck size="1rem" stroke="1.5" />;
        break;
    case "Регистрация":
        icon = <FaUserTie size="1rem" stroke="1.5" />;
        break;
    case "Выйти":
        icon = <FaRightToBracket size="1rem" stroke="1.5" />;
        break;
    default:
        icon = undefined;
    }

    const handleClick = async (event: React.MouseEvent): Promise<void> => {
        if (name === "Выйти") {
            event.preventDefault();
            // setCurrentPetitionFx({ current: { ...initialPetition, ...initialPrismaPetitionData } });
            // await setCurrentStepFx(0);
            await logoutFx();
            await router.push("/");
        }
    };

    const isActive = router?.pathname === path;

    return (
        <NavLink
            onClick={handleClick}
            href={path}
            component={Link}
            autoContrast
            bg={isActive ? "var(--nl-bg)" : "#e9e9eb"}
            label={(
                <Text
                    h={24}
                    fw={isActive ? 700 : 300}
                    style={{ fontSize: isActive ? "115%" : "110%" }}
                >
                    {name}
                </Text>
            )}
            active={isActive}
            leftSection={icon && <div style={{ opacity: isActive ? 1 : 0.5 }}>{icon}</div>}
        />
    );
};

export const LeftNavbar = (): React.JSX.Element => {
    const visitor = useUnit($visitor);
    const isLogin = !!visitor;

    return (
        <AppShell.Navbar p={10} pt={0}>
            <Space h={10} />
            <Stack gap="sm">
                <NavRouterLink path="/" name="Главная" />
                {/* <NavRouterLink path="/allpetitions" name="Заявления" />
                <NavRouterLink path="/geo" name="СХ Гео" />
                <NavRouterLink path="/yieldcalc" name="СХ Урожай" /> */}
            </Stack>
            <Space h={100} />
            {isLogin
                ? <NavRouterLink path="#" name="Выйти" />
                : (
                    <Stack gap="sm">
                        <NavRouterLink path="/auth-pages/login" name="Войти" />
                        <NavRouterLink path="/auth-pages/register" name="Регистрация" />
                    </Stack>
                )}
            <Space h={30} />
        </AppShell.Navbar>
    );
};

export default LeftNavbar;
