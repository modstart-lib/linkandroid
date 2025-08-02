import {screen} from "electron";

type PositionCache = {
    x: 0;
    y: 0;
    screenWidth: 0;
    screenHeight: 0;
    id: -1;
};

export const AppPosition = {
    caches: {} as Record<string, PositionCache>,
    getCache(name: string): PositionCache {
        if (!this.caches[name]) {
            this.caches[name] = {
                x: 0,
                y: 0,
                screenWidth: 0,
                screenHeight: 0,
                id: -1,
            };
        }
        return this.caches[name];
    },
    get(
        name: string,
        calculator?: (
            screenX: number,
            screenY: number,
            screenWidth: number,
            screenHeight: number
        ) => {
            x: number;
            y: number;
        }
    ): {
        x: number;
        y: number;
    } {
        const cache = this.getCache(name);
        const {x, y} = screen.getCursorScreenPoint();
        const currentDisplay = screen.getDisplayNearestPoint({x, y});
        if (cache.id !== currentDisplay.id) {
            cache.id = currentDisplay.id;
            cache.screenWidth = currentDisplay.workArea.width;
            cache.screenHeight = currentDisplay.workArea.height;
            if (!calculator) {
                calculator = (screenX: number, screenY: number, screenWidth: number, screenHeight: number) => {
                    // console.log('calculator', {screenX, screenY, screenWidth, screenHeight});
                    return {
                        x: screenX + screenWidth / 10,
                        y: screenY + screenHeight / 10,
                    };
                };
            }
            const res = calculator(
                currentDisplay.workArea.x,
                currentDisplay.workArea.y,
                cache.screenWidth,
                cache.screenHeight
            );
            cache.x = parseInt(String(res.x));
            cache.y = parseInt(String(res.y));
        }
        return {
            x: cache.x,
            y: cache.y,
        };
    },
    set(name: string, x: number, y: number): void {
        const cache = this.getCache(name);
        cache.x = x;
        cache.y = y;
    },
    getContextMenuPosition(
        boxWidth: number,
        boxHeight: number
    ): {
        x: number;
        y: number;
    } {
        const {x, y} = screen.getCursorScreenPoint();
        const currentDisplay = screen.getDisplayNearestPoint({x, y});
        let resultX = x;
        let resultY = y;
        if (currentDisplay.workArea.width - x < boxWidth) {
            resultX = currentDisplay.workArea.width - boxWidth;
        }
        if (currentDisplay.workArea.height - y < boxHeight) {
            resultY = currentDisplay.workArea.height - boxHeight;
        }
        return {
            x: resultX,
            y: resultY,
        };
    },
};
