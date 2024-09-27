import packageJson from '../package.json';

const BASE_URL = 'https://linkandroid.com/app_manager';

export const AppConfig = {
    name: 'LinkAndroid',
    slogan: 'Link android to PC easily',
    version: packageJson.version,
    website: `${BASE_URL}`,
    websiteGithub: 'https://github.com/modstart-lib/linkandroid',
    websiteGitee: 'https://gitee.com/modstart-lib/linkandroid',
    userEnable: false,
    userUrl: `${BASE_URL}/user`,
    updaterUrl: `${BASE_URL}/updater`,
    downloadUrl: `${BASE_URL}/download`,
    statisticsUrl: `${BASE_URL}/collect`,
    helpUrl: `${BASE_URL}/help`,
}

