import { BarcodeType, pageTypes } from "../common";
import getPageType from "../get-page-type";
import PageWorker from "../page-worker";
import ozonLearningRequest from "./ozon-learning-request";
import ozonRequest from "./ozon-request";
import panelRequest from "./panel-request";

export default class Ozon {
    pageWorker: PageWorker;
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

    constructor(pageWorker: PageWorker) {
        this.pageWorker = pageWorker;
        this.ozonItems = JSON.parse(localStorage.getItem("ozonItems") ?? "[]");
        this.speechSynthesisUtterance = new SpeechSynthesisUtterance();
        this.voices = speechSynthesis.getVoices().filter(s => s.lang === "ru-RU");
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
            const lastBoxNum = +(localStorage.getItem(`boxNum${this.storeId}`) ?? 0);
            if (!lastBoxNum && (storeId in this.shelfs)) {
                this.boxNum = this.shelfs[storeId];
            }
            panelRequest<{ data: OzonPvzInfo }>(`https://api.limpiarmuebles.pro/pvz/${storeId}`).then(pvz => {
                this.boxNum = pvz.data.shelf;
                localStorage.setItem(`boxNum${this.storeId}`, this.boxNum.toString());
            });
        }
        this.token = token;
        return token;
    }
    getCode(item: OzonPendingArticle | OzonWarehouseRemainsItem) {
        return item.barcode[0] === "i" ? item.barcode : item.id.toString();
    }
    async updateItems() {
        const now = Date.now();
        if (now - this.lastUpdate < 60 * 1000) {
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
        // const today = new Date();
        // const x = await ozonRequest<{ finishedCarriages: { carriageId: number, postingQtyTotal: number, receivedPostingQtyTotal: number }[] }>(`https://turbo-pvz.ozon.ru/api/inbound/Carriages/finished?mode=All&beginDate=${(new Date(today.getTime() - 1000 * 60 * 60 * 24 * 14)).toISOString().substring(0, 10)}&endDate=${today.toISOString().substring(0, 10)}`, this.token);
        // for (let carriage of x.finishedCarriages) {
        //     if (carriage.postingQtyTotal !== carriage.receivedPostingQtyTotal) {
        //         const articles = (await ozonRequest<OzonCarriageArticles>(`https://turbo-pvz.ozon.ru/api/inbound/Carriages/${carriage.carriageId}/content`, token))?.articles;
        //         for (let article of articles) {
        //             if (article.type === "ArticlePosting" && article.state !== "Taken") {
        //                 items.push({
        //                     id: article.id,
        //                     barcode: article.barcode,
        //                     isPending: false,
        //                     code: this.getCode(article)
        //                 });
        //             }
        //         }
        //     }
        // }
        this.ozonItems = items;
        localStorage.setItem("ozonItems", JSON.stringify(items));
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
        }
        if (this.loaded) {
            this.loaded = false;
        }
    }
    isAccepted() {
        return !["ozonInventory", "ozonReceive"].includes(this.pageWorker.pageType) || document.activeElement?.tagName === "INPUT";
    }
    findOzonItem(code: string) {
        const result = this.ozonItems.find(item => code === item.barcode || code === item.id.toString());
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
            if (JSON.parse(localStorage.getItem(this.userName) ?? "{}")?.useSoundDegradation?.data || this.voices.length === 0) {
                (new Audio(`https://turbo-pvz.ozon.ru/mp3/${text}.mp3`)).play();
                return;
            }
        }
        const name = JSON.parse(localStorage.getItem(JSON.parse(localStorage.getItem("pvz-access-token") ?? "{}")?.UserName) ?? "{}")?.userVoice?.data ?? "Google русский";
        const voice = this.voices.find(e => e.name === name);
        this.speechSynthesisUtterance.voice = voice ? voice : this.voices[0];
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
}