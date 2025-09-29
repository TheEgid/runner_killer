import { useEffect } from "react";
import { ActionIcon, Button, Card, Group, Table, Text } from "@mantine/core";
import { useUnit } from "effector-react";
import { TbRefresh, TbTrash } from "react-icons/tb";
import { $files, deleteFileFx, fetchFilesFx } from "src/models/interchange-state";

const FilesManager = (): React.JSX.Element => {
    const files = useUnit($files);

    useEffect(() => {
        void fetchFilesFx();
    }, []);

    const handleDelete = (fileName: string): void => {
        void deleteFileFx(fileName);
    };

    return (
        <Group gap="md" align="flex-start">
            <Card w="700px" shadow="sm" m={0} radius="xs" withBorder>
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
                                    <tr key={`${file}-${idx}`}>
                                        <td style={{ fontWeight: 500 }}>{idx + 1}</td>
                                        <td style={{ fontWeight: 500 }}>{file}</td>
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
            <Button
                leftSection={<TbRefresh size="1rem" />}
                onClick={() => fetchFilesFx()}
            >
                Обновить список файлов
            </Button>
        </Group>
    );
};

export default FilesManager;
