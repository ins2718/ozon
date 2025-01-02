import { BarcodeType, PageType, barcodeTypes } from "./common";
import getPageType from "./get-page-type";
import Ozon from "./ozon/index";

export default class PageWorker {
    options: Options;
    ozon: Ozon = null;

    timeout: number = 200;
    hTimeout: ReturnType<typeof setTimeout> = null;

    event: KeyboardEvent;
    symbol: string;
    url: string;
    pageType: PageType;

    events: KeyboardEvent[] = [];
    data: string = "";
    lastUpdate: number = 0;

    updateOptions(options: Options = {}) {
        if (!("ozon" in options)) {
            options.ozon = true;
        }
        console.log("options", options);
        this.options = options;
    }
    async init() {
        this.updateOptions((await chrome.storage.sync.get<{ options: Options }>("options"))?.options);
        chrome.storage.sync.onChanged.addListener(value => this.updateOptions(value.options.newValue));
        this.ozon = new Ozon(this);
        this.updatePage(document.location.href);
    }
    isEventAccepted() {
        if (!this.event.isTrusted || this.event.ctrlKey || this.event.altKey || this.ozon.isAccepted()) {
            return true;
        }
        return false;
    }
    send(data: string = null) {
        data = data ?? this.data;
        if (!data) {
            return;
        }
        this.reset();
        data.split('').forEach(key => document.dispatchEvent(new KeyboardEvent('keydown', { key })));
        if (this.symbol === "Enter") {
            document.dispatchEvent(new KeyboardEvent(this.event.type, this.event));
        }
    }
    reset() {
        this.data = "";
        this.events = [];
        this.lastUpdate = Date.now();
        if (this.hTimeout) {
            clearTimeout(this.hTimeout);
            this.hTimeout = null;
        }
    }
    getCodeInfo(): { code: string, type: BarcodeType } {
        let type: BarcodeType;
        for (type in barcodeTypes) {
            let m = this.data.match(barcodeTypes[type]);
            if (m) {
                return { type, code: m[0] };
            }
        }
        return { type: null, code: null };
    }
    checkCode() {
        console.log(this.data);
        let { code, type } = this.getCodeInfo();
        if (!type) {
            return false;
        }
        if (!this.ozon.checkCode(code, type)) {
            this.send();
        }
    }
    keyDown(event: KeyboardEvent) {
        this.event = event;
        this.symbol = this.event.key;
        this.url = document.location.href;
        this.pageType = getPageType(this.url);
        if (this.symbol === "Shift") { // ignore
            event.stopImmediatePropagation();
            event.preventDefault();
            return;
        }
        if (this.isEventAccepted()) {
            if (this.data) {
                event.stopImmediatePropagation();
                event.preventDefault();
                this.send();
            }
            return;
        }
        if (this.symbol === "Enter") {
            if (this.data) {
                event.stopImmediatePropagation();
                event.preventDefault();
                this.checkCode();
                this.reset();
            }
            return;
        }
        event.stopImmediatePropagation();
        event.preventDefault();
        this.data += this.symbol;
        this.events.push(event);
        if (this.hTimeout) {
            clearTimeout(this.hTimeout);
        }
        this.hTimeout = setTimeout(() => (this.hTimeout = null, this.send()), this.timeout);
    }
    updatePage(url: string) {
        this.ozon.updatePage(url);
    }

}