import packageJson from '../package.json';

const BASE_URL = 'https://linkandroid.com';

export const AppConfig = {
    name: 'LinkAndroid',
    slogan: 'Link android to PC easily',
    version: packageJson.version,
    website: `${BASE_URL}`,
    websiteGithub: 'https://github.com/modstart-lib/linkandroid',
    websiteGitee: 'https://gitee.com/modstart-lib/linkandroid',
    apiBaseUrl: `${BASE_URL}/api`,
    updaterUrl: `${BASE_URL}/app_manager/updater`,
    downloadUrl: `${BASE_URL}/app_manager/download`,
    feedbackUrl: `${BASE_URL}/feedback`,
    statisticsUrl: `${BASE_URL}/app_manager/collect`,
    helpUrl: `${BASE_URL}/app_manager/help`,
    basic: {
        userEnable: false,
    }
}

