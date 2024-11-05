import {screen} from "electron";

export const AppPosition = {
    x: 0,
    y: 0,
    screenWidth: 0,
    screenHeight: 0,
    id: -1,
    get(calculator?: (screenX: number, screenY: number, screenWidth: number, screenHeight: number) => {
        x: number,
        y: number
    }): {
        x: number;
        y: number,
    } {
        const {x, y} = screen.getCursorScreenPoint();
        const currentDisplay = screen.getDisplayNearestPoint({x, y});
        if (AppPosition.id !== currentDisplay.id) {
            AppPosition.id = currentDisplay.id;
            AppPosition.screenWidth = currentDisplay.workArea.width;
            AppPosition.screenHeight = currentDisplay.workArea.height;
            if (!calculator) {
                calculator = (
                    screenX: number,
                    screenY: number,
                    screenWidth: number,
                    screenHeight: number
                ) => {
                    console.log('calculator', {screenX, screenY, screenWidth, screenHeight});
                    return {
                        x: screenX + screenWidth / 10,
                        y: screenY + screenHeight / 10,
                    }
                }
            }
            const res = calculator(
                currentDisplay.workArea.x,
                currentDisplay.workArea.y,
                AppPosition.screenWidth,
                AppPosition.screenHeight
            );
            AppPosition.x = parseInt(String(res.x));
            AppPosition.y = parseInt(String(res.y));
        }
        return {
            x: AppPosition.x,
            y: AppPosition.y,
        };
    },
    set(x: number, y: number): void {
        AppPosition.x = x;
        AppPosition.y = y;
    },
};


