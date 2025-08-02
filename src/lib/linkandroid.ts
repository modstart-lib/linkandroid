import {t} from "../lang";

export function replaceIP(value: string) {
    return value.replaceAll(".", "_").replaceAll(":", "-");
}

export function restoreIP(value: string) {
    return value.replaceAll("_", ".").replaceAll("-", ":");
}

export function isIPWithPort(ip: string) {
    const regex =
        /^((25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d):(1\d{0,4}|[1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/;
    return regex.test(ip);
}

export function parseIPPort(ip: string) {
    const [ip_, port] = ip.split(":");
    return {
        ip: restoreIP(ip_),
        port: parseInt(port),
    };
}
