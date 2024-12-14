import PageWorker from "./page-worker";

async function main() {
    const worker = new PageWorker();
    worker.init();
    document.addEventListener("keydown", (event) => {
        worker.keyDown(event);
    }, true);
    window.navigation.addEventListener('navigate', (event) => {
        worker.updatePage(event.destination.url);
    });
}

main();