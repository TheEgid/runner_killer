import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";

const appDir = path.join(__dirname, "..", "..");
const pythonAppDir = path.join(appDir, "python-applic");
const baseVenvDir = path.join(pythonAppDir, ".venv");

function findVenvPython(): string | null {
    const candidates = process.platform === "win32"
        ? [path.join(baseVenvDir, "Scripts", "python.exe")]
        : [path.join(baseVenvDir, "bin", "python")];

    return candidates.find(fs.existsSync) ?? null;
}

function findVenvPrefect(): string | null {
    const candidates = process.platform === "win32"
        ? [path.join(baseVenvDir, "Scripts", "prefect.exe")]
        : [path.join(baseVenvDir, "bin", "prefect")];

    return candidates.find(fs.existsSync) ?? null;
}

let venvPython = findVenvPython();
let venvPrefect = findVenvPrefect();

// Создаем виртуальное окружение, если нет
if (!venvPython) {
    console.log("Создаём .venv...");
    execSync(`python -m venv "${baseVenvDir}"`, { stdio: "inherit" });
    venvPython = findVenvPython()!;
}

// Устанавливаем зависимости и Prefect, если нет
if (!venvPrefect) {
    console.log("Установка deps...");
    execSync(`"${venvPython}" -m pip install --upgrade pip`, { stdio: "inherit" });
    // execSync(`"${venvPython}" -m pip install torch==2.8.0+cpu --index-url https://download.pytorch.org/whl/cpu`, { stdio: "inherit" });
    execSync(`"${venvPython}" -m pip install -r "${path.join(pythonAppDir, "requirements.txt")}"`, { stdio: "inherit" });
    venvPrefect = findVenvPrefect()!;
}

function spawnProcess(command: string, args: string[], cwd = pythonAppDir): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            cwd,
            stdio: "inherit",
            shell: process.platform === "win32",
            env: {
                ...process.env,
                PYTHONUTF8: "1",
                PREFECT_API_URL: "http://127.0.0.1:4200/api",
                // // Полное отключение предупреждений
                // PYTHONWARNINGS: "ignore",
                // Или точечное отключение
                PYTHONWARNINGS: "ignore::UserWarning:pydantic_settings.main",
            },
        });

        proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))));
        proc.on("error", (err) => reject(err));
    });
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function main() {
    console.log("🚀 Starting Prefect server...");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const serverProc = spawn(venvPrefect, ["server", "start"]);

    console.log("⏳ Ждем 10 секунд, чтобы сервер поднялся...");
    await new Promise((res) => setTimeout(res, 10000));

    console.log("⚡ Настраиваем лимиты...");
    await spawnProcess(venvPrefect, ["global-concurrency-limit", "update", "my-global-limit", "--limit", "5", "--slot-decay-per-second", "0.1"]);
    await spawnProcess(venvPrefect, ["work-pool", "set-concurrency-limit", "default", "5"]);

    console.log("🚀 Deploying Python flow...");
    await spawnProcess(venvPython, [path.join(pythonAppDir, "main.py")]);

    console.log("🚀 Starting worker...");
    await spawnProcess(venvPrefect, ["worker", "start", "--pool", "default", "--type", "process"]);

    console.log("🚀 Creating deployment...");
    await spawnProcess(venvPython, ["-m", "prefect", "deploy", "-n", "starter_demo", "-f", path.join(pythonAppDir, "main.py")], pythonAppDir);
}

main().catch((err) => console.error("Ошибка запуска:", err));
