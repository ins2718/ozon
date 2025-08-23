import printer from "@alexssmusica/node-printer";
import express, { Request, Response } from "express";

const app = express();
app.use(express.json());

function middleText(text: string, size: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, xScale: number = 1, yScale: number = 1): string {
    const width = 240;
    const height = 160;
    const rows = 1;
    const columns = text.length;
    const charWidth = [0, 8, 12, 16, 24, 32, 14, 21, 14][size] * xScale;
    const charHeight = [0, 12, 20, 24, 32, 48, 19, 27, 25][size] * yScale;
    return `TEXT ${width / 2 - columns * charWidth / 2},${height / 2 - rows * charHeight / 2},"${size}",0,${xScale},${yScale},"${text}"`
}

async function printNumber(number: number): Promise<void> {
    const tspl = [
        "<ESC>!R",
        "SIZE 30 mm,20 mm",
        "GAP 2.5 mm,0 mm",
        "DIRECTION 0",
        "REFERENCE 0,0",
        "OFFSET 0",
        "CLS",
        middleText(number.toString(), 5, 2, 2),
        // `BARCODE 0,0,"39",80,1,0,2,4,"ii9429991971"`,
        "PRINT 1",
        "END",
    ].join("\r\n");
    const device = printer.getPrinters().find(p => p.name.match(/XP.*365B/i));
    return new Promise<void>((resolve, reject) => {
        printer.printDirect({
            data: Buffer.from(tspl, "ascii"), // RAW‑данные TSPL
            printer: device.name,
            type: "RAW",                      // важно: сырые команды
            success: jobId => {
                console.log(`Отправлено в очередь #${jobId} → ${device.name}`);
                resolve();
            },
            error: err => {
                console.error("Ошибка печати:", err);
                reject(err);
            }
        });
    });
}

app.post("/print", async (req: Request<{}, {}, { value: number }>, res: Response<boolean>): Promise<any> => {
    console.log("Got from extension:", req.body);
    printNumber(req.body.value);
    res.json(true);
});

app.listen(27180);