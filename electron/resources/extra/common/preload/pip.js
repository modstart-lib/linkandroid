document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, true);
});
