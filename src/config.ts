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
    userEnable: false,
    updaterUrl: `${BASE_URL}/app_manager/updater`,
    downloadUrl: `${BASE_URL}/app_manager/download`,
    statisticsUrl: `${BASE_URL}/app_manager/collect`,
    helpUrl: `${BASE_URL}/app_manager/help`,
}

