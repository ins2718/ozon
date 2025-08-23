// Saves options to chrome.storage
const saveOptions = () => {
    const ozon_learning = Boolean(+document.querySelector<HTMLInputElement>('input[name="ozon_learning"]:checked').value);
    const ozon_video = Boolean(+document.querySelector<HTMLInputElement>('input[name="ozon_video"]:checked').value);
    const ozon_print = Boolean(+document.querySelector<HTMLInputElement>('input[name="ozon_print"]:checked').value);
    chrome.storage.sync.set(
        { options: { ozon_learning, ozon_video, ozon_print } }
    );
};

const restoreOptions = () => {
    chrome.storage.sync.get("options",
        (data) => {
            document.querySelector<HTMLInputElement>(`input[name="ozon_learning"][value="${(+(data?.options?.ozon_learning ?? false)).toString()}"]`).checked = true;
            document.querySelector<HTMLInputElement>(`input[name="ozon_video"][value="${(+(data?.options?.ozon_video ?? false)).toString()}"]`).checked = true;
            document.querySelector<HTMLInputElement>(`input[name="ozon_print"][value="${(+(data?.options?.ozon_print ?? false)).toString()}"]`).checked = true;
        }
    );
};

document.addEventListener("DOMContentLoaded", () => {
    restoreOptions();
    for (let element of document.getElementsByName("ozon_learning")) {
        element.addEventListener("change", saveOptions);
    }
    for (let element of document.getElementsByName("ozon_video")) {
        element.addEventListener("change", saveOptions);
    }
    for (let element of document.getElementsByName("ozon_print")) {
        element.addEventListener("change", saveOptions);
    }
});
