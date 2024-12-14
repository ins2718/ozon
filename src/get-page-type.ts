import { pageTypes, PageType } from "./common";

export default function getPageType(url = null): PageType {
    url = url || document.location.href;
    let key: PageType;
    for (key in pageTypes) {
        let m = url.match(pageTypes[key]);
        if (m) {
            return key;
        }
    }
    return null;
};