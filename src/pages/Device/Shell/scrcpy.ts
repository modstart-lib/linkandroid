import {debounce} from "lodash-es";
import {createStderr, createStdout, textFormatter} from "vue-command";
import {useFixCursor} from "./index";
import {t} from "../../../lang";

export const useScrcpyCommand = ({loading, vueCommand, history}) => {
    const scrcpyCommand = async (args) => {
        loading.value = true;
        const appendToHistory = debounce(vueCommand.value.appendToHistory, 500);
        let stdoutText = "";
        let stderrText = "";
        await $mapi.scrcpy.spawnShell(args.slice(1), {
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
                    stdoutText += t("执行成功");
                }
                useFixCursor(history);
                appendToHistory(createStderr(stdoutText));
                loading.value = false;
            },
            error() {
                if (!stdoutText) {
                    stdoutText += t("执行失败");
                }
                useFixCursor(history);
                appendToHistory(createStderr(stdoutText));
                loading.value = false;
            },
        });
        return textFormatter("Waiting...");
    };

    return {
        scrcpyCommand,
    };
};
