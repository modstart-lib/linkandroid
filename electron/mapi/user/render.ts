import page from "../page/render";

const open = async (option: any) => {
    await page.open('user', option)
}

export default {
    open,
}
