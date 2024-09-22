import {buildResolve, extraResolve} from "../util/path";

export const logoPath = buildResolve('logo.png')
export const icoLogoPath = buildResolve('logo.ico')
export const icnsLogoPath = buildResolve('logo.icns')

export const trayPath =  process.platform === 'darwin'
    ? extraResolve('mac/tray/iconTemplate.png')
    : extraResolve('common/tray/icon.png')
