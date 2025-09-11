export const getDataContent = async <T extends any>(key: string, defaultValue: T): Promise<T> => {
    return $mapi.storage.get("data", key, defaultValue);
};
