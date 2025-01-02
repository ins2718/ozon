import { BarcodeType } from "../common";
import getPageType from "../get-page-type";
import PageWorker from "../page-worker";
import ozonRequest from "./ozon-request";

export default class Ozon {
    pageWorker: PageWorker;
    ozonItems: OzonItem[];
    token: string = null;
    storeId: number = null;
    userName: string = null;
    loaded: boolean = false;
    speechSynthesisUtterance: SpeechSynthesisUtterance = null;
    boxNum: number = 0;
    lastUpdate: number = 0;

    constructor(pageWorker: PageWorker) {
        this.pageWorker = pageWorker;
    }
    checkToken(): string | null {
        if (this.token) {
            return this.token;
        }
        const item = localStorage.getItem("pvz-access-token");
        if (!item) {
            return null;
        }
        const parsedItem = JSON.parse(item);
        if (!parsedItem) {
            return null;
        }
        const token = parsedItem.access_token;
        if (!token) {
            return null;
        }
        this.boxNum = 0;
        const storeId = parsedItem.StoreId;
        if (storeId) {
            this.storeId = storeId;
            this.userName = parsedItem.UserName ?? null;
            const boxes = { 1020000952515000: 315, 1020002141586000: 4, 15592743073000: 31 };
            if (storeId in boxes) {
                this.boxNum = boxes[storeId];
            }
        }
        this.token = token;
        return token;
    }
    getCode(item: OzonPendingArticle | OzonWarehouseRemainsItem) {
        return item.barcode[0] === "i" ? item.barcode : item.id.toString();
    }
    async updateItems() {
        const now = Date.now();
        if (now - this.lastUpdate < 10000) {
            return;
        }
        this.lastUpdate = now;
        const token = this.checkToken();
        if (!token) {
            return;
        }
        if (this.pageWorker.pageType === "ozonStores") {
            return;
        }
        // const pendingArticles: OzonPendingArticles = await ozonRequest("https://turbo-pvz.ozon.ru/api/inbound/address_storage/pending-articles", token);
        const articles: OzonWarehouseRemains = await ozonRequest("https://turbo-pvz.ozon.ru/api/reports/agent/warehouse_remainsV2?filter=All&stateFilter=All&postingNumber=&take=1000&skip=0", token);
        // this.arrivals = await ozonRequest("https://turbo-pvz.ozon.ru/api/widget/widgets/arrivals", token);
        const carriages = (await ozonRequest<OzonCarriages>("https://turbo-pvz.ozon.ru/api/inbound/Carriages", token))?.carriages;

        const items: OzonItem[] = [];
        const extraRequests: Promise<any>[] = [];
        const requests = carriages.map(async carriage => {
            const articles = (await ozonRequest<OzonCarriageArticles>(`https://turbo-pvz.ozon.ru/api/inbound/Carriages/${carriage.id}/content`, token))?.articles;
            for (let article of articles) {
                if (article.type === "ArticleBoxTare") {
                    for (let inboxArticle of (await ozonRequest<OzonCarriageArticles>(`https://turbo-pvz.ozon.ru/api/inbound/Carriages/${carriage.id}/containers/${article.id}/content`, token))?.articles) {
                        items.push({
                            id: inboxArticle.id,
                            barcode: inboxArticle.barcode,
                            code: this.getCode(inboxArticle),
                            isPending: inboxArticle.state === "Banded"
                        });
                    }
                } else {
                    items.push({
                        id: article.id,
                        barcode: article.barcode,
                        code: this.getCode(article),
                        isPending: article.state === "Banded"
                    });
                }
            }
        });
        await Promise.all(requests.concat(extraRequests));
        articles.remains.forEach(article => items.push({
            id: article.id,
            barcode: article.barcode,
            code: this.getCode(article),
            isPending: false
        }));
        this.ozonItems = items;
        console.log(items);
    }
    async updatePage(url: string) {
        const pageType = getPageType(url);
        if (["ozonInventory", "ozonReceive"].includes(pageType)) {
            if (!this.loaded) {
                this.loaded = true;
                this.updateItems();
            }
            return;
        }
        if (this.loaded) {
            this.loaded = false;
        }
    }
    isAccepted() {
        return !["ozonInventory", "ozonReceive"].includes(this.pageWorker.pageType);
    }
    findOzonItem(code: string) {
        const result = this.ozonItems.find((item) => item.code === code);
        if (result) {
            return result;
        }
        return null;
    }
    checkCode(code: string, type: BarcodeType): boolean {
        if (type === "ozonBoxCodeTemplate") {
            this.pageWorker.send(code);
            setTimeout(() => this.updateItems(), 2000);
            return true;
        }
        if (["ozonSmallCodeRuTemplate", "ozonSmallCodeTemplate"].includes(type)) {
            code = code.replaceAll("ш", "i").replaceAll("Ш", "i").replaceAll("I", "i");
            type = "ozonSmallCodeTemplate";
        }
        if (["ozonSmallCodeTemplate", "ozonLargeCodeTemplate", "ozonFreshCodeTemplate"].includes(type)) {
            if (this.findOzonItem(code)) {
                console.log("found");
                this.pageWorker.send(code);
            } else {
                if (this.pageWorker.pageType === "ozonReceive") {
                    this.updateItems();
                    fetch("https://api.limpiarmuebles.pro/ozon-codes", {
                        method: 'POST',
                        headers: {
                            "content-type": "application/json;charset=UTF-8",
                        },
                        body: JSON.stringify({ store_id: this.storeId, code: code, }),
                    }).then(resp => resp.json()).then(resp => {
                        const type = resp.data.total_scans === 1 ? "success" : "warning";
                        (new Audio(chrome.runtime.getURL(`sounds/${type}.mp3`))).play().then(() => this.textToScpeech(this.boxNum.toString()));
                        const wrap = document.querySelector("._logsWrapper_mor7k_7");
                        if (!wrap) {
                            return;
                        }
                        const emtyItem = document.querySelector("[data-testid='empty-block-error']");
                        if (emtyItem) {
                            emtyItem.remove();
                        }
                        let itemsWrap = document.querySelector("._logs_mor7k_2");
                        if (!itemsWrap) {
                            itemsWrap = document.createElement("div");
                            itemsWrap.className = "_logs_mor7k_2";
                            wrap.appendChild(itemsWrap);
                        }
                        const el = document.createElement("div");
                        el.dataset.testid = "logItemBlock";
                        el.className = `ozi__informer__informer__HzSFx ozi-body-500 ozi__informer__size-500__HzSFx ozi__informer__${type}__HzSFx ozi__informer__showAccentLine__HzSFx`;
                        el.innerHTML = `<div class="_logContent_mor7k_11"><div class="_addressInner_mor7k_82"><div class="_addressBadge_mor7k_87 ozi-heading-500 _addressBadgeDefault_mor7k_114" data-testid="logItemPlace">${this.boxNum}-${resp.data.num}</div><div><button data-testid="relocateBtn" type="submit" class="ozi__button__button__maF2e ozi__button__size-400__maF2e ozi-body-500-true ozi__button__uncontained__maF2e ozi__button__hug__maF2e ozi__button__light__maF2e ozi__button__noLeftRadius__maF2e ozi__button__noRightRadius__maF2e"><div class="ozi__button__content__maF2e"><!----><div class="ozi__truncate__truncate__7a-6_ ozi__button__text__maF2e">Изменить</div><!----></div><!----></button><!----></div></div><div class="_logItem_mor7k_17"><div class="_logTitle_mor7k_23"><div class="ozi__text-view__textView__ff2BT ozi__text-view__headline-h5__ff2BT ozi-heading-100 ozi__text-view__light__ff2BT ozi__text-view__paddingBottomOff__ff2BT ozi__text-view__paddingTopOff__ff2BT">Отправление ${resp.data.code}</div><span class="_logDate_mor7k_29">${resp.data.created_at}</span></div><div class="ozi__text-view__textView__ff2BT ozi__text-view__caption-medium__ff2BT ozi-body-500 ozi__text-view__light__ff2BT ozi__text-view__paddingBottomOff__ff2BT ozi__text-view__paddingTopOff__ff2BT ozi__text-view__caption__ff2BT">Предмет уже числится на складе. Воспользуйтесь поиском отправлений, чтобы убедиться в этом.</div><div class="_info_mor7k_47 _infoInner_mor7k_52"><button data-testid="compositionBtn" type="submit" class="ozi__button__button__maF2e ozi__button__size-400__maF2e ozi-body-500-true ozi__button__uncontained__maF2e ozi__button__hug__maF2e ozi__button__light__maF2e ozi__button__hasLeftIcon__maF2e ozi__button__noLeftRadius__maF2e ozi__button__noRightRadius__maF2e"><div class="ozi__button__content__maF2e"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" class="" viewBox="0 0 24 24"><path fill="currentColor" d="M6.293 9.293a1 1 0 0 1 1.414 0L12 13.586l4.293-4.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 0 1 0-1.414"></path></svg><div class="ozi__truncate__truncate__7a-6_ ozi__button__text__maF2e">Состав отправления</div><!----></div><!----></button><!----></div></div></div>`;
                        const firstChild = itemsWrap.firstElementChild as HTMLDivElement;
                        if (!firstChild) {
                            itemsWrap.prepend(el);
                        } else {
                            firstChild.after(firstChild.cloneNode(true));
                            firstChild.dataset.testid = el.outerHTML;
                            firstChild.className = el.className;
                            firstChild.innerHTML = el.innerHTML;
                        }
                    });
                } else {
                    (new Audio(chrome.runtime.getURL("sounds/special.mp3"))).play();
                }
            }
            return true;
        }
        return false;
    }
    textToScpeech(text: string) {
        if (this.userName) {
            if (JSON.parse(localStorage.getItem(this.userName) ?? "{}")?.useSoundDegradation?.data) {
                (new Audio(`https://turbo-pvz.ozon.ru/mp3/${text}.mp3`)).play();
                return;
            }
        }
        const name = JSON.parse(localStorage.getItem(JSON.parse(localStorage.getItem("pvz-access-token") ?? "{}")?.UserName) ?? "{}")?.userVoice?.data ?? "Google русский";
        if (!this.speechSynthesisUtterance) {
            this.speechSynthesisUtterance = new SpeechSynthesisUtterance();
            const voices = speechSynthesis.getVoices().filter(s => s.lang === "ru-RU");
            const voice = voices.find(e => e.name === name);
            this.speechSynthesisUtterance.voice = voice ? voice : voices[0];
        }
        this.speechSynthesisUtterance.text = text;
        speechSynthesis.speak(this.speechSynthesisUtterance);
    }
}