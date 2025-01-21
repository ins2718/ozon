type METHOD = "GET" | "DELETE" | "POST" | "PUT";

interface OzonRequestParams {
    method?: METHOD;
    body?: BodyInit;
}

export default async function ozonRequest<ReturnType>(url: string, bearer: string, params?: METHOD | OzonRequestParams) {
    let method: METHOD = "GET";
    let body: BodyInit = undefined;
    if (typeof params === "string") {
        method = params;
    } else {
        method = params?.method ?? method;
        body = params?.body ?? body;
    }
    const resp = await fetch(url, {
        method,
        body,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "authorization": `Bearer ${bearer}`,
            "x-o3-app-name": "turbo-pvz-ui",
            "x-o3-app-version": "release/29503911",
            "x-o3-version-name": "3.1.18",
        },
    });
    return <ReturnType>await resp.json();
}

export async function ozonRequestUrl(url: string, bearer: string): Promise<string> {
    const resp = await fetch(url, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "authorization": `Bearer ${bearer}`,
            "x-o3-app-name": "turbo-pvz-ui",
            "x-o3-app-version": "release/29503911",
            "x-o3-version-name": "3.1.18",
        },
    });
    return URL.createObjectURL(await resp.blob());
}