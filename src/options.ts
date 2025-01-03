// Saves options to chrome.storage
const saveOptions = () => {
    const ozon_learning = Boolean(+document.querySelector<HTMLInputElement>('input[name="ozon_learning"]:checked').value);
    chrome.storage.sync.set(
        { options: { ozon_learning } }
    );
};

const restoreOptions = () => {
    chrome.storage.sync.get("options",
        (data) => {
            document.querySelector<HTMLInputElement>(`input[name="ozon_learning"][value="${(+(data?.options?.ozon_learning ?? false)).toString()}"]`).checked = true;
        }
    );
};

document.addEventListener("DOMContentLoaded", () => {
    restoreOptions();
    for (let element of document.getElementsByName("ozon_learning")) {
        element.addEventListener("change", saveOptions);
    }
});
