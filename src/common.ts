const barcodeTypes = {
    passportNational: /^PNRUS([<\d[A-Z]{39})\s*(\d{9})\dRUS\d{6}\d[MF<][\d<O]{7}\d[\d<O]{15}$/,
    passportNationalRu: /^ЗТКГЫ([\dА-Я]{39})\s*(\d{9})\dКГЫ\d{6}\d[ЬАБ][\dБЩ]{7}\d[\dБЩ]{15}$/,
    ozonCodeTemplate: /^\d{8,}\*\d{4}$/,
    ozonBoxCodeTemplate: /^%\d{3}%\d{11}$/,
    ozonSmallCodeTemplate: /^[iI]{2}\d{9,10}$/,
    ozonSmallCodeRuTemplate: /^[Шш]{2}\d{9,10}$/,
    ozonLargeCodeTemplate: /^\d{15}$/,
    ozonFreshCodeTemplate: /^\d{10}$/,
    avitoCodeTemplate: /^\d{10}$/,
    avitoGiveTemplate: /^%\d{2}%-[Vv][Dd]\d{2}-\d{7}$/,
    avitoGiveRuTemplate: /^%\d{2}%-[Мм][Вв]{2}\d{2}-\d{7}$/,
    avitoGetTemplate: /^%\d{2}%-[Ii][Dd]\d{2}-\d{7}$/,
    avitoGetRuTemplate: /^%\d{2}%-[Шш][Вв]{2}\d{2}-\d{7}$/,
};
const pageTypes = {
    avito: /^https:\/\/pvz\.avito\.ru\/?(?:\?.*)?$/, // авито - главная
    avitoDeliver: /^https:\/\/pvz\.avito\.ru\/deliver\/?(?:\?.*)?$/, // авито - выдача
    avitoDeliverRefuse: /^https:\/\/pvz\.avito\.ru\/deliver\/parcel\/\d+\/refuse\/barcode\/?(?:\?.*)?$/, // авито - отказ и ввод нового кода
    avitoDeliverCode: /^https:\/\/pvz\.avito\.ru\/deliver\/parcel\/\d+\/?(?:\?.*)?$/, // авито - ввод кода
    avitoDeliverAction: /^https:\/\/pvz\.avito\.ru\/deliver\/.+(?:\?.*)?$/, // авито - в процессе и после выдачи
    avitoAccept: /^https:\/\/pvz\.avito\.ru\/accept\/?(?:\?.*)?$/, // авито - приём посылок от клиентов
    avitoAccept2: /^https:\/\/pvz\.avito\.ru\/accept\/parcel\/\d+\/barcode\/?(?:\?.*)?$/, // авито - приём посылок от клиентов, сканирование нашего кода
    avitoAccept3: /^https:\/\/pvz\.avito\.ru\/accept\/parcel\/(\d+)\/waybill\/?(?:\?.*)?$/, // авито - приём посылок от клиентов, печать накладной
    avitoAcceptCheckDocument: /^https:\/\/pvz\.avito\.ru\/accept\/parcel\/\d+\/check-document\/?(?:\?.*)?$/, // авито - приём посылок от клиентов, ввод паспорта
    avitoAcceptAction: /^https:\/\/pvz\.avito\.ru\/accept\/?(?:\?.*)?$/, // авито - в процессе и после приёма
    avitoGet: /^https:\/\/pvz\.avito\.ru\/get\/?(?:.*)?$/, // авито - приём посылок от курьера
    avitoGive: /^https:\/\/pvz\.avito\.ru\/give\/?(?:\?.*)?$/, // авито - передача посылок курьеру
    avitoInventory: /^https:\/\/pvz\.avito\.ru\/inventory\/?(?:\?.*)?$/, // авито - Заказы в пункте
    avitoShelves: /^https:\/\/pvz\.avito\.ru\/shelves\/?(?:\?.*)?$/, // авито - Управление полками

    ozon: /^https:\/\/turbo-pvz\.ozon\.ru\/?(?:\?.*)?$/, // озон - главная
    ozonOrders: /^https:\/\/turbo-pvz\.ozon\.ru\/orders\/?(?:\?.*)?$/, // озон - выдача <a href="/returns-from-customer/34374314">к возвратам</a>
    ozonOrdersSummary: /^https:\/\/turbo-pvz\.ozon\.ru\/orders\/client-new\/(\d+)\/summary\/?(?:\?.*)?$/, // озон - выдача конкретного заказа, заверщение
    ozonOrdersAction: /^https:\/\/turbo-pvz\.ozon\.ru\/orders\/client-new\/(\d+)\/?(?:\?.*)?$/, // озон - выдача конкретного заказа
    ozonReceive: /^https:\/\/turbo-pvz\.ozon\.ru\/receiving\/receive\/?(?:\?.*)?$/, // озон - приём отправлений
    ozonPostings: /^https:\/\/turbo-pvz\.ozon\.ru\/receiving\/postings\/?(?:\?.*)?$/, // озон - список отправлений
    ozonReturns: /^https:\/\/turbo-pvz\.ozon\.ru\/returns-from-customer\/?(?:\?.*)?$/, // озон - возвраты
    ozonReturnsAction: /^https:\/\/turbo-pvz\.ozon\.ru\/returns-from-customer\/(\d+)\/?(?:\?.*)?$/, // озон - возвраты
    ozonLogin: /^https:\/\/turbo-pvz\.ozon\.ru\/ozonid\/?(?:\?.*)?$/, // озон - вход
    ozonOutbound: /^https:\/\/turbo-pvz\.ozon\.ru\/outbound(?:.*)?$/, // озон - возвраты курьеру
    ozonInventory: /^https:\/\/turbo-pvz\.ozon\.ru\/inventory(?:.*)?$/, // инвентаризация
    ozonSearch: /^https:\/\/turbo-pvz\.ozon\.ru\/search\/?(?:.*)?$/, // поиск
    ozonStores: /^https:\/\/turbo-pvz\.ozon\.ru\/stores\/?(?:.*)?$/, // выбор пункта
};

type PageType = keyof typeof pageTypes;
type BarcodeType = keyof typeof barcodeTypes;

export { pageTypes, barcodeTypes, PageType, BarcodeType };