import { BarcodeType, barcodeTypes, pageTypes } from "../common";
import getPageType from "../get-page-type";
import PageWorker from "../page-worker";
import ozonLearningRequest from "./ozon-learning-request";
import ozonRequest, { ozonRequestUrl } from "./ozon-request";
import panelRequest from "./panel-request";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.js");

export default class Ozon {
    pageWorker: PageWorker;
    // missedOzonItems: { [key: number]: OzonItem[]; };
    ozonItems: OzonItem[];
    token: string = null;
    storeId: number = null;
    userName: string = null;
    loaded: boolean = false;
    speechSynthesisUtterance: SpeechSynthesisUtterance = null;
    voices: SpeechSynthesisVoice[];
    boxNum: number = 0;
    lastUpdate: number = 0;
    lastLearning: number = 0;
    currentScrom: string = "";
    shelfs: { [key: number]: number; } = { 1020000952515000: 315, 1020002141586000: 4, 15592743073000: 31 };
    ozonSearchItemTimer: NodeJS.Timeout;

    constructor(pageWorker: PageWorker) {
        this.checkToken();
        this.pageWorker = pageWorker;
        this.ozonItems = JSON.parse(localStorage.getItem("ozonItems") ?? "[]");
        // this.missedOzonItems = Object.fromEntries(JSON.parse(localStorage.getItem("missedOzonItems") ?? "[]"));
        this.speechSynthesisUtterance = new SpeechSynthesisUtterance();
        this.voices = speechSynthesis.getVoices().filter(s => s.lang === "ru-RU");
        this.setUserVoice();
    }
    isEventIntercepted() {
        return ["ozonInventory", "ozonReceive"].includes(this.pageWorker.pageType);
    }
    setUserVoice() {
        const userName = JSON.parse(localStorage.getItem("pvz-access-token") ?? "{}")?.UserName;
        if (!userName) {
            return;
        }
        const userInfo = JSON.parse(localStorage.getItem(userName) ?? "{}");
        const userVoice = userInfo?.userVoice?.data;
        if (userVoice) {
            return;
        }
        const useSoundDegradation = userInfo?.useSoundDegradation?.data;
        if (!useSoundDegradation) {
            userInfo.useSoundDegradation = {
                data: true,
                meta: {
                    time: Date.now()
                }
            };
            localStorage.setItem(userName, JSON.stringify(userInfo));
        }
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
            this.lastUpdate = +(localStorage.getItem(`${storeId}-ozonLastUpdate`) ?? "0");
            this.storeId = storeId;
            this.userName = parsedItem.UserName ?? null;
            const lastBoxNum = +(localStorage.getItem(`boxNum${this.storeId}`) ?? 0);
            if (!lastBoxNum && (storeId in this.shelfs)) {
                this.boxNum = this.shelfs[storeId];
            }
            ozonRequest<{ shelves: OzonShelf[] }>("https://turbo-pvz.ozon.ru/api/inbound/address_storage/empty-shelves", token).then(json => {
                let shelf: OzonShelf | null = null;
                if (json.shelves.length > 0) {
                    shelf = json.shelves[0];
                }
                panelRequest<{ data: OzonPvzInfo }>(`https://api.limpiarmuebles.pro/pvz/${storeId}?empty-shelf=${shelf.address}`).then(pvz => {
                    this.boxNum = pvz.data.shelf;
                    localStorage.setItem(`boxNum${this.storeId}`, this.boxNum.toString());
                    // if (this.boxNum === +shelf.address) {
                    //     ozonRequest(`https://turbo-pvz.ozon.ru/api/address-storage/Agent/structure/remove-element?elementId=${json.shelves[0].id}`, token, "DELETE");
                    // }
                });
            });
        }
        this.token = token;
        return token;
    }
    parseName(name: string | null | (string | null)[]): string {
        if (Array.isArray(name)) {
            return name.find(s => (s ?? "").match(barcodeTypes.ozonLargeCodePublicTemplate));
        }
        if (typeof name === "string") {
            return name;
        }
        return "";
    }
    async updateItems(force = false) {
        const now = Date.now();
        if ((!force && now - this.lastUpdate < 60 * 10000) || (force && now - this.lastUpdate < 60 * 1000)) {
            return;
        }
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
                            isPending: inboxArticle.state === "Banded",
                            name: this.parseName(inboxArticle.name),
                        });
                    }
                } else {
                    items.push({
                        id: article.id,
                        barcode: article.barcode,
                        isPending: article.state === "Banded",
                        name: this.parseName(article.name),
                    });
                }
            }
        });
        await Promise.all(requests.concat(extraRequests));
        articles.remains.forEach(article => items.push({
            id: article.id,
            barcode: article.barcode,
            isPending: false,
            name: this.parseName(article.name),
        }));
        // const missedItems: { [key: number]: OzonItem[] } = [];
        // const regExps = [barcodeTypes.ozonLargeCodePublicTemplate, barcodeTypes.ozonSmallCodeTemplate, barcodeTypes.ozonFreshCodeTemplate].map(regExp => new RegExp(regExp.source.substring(1, regExp.source.length - 1)))
        // const today = new Date();
        // const finishedCarriages = await ozonRequest<{ finishedCarriages: OzonFinishedCarriages[] }>(`https://turbo-pvz.ozon.ru/api/inbound/Carriages/finished?limit=30&mode=All&beginDate=${(new Date(today.getTime() - 1000 * 60 * 60 * 24 * 14)).toISOString().substring(0, 10)}&endDate=${today.toISOString().substring(0, 10)}`, this.token);
        // for (let carriage of finishedCarriages.finishedCarriages) {
        //     if (carriage.carriageId in this.missedOzonItems) {
        //         missedItems[carriage.carriageId] = this.missedOzonItems[carriage.carriageId];
        //         continue;
        //     }
        //     let save = false;
        //     missedItems[carriage.carriageId] = [];
        //     for (let document of carriage.documentsV2) {
        //         if (document.documentType === "DocumentsMismatchAct") {
        //             save = true;
        //             const pdfUrl = `https://turbo-pvz.ozon.ru/api/inbound/Documents/download?transportationId=${carriage.carriageId}&documentId=${document.documentId}&documentType=${document.documentType}`;
        //             try {
        //                 const blobUrl = await ozonRequestUrl(pdfUrl, token);
        //                 const loadingTask = pdfjsLib.getDocument(blobUrl);
        //                 const pdfDocument = await loadingTask.promise;
        //                 for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
        //                     const page = await pdfDocument.getPage(pageNumber);
        //                     const textContent = await page.getTextContent();
        //                     const pageText = textContent.items.map(item => "str" in item ? item.str : "").join("");
        //                     const regExp = /Отправление [\s-\di\(\)]+ шт/g;
        //                     for (let match of pageText.matchAll(regExp)) {
        //                         for (let codeRegExp of regExps) {
        //                             const m = match[0].match(codeRegExp);
        //                             if (m) {
        //                                 const item = await ozonRequest<OzonShortArticle>(`https://turbo-pvz.ozon.ru/api/article-tracking/Article/find?name=${m[0]}&isManualInput=true`, token);
        //                                 const ozonItem = {
        //                                     id: item.id,
        //                                     barcode: item.name,
        //                                     isPending: false
        //                                 };
        //                                 missedItems[carriage.carriageId].push(ozonItem);
        //                                 break;
        //                             }
        //                         }
        //                     }
        //                 }
        //             } catch (e) {
        //                 continue;
        //             }
        //         }
        //     }
        //     if (!save) {
        //         delete missedItems[carriage.carriageId];
        //     }
        // }
        // this.missedOzonItems = missedItems;
        // localStorage.setItem("missedOzonItems", JSON.stringify(Object.entries(missedItems)));
        // Object.values(missedItems).forEach(missedItems => missedItems.forEach(missedItem => items.push(missedItem)));
        localStorage.setItem("ozonItems", JSON.stringify(items));
        this.ozonItems = items;
        console.log(items);
        this.lastUpdate = now;
        localStorage.setItem(`${this.storeId}-ozonLastUpdate`, now.toString());
    }
    async updatePage(url: string) {
        const pageType = getPageType(url);
        if (this.ozonSearchItemTimer && !["ozonSearchItem", "ozonOrdersAction"].includes(pageType)) {
            clearInterval(this.ozonSearchItemTimer);
            this.ozonSearchItemTimer = null;
        }
        if (["ozonInventory", "ozonReceive"].includes(pageType)) {
            if (!this.loaded) {
                this.loaded = true;
                this.updateItems();
            }
            return;
        } else if (pageType === "ozonLearning" && this.pageWorker.options.ozon_learning) {
            const m = url.match(pageTypes.ozonLearning);
            if (m) {
                const programId = +m[1];
                if (programId === this.lastLearning) {
                    return;
                }
                this.lastLearning = programId;
                const courseData = await ozonLearningRequest<OzonProgram>(`https://olearning.ozon.ru/api/v1/lms/program/${programId}`);
                if (courseData) {
                    this.waitForProgram(courseData);
                }
            }
            return;
        } else if (this.pageWorker.options.ozon_video && pageType === "ozonSearchItem") {
            if (!this.ozonSearchItemTimer) {
                const m = url.match(pageTypes.ozonSearchItem);
                if (m) {
                    this.ozonSearchItemTimer = setInterval(() => this.ozonSearchItemCb(), 1000);
                }
            }
        } else if (this.pageWorker.options.ozon_video && pageType === "ozonOrdersAction") {
            if (!this.ozonSearchItemTimer) {
                this.ozonSearchItemTimer = setInterval(() => this.ozonOrdersActionCb(), 1000);
            }
        }
        if (this.loaded) {
            this.loaded = false;
        }
    }
    async ozonOrdersActionCb() {
        const items = document.querySelectorAll("div[class^=_copy_]");
        if (!items) {
            return;
        }
        clearInterval(this.ozonSearchItemTimer);
        this.ozonSearchItemTimer = null;
        let needUpdate = false;
        for (let item of items) {
            const itemCode = (item as HTMLDivElement).innerText.replace(/\s/g, "");
            if (document.getElementById(`find-${itemCode}`)) {
                break;
            }
            const findElement = document.createElement("a");
            findElement.href = `https://turbo-pvz.ozon.ru/search?filter={%22search%22:%22${itemCode}%22}`;
            findElement.innerText = "Поиск";
            findElement.target = "_blank";
            findElement.id = `find-${itemCode}`;
            item.parentNode.appendChild(findElement);
        }
        if (needUpdate) {
            this.updateItems();
        }
    }
    ozonSearchItemCb() {
        const cells = document.querySelectorAll<HTMLSpanElement>("[class^=_step_] span:nth-child(2)");
        if (cells.length > 0 && this.storeId) {
            clearInterval(this.ozonSearchItemTimer);
            this.ozonSearchItemTimer = null;
            for (let cell of cells) {
                const m = cell.innerText.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
                if (m) {
                    const receiveDate = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`);
                    const el = document.createElement("a");
                    el.href = `${chrome.runtime.getURL("video.html")}?store=${this.storeId}&start=${receiveDate.getTime() / 1000 | 0}`;
                    el.innerText = cell.innerText;
                    el.target = "_blank";
                    cell.innerHTML = '';
                    cell.appendChild(el);
                }
            }
        }
    }
    isAccepted() {
        return !["ozonInventory", "ozonReceive"].includes(this.pageWorker.pageType) || document.activeElement?.tagName === "INPUT";
    }
    findOzonItem(code: string) {
        const result = this.ozonItems.find(item => code === item.barcode || code === item.id.toString() || code === item.name);
        if (result) {
            return result;
        }
        return null;
    }
    checkCode(code: string, type: BarcodeType): boolean {
        if (type === "ozonBoxCodeTemplate") {
            this.pageWorker.send(code);
            return true;
        }
        if (["ozonSmallCodeRuTemplate", "ozonSmallCodeTemplate"].includes(type)) {
            code = code.replaceAll("ш", "i").replaceAll("Ш", "i").replaceAll("I", "i");
            type = "ozonSmallCodeTemplate";
        }
        if (["ozonSmallCodeTemplate", "ozonLargeCodeTemplate", "ozonFreshCodeTemplate"].includes(type)) {
            if (this.findOzonItem(code)) {
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
                        if (!resp.data.shelf) {
                            (new Audio(chrome.runtime.getURL("sounds/error.mp3"))).play();
                            return;
                        }
                        const type = resp.data.total_scans === 1 ? "success" : "warning";
                        (new Audio(chrome.runtime.getURL(`sounds/${type}.mp3`))).play().then(() => this.textToScpeech(resp.data.shelf.toString()));
                        const wrap = document.querySelector("[class^=_logsWrapper_]");
                        if (!wrap) {
                            return;
                        }
                        const hash = wrap.className.match(/_logsWrapper_([^_]+)_7/)[1];
                        const emtyItem = document.querySelector("[data-testid='empty-block-error']");
                        if (emtyItem) {
                            emtyItem.remove();
                        }
                        let itemsWrap = document.querySelector(`._logs_${hash}_2`);
                        if (!itemsWrap) {
                            itemsWrap = document.createElement("div");
                            itemsWrap.className = `._logs_${hash}_2`;
                            wrap.appendChild(itemsWrap);
                        }
                        const el = document.createElement("div");
                        el.dataset.testid = "logItemBlock";
                        el.className = `ozi__informer__informer__HzSFx ozi-body-500 ozi__informer__size-500__HzSFx ozi__informer__${type}__HzSFx ozi__informer__showAccentLine__HzSFx`;
                        el.innerHTML = `<div class="_logContent_${hash}_11"><div class="_addressInner_${hash}_82"><div class="_addressBadge_${hash}_87 ozi-heading-500 _addressBadgeDefault_${hash}_114" data-testid="logItemPlace">${resp.data.shelf}-${resp.data.num}</div><div><button data-testid="relocateBtn" type="submit" class="ozi__button__button__TAOtz ozi__button__size-400__TAOtz ozi-body-500-true ozi__button__uncontained__TAOtz ozi__button__hug__TAOtz ozi__button__light__TAOtz ozi__button__noLeftRadius__TAOtz ozi__button__noRightRadius__TAOtz"><div class="ozi__button__content__TAOtz"><!----><div class="ozi__truncate__truncate__7a-6_ ozi__button__text__TAOtz">Изменить</div><!----></div><!----></button><!----></div></div><div class="_logItem_${hash}_17"><div class="_logTitle_${hash}_23"><div class="ozi__text-view__textView__ff2BT ozi__text-view__headline-h5__ff2BT ozi-heading-100 ozi__text-view__light__ff2BT ozi__text-view__paddingBottomOff__ff2BT ozi__text-view__paddingTopOff__ff2BT">Отправление ${resp.data.code}</div><span class="_logDate_${hash}_29">${resp.data.created_at}</span></div><div class="ozi__text-view__textView__ff2BT ozi__text-view__caption-medium__ff2BT ozi-body-500 ozi__text-view__light__ff2BT ozi__text-view__paddingBottomOff__ff2BT ozi__text-view__paddingTopOff__ff2BT ozi__text-view__caption__ff2BT">Предмет уже числится на складе. Воспользуйтесь поиском отправлений, чтобы убедиться в этом.</div><div class="_info_${hash}_47 _infoInner_${hash}_52"><button data-testid="compositionBtn" type="submit" class="ozi__button__button__TAOtz ozi__button__size-400__TAOtz ozi-body-500-true ozi__button__uncontained__TAOtz ozi__button__hug__TAOtz ozi__button__light__TAOtz ozi__button__hasLeftIcon__TAOtz ozi__button__noLeftRadius__TAOtz ozi__button__noRightRadius__TAOtz"><div class="ozi__button__content__TAOtz"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" class="" viewBox="0 0 24 24"><path fill="currentColor" d="M6.293 9.293a1 1 0 0 1 1.414 0L12 13.586l4.293-4.293a1 1 0 1 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 0 1 0-1.414"></path></svg><div class="ozi__truncate__truncate__7a-6_ ozi__button__text__TAOtz">Состав отправления</div><!----></div><!----></button><!----></div></div></div>`;
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
            this.voices = speechSynthesis.getVoices().filter(s => s.lang === "ru-RU");
            if (JSON.parse(localStorage.getItem(this.userName) ?? "{}")?.useSoundDegradation?.data || this.voices.length === 0) {
                (new Audio(`https://turbo-pvz.ozon.ru/mp3/${text}.mp3`)).play();
                return;
            }
        }
        const name = JSON.parse(localStorage.getItem(JSON.parse(localStorage.getItem("pvz-access-token") ?? "{}")?.UserName) ?? "{}")?.userVoice?.data?.name;
        const voice = this.voices.find(e => e.name === name);
        this.speechSynthesisUtterance.voice = voice ?? this.voices[0];
        this.speechSynthesisUtterance.text = text;
        speechSynthesis.speak(this.speechSynthesisUtterance);
    }
    waitForProgram(program: OzonProgram, n: number = 10) {
        const items = document.querySelectorAll("[class^=ozi__data-content__label__");
        if (program.materials.length !== items.length) {
            if (n > 0) {
                setTimeout(() => this.waitForProgram(program, n - 1), 500);
            }
            return;
        }
        for (let materialNum in program.materials) {
            const material = program.materials[materialNum];
            if (!material.completedAt) {
                if (["video", "test", "longread", "scorm"].includes(material.type)) {
                    const button = document.createElement("button");
                    button.innerText = "выполнить";
                    button.onclick = async (e) => {
                        e.stopPropagation();
                        if (material.type === "video") {
                            await ozonLearningRequest(`https://olearning.ozon.ru/api/v1/lms/progress-set?programId=${program.id}&materialId=${material.id}&progress=100`, { method: "POST" });
                            document.location.reload();
                        } else if (material.type === "test") {
                            const questions: Record<string, OzonProgramMaterialTestQuestion> = {};
                            const questionsOptions: Record<string, string[][]> = {};
                            let question: OzonProgramMaterialTest;
                            function combinations(array: string[]) {
                                return new Array(1 << array.length).fill("").map(
                                    (_, i) => array.filter((_, j) => i & 1 << j)).slice(1);
                            }
                            let x = 0;
                            do {
                                question = await ozonLearningRequest<OzonProgramMaterialTest>("https://olearning.ozon.ru/api/v1/lms/start", { method: "POST", body: JSON.stringify({ programId: program.id, testId: material.id }) });
                                for (let i = question.currentQuestion.order; i <= question.totalQuestions; ++i) {
                                    const key = question.currentQuestion.name + question.currentQuestion.image;
                                    if (!(key in questions)) {
                                        questions[key] = { ...question.currentQuestion };
                                        const optionsTmp = question.currentQuestion.answers.map(e => e.text);
                                        questionsOptions[key] = question.currentQuestion.multiple ? combinations(optionsTmp) : optionsTmp.map(e => [e]);
                                    }
                                    console.log("question", question.currentQuestion.name, "possibleAnswers", questionsOptions[key]);
                                    const answerId = questionsOptions[key][0].map(text => question.currentQuestion.answers.find(a => a.text === text).id);
                                    const nextQuestion = await ozonLearningRequest<OzonProgramMaterialTest>("https://olearning.ozon.ru/api/v1/lms/answer", { method: "POST", body: JSON.stringify({ answerId, instanceQuestionId: question.currentQuestion.id }) });
                                    if (nextQuestion.questionsMask[i - 1] === "CORRECT") {
                                        questionsOptions[key] = [questionsOptions[key][0]];
                                    } else {
                                        questionsOptions[key] = questionsOptions[key].slice(1);
                                    }
                                    console.log(nextQuestion.questionsMask[i - 1]);
                                    // console.log("question", question.currentQuestion.name, "possibleAnswers", questionsOptions[question.currentQuestion.name]);
                                    question = nextQuestion;
                                }
                                const result = await ozonLearningRequest<OzonProgramMaterialTestResult>(`https://olearning.ozon.ru/api/v1/lms/test-result/${question.id}`);
                                console.log(result.correct, "/", result.answered, result.isSuccess);
                                x += 1;
                                if (x >= 20 || result.isSuccess) {
                                    document.location.reload();
                                    break;
                                }
                            } while (!question.isSuccess);
                        } else if (material.type === "longread") {
                            await ozonLearningRequest<OzonProgramMaterialTestResult>("https://olearning.ozon.ru/api/v1/lms/longread-completed", { method: "POST", body: JSON.stringify({ programId: program.id, id: material.id }) });
                            document.location.reload();
                        } else if (material.type === "scorm") {
                            button.parentElement.click();
                            this.scromHelper(material.id);
                        }
                    }
                    items.item(+materialNum).appendChild(button);
                }
                if (program.strictMaterialOrder) {
                    return;
                }
            }
        }
    }
    async scromHelper(id: string, checked: boolean = false) {
        if (this.currentScrom && this.currentScrom !== id) {
            return;
        }
        if (!this.currentScrom) {
            this.currentScrom = id;
        }
        const frame = document.getElementsByTagName("iframe").item(0)?.contentWindow?.document;
        if (!frame) {
            setTimeout(() => this.scromHelper(id), 500);
            return;
        }
        const nextButtonPrimary = frame.querySelector<HTMLButtonElement>(".uikit-primary-button:not(.uikit-primary-button_locked)");
        if (nextButtonPrimary) {
            nextButtonPrimary.focus();
            frame.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13 }));
            setTimeout(() => this.scromHelper(id), 500);
            return;
        }
        const scrollable = frame.querySelector(".roll-player__content");
        if (scrollable) {
            if (scrollable.scrollTop + scrollable.clientHeight < scrollable.scrollHeight) {
                scrollable.scrollTop = scrollable.scrollHeight;
            } else {
                frame.querySelectorAll("button").item(1)?.click();
            }
            setTimeout(() => this.scromHelper(id), 500);
            return;
        }
        const yesButton = frame.querySelector<HTMLButtonElement>("div.message-box button");
        if (yesButton && yesButton.innerText === "Да") {
            console.log(yesButton);
            yesButton.dispatchEvent(new Event('click'));
            setTimeout(() => this.scromHelper(id), 500);
            return;
        }
        const nextButton = frame.querySelector("a[onclick*=gotoNextSlide]");
        if (nextButton) {
            nextButton.dispatchEvent(new Event('click'));
            setTimeout(() => this.scromHelper(id), 500);
            return;
        }
        const visitButtons = frame.querySelectorAll("a[onclick*=gotoSlide]:not(.visited)");
        if (visitButtons.length > 0) {
            visitButtons[Math.random() * visitButtons.length | 0].dispatchEvent(new Event('click'));
            setTimeout(() => this.scromHelper(id), 500);
            return;
        }
        if (checked) {
            setTimeout(() => this.scromHelper(id, true), 500);
            return;
        }
        const result = await ozonLearningRequest<OzonProgramMaterialScorm>(`https://olearning.ozon.ru/api/v1/lms/scorm/${this.currentScrom}?programId=${this.lastLearning}`);
        if (result.state === "completed") {
            this.currentScrom = "";
            document.querySelector<HTMLButtonElement>("button:last-child").click();
            return;
        }
        setTimeout(() => this.scromHelper(id, true), 500);
    }
    async getItemOperationHistory(itemId: number): Promise<OzonOperationDescription[]> {
        const json = await ozonRequest<{ operations: OzonOperationDescription[] }>(`https://turbo-pvz.ozon.ru/api/article-tracking/Article/operation-history?articleId=${itemId}`, this.token);
        return json.operations;
    };
    async getItemReceiveTime(itemId: number) {
        const operations = await this.getItemOperationHistory(itemId);
        for (let operation of operations) {
            if (operation.operationDescription.startsWith("Отправление принято с помощью сканера, пользователь")) {
                return new Date(operation.momentUtc);
            }
        }
    }
}