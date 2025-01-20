export default async function ozonRequest<ReturnType>(url: string, bearer: string) {
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