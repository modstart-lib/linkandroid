import logIndex from "./index";

export default {
    root: logIndex.root,
    info: logIndex.infoRenderOrMain,
    error: logIndex.errorRenderOrMain,
    appInfo: logIndex.appInfoRenderOrMain,
    appError: logIndex.appErrorRenderOrMain,
    collect: logIndex.collectRenderOrMain,
};
