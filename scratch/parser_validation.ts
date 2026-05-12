import * as fs from 'fs';
import * as path from 'path';
import { UniversalParser } from '../src/parsers/universalParser.ts';

const EDGE_CASES_DIR = path.resolve('./public/test-data/edge-cases/');

function loadFile(filename: string): string {
    return fs.readFileSync(path.join(EDGE_CASES_DIR, filename), 'utf-8');
}

async function runTests() {
    console.log("--- STARTING UNIVERSAL PARSER VALIDATION ---");
    let passed = 0;
    const total = 4;

    try {
        // Test 1: European Decimal
        console.log("\n[Test 1] European Decimal Parsing");
        const eurContent = loadFile('european_decimals.txt');
        const resEur = UniversalParser.parseText(eurContent, 'european_decimals.txt', 785);
        if (Math.abs(resEur.wavenumberData[0] - 2744.05) < 0.1 && Math.abs(resEur.intensityData[0] - 5200.10) < 0.1) {
            console.log("✅ European decimals correctly parsed.");
            passed++;
        } else {
            console.log("❌ Failed to parse European decimals correctly.");
            console.log("Parsed row 0:", resEur.wavenumberData[0], resEur.intensityData[0]);
        }

        // Test 2: Sequential Index Skipping
        console.log("\n[Test 2] Sequential Index Skipping");
        const idxContent = loadFile('indexed_multicolumn.txt');
        const resIdx = UniversalParser.parseText(idxContent, 'indexed_multicolumn.txt', 785);
        if (Math.abs(resIdx.wavenumberData[0] - 2738.85) < 0.1 && Math.abs(resIdx.intensityData[0] - 5200) < 0.1) {
            console.log("✅ Sequential index skipped correctly.");
            passed++;
        } else {
            console.log("❌ Failed to skip sequential index.");
            console.log("Parsed row 0:", resIdx.wavenumberData[0], resIdx.intensityData[0]);
        }

        // Test 3: Metadata Header Filtering
        console.log("\n[Test 3] Metadata Header Filtering");
        const metaContent = loadFile('metadata_header.txt');
        const resMeta = UniversalParser.parseText(metaContent, 'metadata_header.txt', 785);
        if (Math.abs(resMeta.wavenumberData[0] - 2738.85) < 0.1) {
            console.log("✅ Metadata headers filtered correctly.");
            passed++;
        } else {
            console.log("❌ Failed to filter metadata headers.");
            console.log("Parsed wavenumbers:", resMeta.wavenumberData.slice(0, 5));
        }

        // Test 4: Invalid File Catching
        console.log("\n[Test 4] Invalid File Exception");
        try {
            UniversalParser.parseText("Random garbage text without numbers", 'invalid.txt', 785);
            console.log("❌ Failed to throw on invalid file.");
        } catch (e: any) {
            if (e.message.includes("No valid numeric data detected")) {
                console.log("✅ Caught invalid file with helpful message.");
                passed++;
            } else {
                console.log("❌ Threw incorrect exception: " + e.message);
            }
        }

        console.log(`\n--- VALIDATION COMPLETE: ${passed}/${total} PASSED ---`);
    } catch (e: any) {
        console.error("Test execution failed:", e.message);
    }
}

runTests();
