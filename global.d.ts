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
    ozon?: boolean;
    ozon_ru?: boolean;
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