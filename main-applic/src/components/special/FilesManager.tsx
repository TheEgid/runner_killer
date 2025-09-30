import React, { useEffect } from "react";
import { ActionIcon, Button, Card, Stack, Table, Text } from "@mantine/core";
import { useUnit } from "effector-react";
import { TbRefresh, TbTrash } from "react-icons/tb";
import { $files, deleteFileFx, downloadFileFx, fetchFilesFx } from "src/models/interchange-state";

const FileNameDisplay = ({ fileName, downloadFileFx }: { fileName: string, downloadFileFx: () => void }): React.JSX.Element => {
    return (
        <>
            <Text
                component="a"
                variant="link"
                style={{
                    cursor: "pointer",
                    color: "#228be6",
                    textDecoration: "underline",
                }}
                onClick={downloadFileFx}
            >
                {fileName}
            </Text>
        </>
    );
};

const FilesManager = (): React.JSX.Element => {
    const files = useUnit($files);

    useEffect(() => {
        void fetchFilesFx();
    }, []);

    const handleDelete = (fileName: string): void => void deleteFileFx(fileName);

    return (
        <Stack gap="md" align="flex-start">
            <Button
                leftSection={<TbRefresh size="1rem" />}
                onClick={() => fetchFilesFx()}
            >
                Обновить список файлов
            </Button>
            <Card w="500px" shadow="sm" m={0} radius="xs" withBorder>
                <Table striped highlightOnHover verticalSpacing="xs" layout="fixed">
                    <colgroup>
                        <col style={{ width: "60px" }} />
                        <col />
                        <col style={{ width: "100px" }} />
                    </colgroup>
                    <tbody>
                        {files.length === 0
                            ? (
                                <tr>
                                    <td colSpan={3}>
                                        <Text size="sm" c="dimmed" ta="center" p="md">
                                            Файлы отсутствуют
                                        </Text>
                                    </td>
                                </tr>
                            )
                            : (
                                files.map((file, idx) => (
                                    <tr key={`row-${file}-${idx}`}>
                                        <td style={{ fontWeight: 500 }}>{idx + 1}</td>
                                        <td style={{ fontWeight: 500 }}>
                                            <FileNameDisplay
                                                fileName={file}
                                                downloadFileFx={() => downloadFileFx(file)}
                                            />
                                        </td>
                                        <td>
                                            <ActionIcon
                                                color="red"
                                                variant="light"
                                                size="sm"
                                                onClick={() => handleDelete(file)}
                                                aria-label="Удалить файл"
                                            >
                                                <TbTrash size="1rem" />
                                            </ActionIcon>
                                        </td>
                                    </tr>
                                ))
                            )}
                    </tbody>
                </Table>
            </Card>
        </Stack>
    );
};

export default FilesManager;
