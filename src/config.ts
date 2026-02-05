import packageJson from "../package.json";
import {TimeUtil} from "../electron/lib/util";

const BASE_URL = "https://linkandroid.com";

export const AppConfig = {
    name: "LinkAndroid",
    title: "LinkAndroid",
    slogan: "Link android to PC easily",
    version: packageJson.version,
    website: `${BASE_URL}`,
    websiteGithub: "https://github.com/modstart-lib/linkandroid",
    websiteGitee: "https://gitee.com/modstart-lib/linkandroid",
    apiBaseUrl: `${BASE_URL}/api`,
    updaterUrl: `${BASE_URL}/app_manager/updater`,
    downloadUrl: `${BASE_URL}/app_manager/download`,
    libUrl: `${BASE_URL}/app_manager/lib`,
    feedbackUrl: `${BASE_URL}/feedback_ticket`,
    statisticsUrl: `${BASE_URL}/app_manager/collect`,
    guideUrl: `${BASE_URL}/app_manager/guide`,
    helpUrl: `${BASE_URL}/app_manager/help`,
    basic: {
        userEnable: false,
    },
};
