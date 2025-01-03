type OzonLearningRequestOptions = {
    method?: string;
    body?: string;
};

export default async function ozonLearningRequest<ReturnType>(url: string, options: OzonLearningRequestOptions = {}) {
    const { method = "GET", body } = options;
    const resp = await fetch(url, {
        credentials: "include",
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