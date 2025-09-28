import { isEmail } from "src/tools/some-tools";

export const validateEmail = (value: string): string | null => {
    return isEmail(value) ? null : "ошибка адреса электронной почты";
};

export const validatePassword = (value: string): string | null => {
    return value.length >= 6 ? null : "пароль должен содержать не менее 6 символов";
};

export const validateRePassword = (value: string, formValues: { password: string }): string | null => {
    return value.length >= 6 && value === formValues.password ? null : "пароли не совпадают";
};
