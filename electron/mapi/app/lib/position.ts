import {screen} from "electron";

export const AppPosition = {
    x: 0,
    y: 0,
    id: -1,
    get(): { x: number; y: number } {
        const {x, y} = screen.getCursorScreenPoint();
        const currentDisplay = screen.getDisplayNearestPoint({x, y});
        if (AppPosition.id !== currentDisplay.id) {
            AppPosition.id = currentDisplay.id;
            AppPosition.x = parseInt(
                String(
                    currentDisplay.workArea.x + currentDisplay.workArea.width / 2 - 400
                )
            );
            AppPosition.y = parseInt(
                String(
                    currentDisplay.workArea.y + currentDisplay.workArea.height / 2 - 200
                )
            );
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


