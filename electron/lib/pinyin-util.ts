import PinyinMatch from "pinyin-match";

export const PinyinUtil = {
    match(input, keywords) {
        const index = PinyinMatch.match(input, keywords);
        let inputMark = input;
        let similarity = 0;
        if (index) {
            const indexStart = index[0];
            const indexEnd = index[1];
            inputMark =
                input.substring(0, indexStart) +
                "<mark>" +
                input.substring(indexStart, indexEnd + 1) +
                "</mark>" +
                input.substring(indexEnd + 1);
            similarity = (indexEnd - indexStart + 1) / input.length;
        }
        return {
            matched: !!index,
            inputMark,
            similarity,
        };
    },
    mark(text) {
        return `<mark>${text}</mark>`;
    },
};
