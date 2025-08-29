import PageWorker from "./page-worker";

async function main() {
    const worker = new PageWorker();
    worker.init();
    document.addEventListener("keydown", (event) => {
        worker.keyDown(event);
    }, true);
    window.navigation.addEventListener("navigate", (event) => {
        worker.updatePage(event.destination.url);
    });
    window.addEventListener("message", (e) => {
        if (e.source !== window || !e.data || !("type" in e.data) || e.data.type !== "print") {
            return;
        }
        if (worker.options.ozon_print) {
            chrome.runtime.sendMessage(e.data);
        }
    });
}

main();