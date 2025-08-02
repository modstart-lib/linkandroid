export const useDragWindow = ({name, ignore}: {name: string | null; ignore?: (e: MouseEvent) => boolean}) => {
    name = name || null;
    let animationId: number;
    let mouseX: number;
    let mouseY: number;
    let clientWidth = 0;
    let clientHeight = 0;
    let draggable = true;

    const onDragWindowMouseDown = e => {
        // 右击不移动
        if (e.button === 2) {
            return;
        }
        if (ignore && ignore(e)) {
            return;
        }
        draggable = true;
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (Math.abs(document.body.clientWidth - clientWidth) > 5) {
            clientWidth = document.body.clientWidth;
        }
        if (Math.abs(document.body.clientHeight - clientHeight) > 5) {
            clientHeight = document.body.clientHeight;
        }
        document.addEventListener("mouseup", onMouseUp);
        animationId = requestAnimationFrame(moveWindow);
    };

    const onMouseUp = () => {
        draggable = false;
        document.removeEventListener("mouseup", onMouseUp);
        cancelAnimationFrame(animationId);
    };

    const moveWindow = () => {
        window.$mapi.app.windowMove(name, {mouseX, mouseY, width: clientWidth, height: clientHeight}).then(() => {
            if (draggable) {
                animationId = requestAnimationFrame(moveWindow);
            }
        });
    };

    return {
        onDragWindowMouseDown,
    };
};
