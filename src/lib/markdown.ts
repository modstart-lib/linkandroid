import Showdown from "showdown"


const converter = new Showdown.Converter()

export const MarkdownUtil = {
    toHtml(markdown: string): string {
        return converter.makeHtml(markdown)
    },
}
