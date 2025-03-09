const options = {
    "1020000952515000": {
        codes: ["Pz4ae6U8VLNwo9BT", "Qjbq4kQmjJ5cZu1q"],
    },
    "15592743073000": {
        codes: ["oAfNNZ1764oxJh9Z", "ECPE5KpLhGqczcxM"],
    },
    "1020002141586000": {
        codes: ["tffryunMkANVN5vT"],
    }
};
const urlParams = new URLSearchParams(window.location.search);
window.addEventListener("load", () => {
    const start = +urlParams.get('start') + 3 * 60 * 60;
    const end = start + 60 * 30;
    for (let code of options[urlParams.get('store')].codes) {
        const el = document.createElement("iframe");
        el.allow = "fullscreen *"
        el.src = `https://ru.cloud.trassir.com/embed/${code}?lang=ru&start=${start}&end=${end}&mode=record&autoplay=1`;
        document.body.appendChild(el);
    }
});