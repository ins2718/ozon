// Saves options to chrome.storage
const saveOptions = () => {
    const ozon = Boolean(+document.querySelector<HTMLInputElement>('input[name="ozon"]:checked').value);
    const ozon_ru = Boolean(+document.querySelector<HTMLInputElement>('input[name="ozon_ru"]:checked').value);
    chrome.storage.sync.set(
        { options: { ozon, ozon_ru } }
    );
};

const restoreOptions = () => {
    chrome.storage.sync.get("options",
        (data) => {
            document.querySelector<HTMLInputElement>(`input[name="ozon"][value="${(+(data?.options?.ozon ?? true)).toString()}"]`).checked = true;
            document.querySelector<HTMLInputElement>(`input[name="ozon_ru"][value="${(+(data?.options?.ozon_ru ?? true)).toString()}"]`).checked = true;
        }
    );
};

document.addEventListener("DOMContentLoaded", () => {
    restoreOptions();
    for (let element of document.getElementsByName("ozon")) {
        element.addEventListener("change", saveOptions);
    }
    for (let element of document.getElementsByName("ozon_ru")) {
        element.addEventListener("change", saveOptions);
    }
});
