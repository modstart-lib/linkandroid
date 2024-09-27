import {app, Menu} from "electron";
import {isDev, isMac} from "../lib/env";
import {t} from "./lang";
import {PageAbout} from "../page/about";

let contextMenu: Electron.Menu;

const ready = () => {
    const menuTemplate: Electron.MenuItemConstructorOptions[] = [];
    if (isMac) {
        menuTemplate.push(
            {
                label: app.name,
                submenu: [
                    {label: `${t('关于')}${app.name}`, role: "about"},
                    {type: "separator"},
                    // {
                    //     label: t("设置"),
                    //     click: () => {
                    //         createSettingWindow();
                    //     },
                    //     accelerator: "CmdOrCtrl+,",
                    // },
                    // {type: "separator"},
                    {label: t('服务'), role: "services"},
                    {type: "separator"},
                    {label: `${t("隐藏")} ${app.name}`, role: "hide"},
                    {label: t("隐藏其他"), role: "hideOthers"},
                    {label: t("全部显示"), role: "unhide"},
                    {type: "separator"},
                    {label: t('退出'), role: "quit"},
                ],
            },
        )
    }
    menuTemplate.push({
        label: t('编辑'),
        submenu: [
            {label: t('撤销'), accelerator: "CmdOrCtrl+Z", role: "undo"},
            {label: t('重做'), accelerator: "Shift+CmdOrCtrl+Z", role: "redo"},
            {type: "separator"},
            {label: t('剪切'), accelerator: "CmdOrCtrl+X", role: "cut"},
            {label: t('复制'), accelerator: "CmdOrCtrl+C", role: "copy"},
            {label: t('粘贴'), accelerator: "CmdOrCtrl+V", role: "paste"},
            {label: t('全选'), accelerator: "CmdOrCtrl+A", role: "selectAll"}
        ]
    })
    if (isDev) {
        menuTemplate.push({
            label: t("视图"),
            submenu: [
                {label: t("重新加载"), role: "reload"},
                {label: t("强制重载"), role: "forceReload"},
                {label: t("开发者工具"), role: "toggleDevTools"},
                {type: "separator"},
                {label: t("实际大小"), role: "resetZoom", accelerator: ""},
                {label: t("放大"), role: "zoomIn"},
                {label: t("缩小"), role: "zoomOut"},
                {type: "separator"},
                {label: t("全屏"), role: "togglefullscreen"},
            ],
        })
    }
    // menuTemplate.push({
    //     label: t("帮助"),
    //     role: "help",
    //     submenu: [
    //         // {
    //         //     label: t("教程帮助"),
    //         //     click: () => {
    //         //         createHelpWindow();
    //         //     },
    //         // },
    //         // {type: "separator"},
    //         // {
    //         //     label: t("关于"),
    //         //     click: () => {
    //         //         PageAbout.open().then()
    //         //     },
    //         // },
    //     ],
    // })
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

export const ConfigMenu = {
    ready
}
