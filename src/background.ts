chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "print") {
        console.log(msg)
        fetch("http://localhost:27180/print", {
            method: "POST",
            headers: { "content-type": "application/json;charset=UTF-8" },
            body: JSON.stringify({ value: msg.payload }),
        });
        return true;
    }
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status === "loading" && tab.url && tab.url.startsWith("https://turbo-pvz.ozon.ru")) {
        chrome.scripting.executeScript({
            target: { tabId, allFrames: true },
            func: () => {
                if ("inject" in XMLHttpRequest.prototype) {
                    return;
                }
                (XMLHttpRequest.prototype as any).inject = true;
                const origOpen = XMLHttpRequest.prototype.open;
                const origSend = XMLHttpRequest.prototype.send;
                XMLHttpRequest.prototype.open = function (method, url, ...rest) {
                    this._url = url; this._method = method;
                    return origOpen.call(this, method, url, ...rest);
                };
                XMLHttpRequest.prototype.send = function (body) {
                    this.addEventListener("load", () => {
                        try {
                            const request: XMLHttpRequest = this;
                            if (this._method === "POST" && this._url === "/api2/address-storage/Movement/put/v2") {
                                const resp = JSON.parse(request.responseText) as { articlePositions: { address: string }[] };
                                for (const { address } of resp.articlePositions) {
                                    const m = address.match(/^(\d+)-(\d+)$/);
                                    if (m) {
                                        console.log({ type: "print", payload: +m[1] })
                                        postMessage({ type: "print", payload: +m[1] }, "*");
                                    }
                                }
                            }
                        } catch { }
                    });
                    return origSend.call(this, body);
                };
            },
            world: "MAIN",
            injectImmediately: true,
        });
    }
});