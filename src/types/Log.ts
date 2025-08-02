export enum EnumLogType {
    INFO = "info",
    ERROR = "error",
    WARN = "warn",
}

export type LogRecord = {
    projectId: string | null;
    level: EnumLogType;
    time: number;
    msg: string;
    data: any | null;
};
