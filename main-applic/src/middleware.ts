import { type NextMiddleware, type NextRequest, NextResponse } from "next/server";

export const middleware: NextMiddleware = (req: NextRequest) => {
    const pathname = req.nextUrl.pathname;

    const UI_PREFIX = "/ui";
    const actualApiPath = pathname.startsWith(UI_PREFIX)
        ? pathname.substring(UI_PREFIX.length) // Обрезаем "/ui"
        : pathname;
    // --------------------------------------------------------

    // Все маршруты Prefect API пропускаем
    const isPrefectApi = actualApiPath === "/api/python" || actualApiPath.startsWith("/api/python/");

    // Остальные API требуют авторизации, кроме публичных.
    // Используем actualApiPath для проверки API-путей.
    const isProtectedApi
        // 1. Начинается с /api/
        = actualApiPath.startsWith("/api/")
        // 2. Это не Prefect API
            && !isPrefectApi
        // 3. Это не публичный API (user-auth/* или healthcheck/*)
            && !(
                actualApiPath.startsWith("/api/user-auth")
                || actualApiPath.startsWith("/api/healthcheck")
            );

    if (isProtectedApi) {
        // Проверяем наличие заголовка Authorization
        const authorizationHeader = req.headers.get("authorization");
        // Получаем токен (второй элемент после 'Bearer ')
        const token = authorizationHeader?.split(" ").at(1);

        if (!token) {
            // Если токена нет, возвращаем ошибку 401
            return NextResponse.json({ message: "Auth required" }, { status: 401 });
        }

    }

    return NextResponse.next();
};

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - any file with an extension (e.g., .jpg, .png)
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|eot|mp4|webm)$).*)",
    ],
};
