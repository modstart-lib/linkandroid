import contextMenu from "electron-context-menu";

const init = () => {
    contextMenu({
        showSaveImageAs: false,
        showCopyLink: false,
        showCopyImage: false,
        showSelectAll: false,
        showInspectElement: false,
        showSearchWithGoogle: false,
        showLookUpSelection: false,
    });
};

export const ConfigContextMenu = {
    init,
};
