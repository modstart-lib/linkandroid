import {debounce} from "lodash-es";
import {createStderr, createStdout, textFormatter} from "vue-command";
import {t} from "../../../lang";
import {useFixCursor} from "./index";

export const useAdbCommand = ({loading, vueCommand, history}) => {
    const adbCommand = async (args: string[]) => {
        loading.value = true;
        const appendToHistory = debounce(vueCommand.value.appendToHistory, 500);
        let stdoutText = "";
        let stderrText = "";
        $mapi.adb.spawnShell(args.slice(1), {
            stdout(text) {
                loading.value = false;
                stdoutText += text;
                useFixCursor(history);
                appendToHistory(createStdout(stdoutText));
            },
            stderr(text) {
                loading.value = false;
                stderrText += text;
                useFixCursor(history);
                appendToHistory(createStderr(stderrText));
            },
            success() {
                if (!stdoutText) {
                    stdoutText += t("shell.executeSuccess");
                }
                useFixCursor(history);
                appendToHistory(createStderr(stdoutText));
                loading.value = false;
            },
            error() {
                if (!stdoutText) {
                    stdoutText += t("shell.executeFailed");
                }
                useFixCursor(history);
                appendToHistory(createStderr(stdoutText));
                loading.value = false;
            },
        });
        return textFormatter("Waiting...");
    };

    return {
        adbCommand,
    };
};
