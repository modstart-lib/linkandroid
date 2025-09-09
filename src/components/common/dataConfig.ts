export const getDataContent = async (key: string, defaultValue: string): Promise<string> => {
    return $mapi.storage.get("data", key, defaultValue);
};
