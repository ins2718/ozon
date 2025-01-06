interface OzonPendingArticle {
    id: number;
    barcode: string;
}

interface OzonPendingArticles {
    articles: OzonPendingArticle[];
}

interface OzonWarehouseRemainsItem {
    id: number;
    barcode: string;
    address?: string;
    returnMoment?: string;
}

interface OzonWarehouseRemains {
    count: number;
    remains: OzonWarehouseRemainsItem[];
}

interface OzonItem {
    id: number;
    barcode: string;
    code: string;
    isPending: boolean;
    address?: string;
}

interface Options {
    ozon_learning?: boolean;
}

interface OzonArrival {
    arrivedCarriageCount: number;
    arrivedPostingCount: number;
    date: string;
    pendingCarriageCount: number;
    pendingPostingCount: number;
}

interface OzonCarriage {
    actualArrivalDate: string;
    arrivalDate: string;
    carNumber: string;
    carTrucker: string;
    cargoPackageCount: number;
    cargoPlacesCountEnabled: boolean;
    contractorName: string;
    documents: {
        id: string;
        name: string;
        type: string;
    }[];
    hasError: boolean;
    id: number;
    isDocumentAutomation: boolean;
    name: string;
    postingsCount: number;
    receivedCargoPackageCount: number;
    receivedCargoPlacesCount: number;
    receivedCargoPlacesCountUpdateDeadline: string;
    receivedPostingsCount: number;
    sourcePlaceName: string;
    state: "Send" | "Recived";
    totalPostingsCount: number;
}

interface OzonCarriages {
    carriages: OzonCarriage[];
}

interface OzonCarriageArticle {
    barcode: string;
    containerCount: number;
    hasError: boolean;
    id: number;
    isQuantum: boolean;
    label: string;
    name: string;
    state: "Taken" | "Banded";
    type: "ArticlePosting" | "ArticleBoxTare";
}

interface OzonCarriageArticles {
    articles: OzonCarriageArticle[];
}

interface OzonProgramMaterial {
    id: string,
    name: string,
    type: "video" | "test" | "scorm" | "longread",
    programId: string,
    retries: number,
    retriesUsed: number,
    completedAt: string | null,
    seenAt: string,
    startedAt: string,
    completionETAMinutes: number,
    thresholdPercent: number,
    onReview: boolean,
    formStatus: "UNKNOWN",
    description: string,
    stoppedOn: number,
    mediaProgressPercent: number,
    downloadRestricted: boolean,
    isAccessible: boolean,
    watchCount: number,
    duration: number,
    preview: string,
    likesDislikesCount: {
        likesCount: number,
        dislikesCount: number
    },
    commentsCount: number,
    testRetriesRestrictedAfterSuccess: boolean
}

interface OzonProgram {
    id: string;
    strictMaterialOrder: boolean;
    materials: OzonProgramMaterial[];
}

interface OzonProgramMaterialTestQuestionAnswer {
    id: string;
    text: string;
    image: string;
}

interface OzonProgramMaterialTestQuestion {
    id: string;
    name: string;
    type: "mcq";
    image: string;
    order: number;
    multiple: boolean;
    score: number;
    answers: OzonProgramMaterialTestQuestionAnswer[];
    section: string;
}

interface OzonError {
    code: number;
    message: string;
}

interface OzonProgramMaterialTest {
    id: string;
    material: OzonProgramMaterial;
    createdAt: string;
    closed: boolean;
    currentQuestion: OzonProgramMaterialTestQuestion;
    questionsMask: ("NO_RESULT" | "CORRECT" | "INCORRECT")[];
    error: OzonError;
    dueDate: null;
    remainingTime: string;
    programId: string;
    totalPoints: number;
    totalQuestions: number;
    onReview: boolean;
    isSuccess: boolean;
}

interface OzonProgramMaterialTestResult {
    material: OzonProgramMaterial;
    createdAt: string;
    closedAt: string;
    questionResult: {
        question: OzonProgramMaterialTestQuestion;
        correct: boolean;
        answers: string[];
        recommendation: string;
        hidden: boolean;
        type: "mcq";
        openAnswer: string;
        adminComment: string;
    }[];
    error: OzonError;
    total: number;
    required: number;
    correct: number;
    answered: number;
    resultVisibility: "public";
    isSuccess: boolean;
}

interface OzonProgramMaterialScorm {
    material: OzonProgramMaterial;
    scormId: string;
    scormEntrypoint: string;
    suspendData: string;
    state: "completed" | "not attempted";
    masteryScore: null;
    error: OzonError;
}

interface OzonPvzInfo {
    id: number;
    name: string;
    shelf: number;
}