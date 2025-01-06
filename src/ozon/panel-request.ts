type PanelRequestOptions = {
    method?: string;
    body?: string;
};

export default async function panelRequest<ReturnType>(url: string, options: PanelRequestOptions = {}) {
    const { method = "GET", body } = options;
    const resp = await fetch(url, {
        method,
        body,
        headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "x-o3-app-name": "profit-edu-fe",
            "x-o3-app-version": "release/2024-12-24-01",
        },
    });
    return <ReturnType>await resp.json();
}