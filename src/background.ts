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